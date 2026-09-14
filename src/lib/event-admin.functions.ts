import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import { copyEventConfigSections, copySection } from "@/lib/event-clone";
import { mergeCoverage, type EventCoverage } from "@/lib/event-config";





// Clone event-scoped child rows (certificate templates, notices, broadcasts,
// and optionally organisations) from a source event into a newly-created one.
// Any per-child failures are logged and skipped — the parent row is authoritative.
async function cloneEventChildren(
  sourceId: string,
  targetId: string,
  opts: { includeOrganisations?: boolean } = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const cloneTable = async (table: string) => {
    try {
      const { data: rows } = await (supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (q: string) => {
            eq: (c: string, v: string) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
        };
      })
        .from(table)
        .select("*")
        .eq("event_id", sourceId);
      if (!rows?.length) return;
      const cleaned = rows.map((r) => {
        const { id: _id, created_at: _c, updated_at: _u, ...rest } = r as Record<string, unknown>;
        void _id; void _c; void _u;
        return { ...rest, event_id: targetId };
      });
      await (supabaseAdmin as unknown as {
        from: (t: string) => { insert: (rows: unknown) => Promise<unknown> };
      })
        .from(table)
        .insert(cleaned);
    } catch (e) {
      console.error(`clone ${table} failed`, e);
    }
  };

  await cloneTable("certificate_templates");
  await cloneTable("event_notices");
  await cloneTable("event_broadcasts");
  if (opts.includeOrganisations) await cloneTable("event_organisations");
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `event-${Date.now().toString(36)}`
  );
}



// Column list kept as a non-literal string (matches the public resolver's
// pattern). `coverage` is deliberately NOT a column here: coverage lives inside
// the `general` JSONB column, which exists in every production DB — a dedicated
// coverage column may not exist yet and would break this query.
const EVENT_LIST_COLUMNS =
  "id, slug, is_active, is_template, template_category, lifecycle_status, publish_status, archived_at, district, district_id, campaign_id, general, created_at, updated_at";

// ---------------- List ----------------
export const adminListEvents = createServerFn({ method: "GET" })  .handler(async () => {
    const session = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("events")
      .select(EVENT_LIST_COLUMNS)
      .order("created_at", { ascending: false });
    // Scope non-super-admins to their assigned events.
    if (session.role !== "super_admin") {
      const { resolveEventFilter } = await import("@/lib/admin-scope.server");
      const filter = await resolveEventFilter(session, null);
      if (filter.mode === "many") {
        if (filter.ids.length === 0) return { ok: true as const, rows: [] };
        q = q.in("id", filter.ids);
      }
    }
    const { data, error } = await q;
    if (error) return { ok: false as const, error: error.message };
    const rowsAll = ((data ?? []) as unknown as Array<Record<string, unknown>>);

    // Registration counts per event — reuse the existing event_overview
    // RPC (already in production) instead of an N+1 count query.
    const countById = new Map<string, number>();
    const { data: overview } = await supabaseAdmin.rpc("event_overview" as never);
    if (Array.isArray(overview)) {
      for (const o of overview as Array<{ id: string; registrations?: number }>) {
        if (o?.id) countById.set(o.id, o.registrations ?? 0);
      }
    }

    // Resolve district names for every coverage id (zone lists + single ids).
    const ids = new Set<string>();
    for (const w of rowsAll) {
      const c = mergeCoverage(
        ((w.general as { coverage?: unknown } | null)?.coverage ?? null),
        (w.district_id as string | null) ?? null,
      );
      if (c.type === "zone" && c.district_ids) c.district_ids.forEach((id) => ids.add(id));
      if (c.type === "single" && typeof w.district_id === "string") ids.add(w.district_id);
    }
    const nameById = new Map<string, string>();
    if (ids.size > 0) {
      const { data: ds } = await supabaseAdmin
        .from("districts")
        .select("id, name")
        .in("id", Array.from(ids));
      for (const d of ds ?? []) nameById.set(d.id as string, d.name as string);
    }

    return {
      ok: true as const,
      rows: rowsAll.map((w) => {
        const general = (w.general ?? {}) as Record<string, unknown>;
        const c = mergeCoverage(general.coverage, (w.district_id as string | null) ?? null);
        let names: string[] = [];
        if (c.type === "single") {
          const dName =
            typeof w.district_id === "string" ? nameById.get(w.district_id) : undefined;
          names = dName
            ? [dName]
            : typeof w.district === "string" && w.district
              ? [w.district]
              : [];
        } else if (c.type === "zone") {
          names = (c.district_ids ?? [])
            .map((id) => nameById.get(id))
            .filter((v): v is string => !!v);
        } else {
          names = ["All Districts"];
        }
        return {
          ...w,
          coverage_type: c.type,
          coverage_district_names: names,
          general: general as { title?: string; subtitle?: string; event_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null; registration_open_at?: string | null; registration_close_at?: string | null },
          registration_count: countById.get(w.id as string) ?? 0,
        };
      }),
    };
  });


// Templates only — powers the "Clone from template" picker in Create dialog.
export const adminListEventTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("events")
    .select("id, slug, template_category, general")
    .eq("is_template", true)
    .order("updated_at", { ascending: false });
  // Scope non-super-admins to templates in their assigned set.
  if (session.role !== "super_admin") {
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, null);
    if (filter.mode === "many") {
      if (filter.ids.length === 0) return { ok: true as const, rows: [] };
      q = q.in("id", filter.ids);
    }
  }
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message, rows: [] };
  return { ok: true as const, rows: data ?? [] };
});

// ---------------- Create ----------------
export const adminCreateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(2).max(200),
        subtitle: z.string().trim().max(300).optional(),
        district: z.string().trim().max(120).optional(),
        district_id: z.string().uuid().optional(),
        district_name: z.string().trim().max(120).optional(),
        description: z.string().trim().max(4000).optional(),
        type: z
          .enum(["district", "state", "national", "event", "training", "workshop", "certification"])
          .optional(),
        event_date: z.string().trim().max(20).optional(),
        event_time: z.string().trim().max(20).optional(),
        end_date: z.string().trim().max(20).optional(),
        start_time: z.string().trim().max(10).optional(),
        end_time: z.string().trim().max(10).optional(),
        registration_open_at: z.string().trim().max(40).optional(),
        registration_close_at: z.string().trim().max(40).optional(),
        venue: z.string().trim().max(300).optional(),
        activate: z.boolean().optional(),
        template_from: z.string().uuid().optional(),
        is_template: z.boolean().optional(),
        template_category: z.string().trim().max(80).optional(),
        coverage: z
          .object({
            type: z.enum(["single", "zone", "state"]),
            district_ids: z.array(z.string().uuid()).max(100).optional().nullable(),
          })
          .optional(),
      })
      .parse(input),
  )

  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const baseSlug = slugify(data.title);
    // ensure unique slug
    let slug = baseSlug;
    let i = 1;
    while (true) {
      const { data: exists } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      i += 1;
      slug = `${baseSlug}-${i}`;
    }
    const activate = !!data.activate;

    // Normalize coverage before insert: single → district_ids null (the
    // effective district is the district_id column), zone → deduped id list,
    // state → null (all active districts).
    const coverage: EventCoverage | null = data.coverage
      ? mergeCoverage(data.coverage)
      : null;

    // Template resolution is EXPLICIT ONLY. A new event never inherits from
    // another live event (previously it silently fell back to the default),
    // which is what made "creating event C inherits event A" possible.
    let template: Record<string, unknown> | null = null;
    if (data.template_from) {
      const { data: t } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", data.template_from)
        .maybeSingle();
      template = (t as Record<string, unknown> | null) ?? null;
    }

    // Every inherited section is a full structural deep copy with regenerated
    // nested ids — no JSON object, array, or id is ever shared between rows.
    const copied = copyEventConfigSections(template);
    const tGeneral = (copied.general as Record<string, unknown> | undefined) ?? {};
    const tForm = (copied.form as Record<string, unknown> | undefined) ?? {};
    const tFormFields = Array.isArray(tForm.fields)
      ? (tForm.fields as Array<Record<string, unknown>>)
      : [];
    const isMultiDistrict = coverage?.type === "zone" || coverage?.type === "state";
    const hasDistrictField = tFormFields.some((f) => f.key === "district");
    let updatedFormFields: Array<Record<string, unknown>>;
    if (!hasDistrictField) {
      updatedFormFields = [
        ...tFormFields,
        {
          key: "district",
          type: isMultiDistrict ? "dropdown" : "text",
          label: "District",
          placeholder: isMultiDistrict ? "Select District" : "",
          required: true,
          enabled: true,
          readonly: !isMultiDistrict,
          builtin: true,
          order: 5,
          options: [],
          help: isMultiDistrict
            ? "Please select your district from the options available."
            : "District is automatically selected based on the active event.",
        },
      ];
    } else {
      updatedFormFields = tFormFields.map((f) => {
        if (f.key === "district") {
          return {
            ...f,
            type: isMultiDistrict ? "dropdown" : "text",
            readonly: !isMultiDistrict,
            required: true,
            enabled: true,
            hidden: false,
            builtin: true,
          };
        }
        return f;
      });
    }

    const insert: Record<string, unknown> = {
      ...copied,
      slug,
      is_active: activate,
      lifecycle_status: "upcoming",
      // New events start as drafts unless the admin explicitly activates them.
      // Templates always live as drafts (never public).
      publish_status: data.is_template ? "draft" : (activate ? "published" : "draft"),
      district: data.district ?? null,
      district_id: data.district_id ?? null,
      district_name: data.district_name ?? data.district ?? null,
      type: data.type ?? "district",
      description: data.description ?? null,
      event_date: data.event_date || null,
      event_time: data.event_time || null,
      registration_open_at: data.registration_open_at || null,
      registration_close_at: data.registration_close_at || null,
      venue: data.venue || null,
      is_template: !!data.is_template,
      template_category: data.template_category ?? null,
      // Coverage lives inside the `general` JSONB column (see mergeCoverage /
      // adminUpdateEventSection) — no dedicated coverage column required.
      general: {
        ...tGeneral,
        title: data.title,
        subtitle: data.subtitle ?? "",
        event_date: data.event_date ?? (tGeneral.event_date as string | null | undefined) ?? null,
        end_date: data.end_date ?? (tGeneral.end_date as string | null | undefined) ?? null,
        start_time: data.start_time ?? (tGeneral.start_time as string | null | undefined) ?? null,
        end_time: data.end_time ?? (tGeneral.end_time as string | null | undefined) ?? null,
        ...(coverage ? { coverage: coverage as unknown as Record<string, unknown> } : {}),
      },
      form: {
        ...tForm,
        fields: updatedFormFields,
      },
      // The legacy `live` JSONB section is retained in the DB but no longer
      // written to; physical camps do not stream.
      live: (copied.live as Record<string, unknown> | undefined) ?? {},
      // Identity is never inherited: each event mints its own registration
      // prefix and QR check-in is participant-scoped.
      qr_token: null,
    };

    const { data: row, error } = await supabaseAdmin
      .from("events")
      .insert(insert)
      .select("id, slug")
      .single();
    if (error) return { ok: false as const, error: error.message };
    // Clone child rows from the explicit template only (skip organisations —
    // organisations are event-specific).
    const sourceId = (template?.id as string | undefined) ?? null;
    if (sourceId) {
      await cloneEventChildren(sourceId, row.id, { includeOrganisations: false });
    }
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const, id: row.id, slug: row.slug };
  });

// ---------------- Duplicate ----------------
export const adminDuplicateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        as_template: z.boolean().optional(),
        template_category: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error: readErr } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !src) return { ok: false as const, error: "Event not found" };
    const general = (src.general ?? {}) as { title?: string };
    const suffix = data.as_template ? "(Template)" : "(Copy)";
    const newTitle = `${general.title ?? "Event"} ${suffix}`;
    const baseSlug = slugify(newTitle);
    let slug = baseSlug;
    let i = 1;
    while (true) {
      const { data: exists } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      i += 1;
      slug = `${baseSlug}-${i}`;
    }
    // FULL deep copy of every configuration section, with regenerated nested
    // ids. No JSON object or array is shared with the source event, so later
    // edits to either row can never affect the other.
    const copied = copyEventConfigSections(src as unknown as Record<string, unknown>);
    const insert = {
      ...copied,
      slug,
      is_active: false,
      lifecycle_status: "upcoming" as const,
      publish_status: "draft" as const,
      is_template: !!data.as_template,
      template_category: data.as_template ? (data.template_category ?? (src as { template_category?: string }).template_category ?? null) : null,
      district: src.district,
      district_id: (src as { district_id?: string | null }).district_id ?? null,
      district_name: (src as { district_name?: string | null }).district_name ?? null,
      type: (src as { type?: string }).type ?? "district",
      description: (src as { description?: string | null }).description ?? null,
      general: {
        ...((copySection("general", src.general ?? {}) ?? {}) as Record<string, unknown>),
        title: newTitle,
      },
      // Identity is never duplicated — the copy gets its own
      // participant-ID prefix (reg_prefix is assigned by trigger).
    };

    const { data: row, error } = await supabaseAdmin
      .from("events")
      .insert(insert)
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    // Clone child rows too. Duplicates get organisations copied (full copy);
    // template snapshots skip them (organisations are event-specific).
    await cloneEventChildren(data.id, row.id, {
      includeOrganisations: !data.as_template,
    });
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const, id: row.id };
  });

// ---------------- Restore (from archived → draft) ----------------
export const adminRestoreEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({
        publish_status: "draft",
        lifecycle_status: "upcoming",
        archived_at: null,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });


// ---------------- Activate ----------------
export const adminActivateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Trigger auto-deactivates others
    const { error } = await supabaseAdmin
      .from("events")
      .update({ is_active: true, archived_at: null })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Archive ----------------
export const adminArchiveEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({
        is_active: false,
        lifecycle_status: "archived",
        publish_status: "archived",
        archived_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Set publish status (Draft / Published / Archived) ----------------
export const adminSetEventPublishStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        publish_status: z.enum(["draft", "published", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { publish_status: data.publish_status };
    if (data.publish_status === "archived") {
      patch.is_active = false;
      patch.archived_at = new Date().toISOString();
    } else if (data.publish_status === "published") {
      patch.is_active = true;
      patch.archived_at = null;
    } else {
      // draft — keep archived_at cleared but do not force active
      patch.archived_at = null;
    }
    const { error } = await supabaseAdmin
      .from("events")
      .update(patch as never)
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });


// ---------------- Delete ----------------
export const adminDeleteEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Refuse if any registrations reference this event
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.id);
    if ((count ?? 0) > 0) {
      return {
        ok: false as const,
        error: `Cannot delete: ${count} registration(s) exist for this event. Archive it instead.`,
      };
    }
    const { error } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Update lifecycle status ----------------
export const adminSetEventStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        lifecycle_status: z.enum(["upcoming", "live", "completed", "cancelled", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({ lifecycle_status: data.lifecycle_status })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Assign a event to a district ----------------
export const adminSetEventDistrict = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        district_id: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({ district_id: data.district_id })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Admin ↔ Event Access ----------------

export const adminListAdminEventAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ admin_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("admin_event_access")
      .select("event_id")
      .eq("admin_user_id", data.admin_user_id);
    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      event_ids: (rows ?? []).map((r) => r.event_id as string),
    };
  });

export const adminSetAdminEventAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        admin_user_id: z.string().uuid(),
        event_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace the full grant set for this admin.
    const { error: delErr } = await supabaseAdmin
      .from("admin_event_access")
      .delete()
      .eq("admin_user_id", data.admin_user_id);
    if (delErr) return { ok: false as const, error: delErr.message };
    if (data.event_ids.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("admin_event_access")
        .insert(
          data.event_ids.map((wid) => ({
            admin_user_id: data.admin_user_id,
            event_id: wid,
          })),
        );
      if (insErr) return { ok: false as const, error: insErr.message };
    }
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// ---------------- Toggle template flag ----------------
export const adminSetEventTemplate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        is_template: z.boolean(),
        template_category: z.string().trim().max(80).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { is_template: data.is_template };
    if (data.template_category !== undefined) patch.template_category = data.template_category;
    const { error } = await supabaseAdmin
      .from("events")
      .update(patch as never)
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });
