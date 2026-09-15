import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import { mergeCoverage } from "@/lib/event-config";
import { mergeSectionObjects } from "@/lib/config-merge";

export { mergeSectionObjects };



// ---------------- Public config ----------------

export const getEventConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ district_slug: z.string().trim().min(1).max(80).optional() })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveEvent } = await import("@/lib/event-resolver.server");
    const resolved = await resolveEvent(data?.district_slug);
    return {
      config: stripAdminOnlyFields(resolved?.event ?? null),
      district_id: resolved?.district_id ?? null,
      district_slug: resolved?.district_slug ?? null,
      district_name: resolved?.district_name ?? null,
      // Event coverage + allowed district options for the public form.
      // Coverage is stored inside the `general` JSONB column — never rely on
      // a dedicated column that may not exist in the production DB.
      coverage: resolved?.event
        ? mergeCoverage(
            (resolved.event.general as { coverage?: unknown } | null)?.coverage,
            resolved.district_id ?? null,
          )
        : null,
      coverage_districts: resolved?.coverage_districts ?? null,
    };
  });

// ---------------- Public homepage: available events ----------------

// Minimal, secret-free column set for the public event selection landing
// page. Deliberately excludes qr_token / youtube_live_url / admin flags.
const PUBLIC_LIST_COLUMNS =
  "id, slug, district_id, district_name, district, event_date, event_time, venue, general, features, status, lifecycle_status, publish_status, archived_at, is_template, created_at";

/**
 * Events currently open for registration, for the public homepage cards.
 * Availability = published + non-template + not archived/cancelled +
 * registration feature enabled + inside the configured registration window.
 * No "latest event" / default / active-event fallbacks: the caller
 * renders exactly the events listed here, nothing else.
 */
export const listPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("events")
    .select(PUBLIC_LIST_COLUMNS as never)
    .eq("publish_status", "published")
    .eq("is_template", false)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message, rows: [] };

  const now = Date.now();
  const openRows = (rows ?? []).filter((r) => {
    const rec = r as unknown as {
      lifecycle_status?: string | null;
      features?: { registration?: boolean } | null;
      general?: { registration_open_at?: string | null; registration_close_at?: string | null } | null;
    };
    if (rec.lifecycle_status === "archived" || rec.lifecycle_status === "cancelled") return false;
    if (rec.features?.registration === false) return false;
    const g = rec.general ?? {};
    const openAt = g.registration_open_at ? new Date(g.registration_open_at).getTime() : null;
    const closeAt = g.registration_close_at ? new Date(g.registration_close_at).getTime() : null;
    if (openAt != null && Number.isFinite(openAt) && now < openAt) return false;
    if (closeAt != null && Number.isFinite(closeAt) && now > closeAt) return false;
    return true;
  });
  if (openRows.length === 0) return { ok: true as const, rows: [] };

  // Resolve district names for coverage (single id + zone id list) in one pass.
  const ids = new Set<string>();
  for (const r of openRows) {
    const rec = r as unknown as { district_id?: string | null; general?: { coverage?: { type?: string; district_ids?: string[] | null } } | null };
    if (rec.district_id) ids.add(rec.district_id);
    const cov = rec.general?.coverage;
    if (cov?.type === "zone" && Array.isArray(cov.district_ids)) {
      cov.district_ids.forEach((id) => ids.add(id));
    }
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
    rows: openRows.map((r) => {
      const rec = r as unknown as {
        id: string;
        slug: string | null;
        district_id?: string | null;
        district_name?: string | null;
        district?: string | null;
        event_date?: string | null;
        event_time?: string | null;
        venue?: string | null;
        general?: {
          title?: string;
          event_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          event_time?: string | null;
          venue?: string | null;
          venue_address?: string | null;
          coverage?: { type?: string; district_ids?: string[] | null } | null;
        } | null;
        status?: { value?: string } | null;
      };
      const g = rec.general ?? {};
      const cov = mergeCoverage(g.coverage, rec.district_id ?? null);
      let names: string[] = [];
      if (cov.type === "single") {
        const n = rec.district_id ? nameById.get(rec.district_id) : undefined;
        names = n ? [n] : rec.district_name ? [rec.district_name] : rec.district ? [rec.district] : [];
      } else if (cov.type === "zone") {
        names = (cov.district_ids ?? [])
          .map((id) => nameById.get(id))
          .filter((v): v is string => !!v);
      }
      return {
        id: rec.id,
        slug: rec.slug,
        title: g.title ?? "",
        event_date: g.event_date ?? rec.event_date ?? null,
        end_date: g.end_date ?? null,
        start_time: g.start_time ?? null,
        end_time: g.end_time ?? null,
        event_time: g.event_time ?? rec.event_time ?? null,
        venue: rec.venue ?? g.venue_address ?? g.venue ?? null,
        coverage_type: cov.type,
        coverage_district_names: names,
        district_id: rec.district_id ?? null,
        status: rec.status?.value ?? null,
      };
    }),
  };
});

// Never expose admin-only fields (secret live-session token, admin toggles)
// through public endpoints. Admin surfaces read the raw row via
// adminGetEventConfig instead.
export function stripAdminOnlyFields<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const clone: Record<string, unknown> = {};
  const allowed = [
    "id", "slug", "is_active", "is_template", "template_category",
    "lifecycle_status", "publish_status", "archived_at", "type",
    "description", "district", "district_id", "district_name",
    "event_date", "event_time", "registration_open_at",
    "registration_close_at", "max_registrations", "reg_prefix",
    "general", "features", "live", "attendance", "certificate",
    "referral", "whatsapp", "social", "status", "demo_mode",
    "form", "partner_form", "created_at", "updated_at"
  ];
  for (const key of allowed) {
    if (key in (row as Record<string, unknown>)) {
      clone[key] = (row as Record<string, unknown>)[key];
    }
  }
  return clone as T;
}

// (Event-level live tokens removed — QR identifiers now belong to
// participant registrations; see checkin.functions.ts.)



// ---------------- Admin ----------------

const sectionSchema = z.enum([
  "general",
  "features",
  "live",
  "attendance",
  "certificate",
  "referral",
  "whatsapp",
  "social",
  "status",
  "demo_mode",
  "form",
  "partner_form",
  "coverage",
  "venue",
]);

export const adminGetEventConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    // Enforce per-district scope: a view_admin can only read events in
    // their allowed set. Throws Forbidden if the requested id is out of scope.
    let filter;
    try {
      filter = await resolveEventFilter(session, data.event_id);
    } catch (e: any) {
      if (e.message === "Forbidden") return { ok: false as const, error: "Forbidden: You are not authorized to view this event." };
      throw e;
    }
    
    let q = supabaseAdmin.from("events").select("*");
    if (filter.mode === "single") {
      q = q.eq("id", filter.id);
    } else {
      q = q.eq("id", data.event_id);
    }
    
    const { data: row, error } = await q.maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!row) return { ok: false as const, error: "Event not found" };
    
    // Non-super-admins must never receive the secret live-session token —
    // strip it server-side, not just hidden in the UI.
    if (session.role !== "super_admin") {
      const sanitized = { ...(row as Record<string, unknown>) };
      delete sanitized.qr_token;
      delete sanitized.qr_token_disabled;
      delete sanitized.youtube_live_url;
      return { ok: true as const, config: sanitized as typeof row };
    }
    return { ok: true as const, config: row };
  });

export const adminUpdateEventSection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        section: sectionSchema,
        value: z.record(z.string(), z.any()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let value = data.value;
    const patch: Record<string, unknown> = {};

    if (data.section === "coverage") {
      // Coverage is stored INSIDE the existing `general` JSONB column so the
      // feature works without any schema migration (the production DB does
      // not have a dedicated coverage column). Read-modify-write: preserve
      // every other general key (title, dates, etc.) while replacing coverage.
      const raw = value as {
        type?: string;
        district_ids?: string[] | null;
        district_id?: string | null;
      };
      const coverage = mergeCoverage({
        type: raw.type,
        district_ids: raw.district_ids,
      });
      const { data: existing } = await supabaseAdmin
        .from("events")
        .select("general, form")
        .eq("id", data.id)
        .maybeSingle();
      const currentGeneral =
        (existing?.general as Record<string, unknown> | null) ?? {};
      patch.general = {
        ...currentGeneral,
        coverage: coverage as unknown as Record<string, unknown>,
      };
      if (coverage.type === "single") {
        const singleId =
          (Array.isArray(raw.district_ids) && raw.district_ids[0]) ||
          raw.district_id ||
          null;
        patch.district_id = singleId;
      } else {
        patch.district_id = null;
      }

      // Automatically sync form.fields to ensure the district field matches the coverage type
      const currentForm = (existing?.form as Record<string, unknown> | null) ?? {};
      const currentFields = Array.isArray(currentForm.fields)
        ? (currentForm.fields as Array<Record<string, unknown>>)
        : [];
      const hasDistrict = currentFields.some((f) => f.key === "district");
      let updatedFields: Array<Record<string, unknown>>;
      if (!hasDistrict) {
        updatedFields = [
          ...currentFields,
          {
            key: "district",
            type: coverage.type === "single" ? "text" : "dropdown",
            label: "District",
            required: true,
            enabled: true,
            readonly: coverage.type === "single",
            builtin: true,
            order: 5,
            options: [],
            help:
              coverage.type === "single"
                ? "District is automatically selected based on the active event."
                : "Please select your district from the options available.",
          },
        ];
      } else {
        updatedFields = currentFields.map((f) => {
          if (f.key === "district") {
            return {
              ...f,
              type: coverage.type === "single" ? "text" : "dropdown",
              readonly: coverage.type === "single",
              required: true,
              enabled: true,
              hidden: false,
              builtin: true,
            };
          }
          return f;
        });
      }
      patch.form = { ...currentForm, fields: updatedFields };
    } else if (data.section === "form") {
      // Ensure district field is never stripped or disabled when saving the form
      const incomingForm = value as Record<string, unknown>;
      const { data: existing } = await supabaseAdmin
        .from("events")
        .select("form, general")
        .eq("id", data.id)
        .maybeSingle();
      const currentGeneral = (existing?.general as Record<string, unknown> | null) ?? {};
      const currentCoverage = mergeCoverage(currentGeneral.coverage);
      const incomingFields = Array.isArray(incomingForm.fields)
        ? (incomingForm.fields as Array<Record<string, unknown>>)
        : [];
      const hasDistrict = incomingFields.some((f) => f.key === "district");
      let ensuredFields = incomingFields;
      if (!hasDistrict) {
        ensuredFields = [
          ...incomingFields,
          {
            key: "district",
            type: currentCoverage.type === "single" ? "text" : "dropdown",
            label: "District",
            required: true,
            enabled: true,
            readonly: currentCoverage.type === "single",
            builtin: true,
            order: 5,
            options: [],
            help:
              currentCoverage.type === "single"
                ? "District is automatically selected based on the active event."
                : "Please select your district from the options available.",
          },
        ];
      } else {
        ensuredFields = incomingFields.map((f) => {
          if (f.key === "district") {
            return {
              ...f,
              type: currentCoverage.type === "single" ? "text" : "dropdown",
              readonly: currentCoverage.type === "single",
              required: true,
              enabled: true,
              hidden: false,
              builtin: true,
            };
          }
          return f;
        });
      }
      patch.form = {
        ...((existing?.form as Record<string, unknown> | null) ?? {}),
        ...incomingForm,
        fields: ensuredFields,
      };
    } else if (data.section === "venue") {
      // Venue is a dedicated column on events (physical camp location).
      const venue = (value as { venue?: unknown }).venue;
      patch.venue =
        typeof venue === "string" ? venue.trim().slice(0, 300) || null : null;
    } else if (data.section === "general") {
      // Merge into the stored general object — this automatically preserves
      // the coverage key and any other keys not present in the client
      // snapshot, so editing title/dates can never erase the event's
      // coverage configuration.
      value = value as unknown as Record<string, unknown>;
      const { data: existing } = await supabaseAdmin
        .from("events")
        .select("general")
        .eq("id", data.id)
        .maybeSingle();
      const currentGeneral =
        (existing?.general as Record<string, unknown> | null) ?? {};
      patch.general = mergeSectionObjects(
        currentGeneral,
        value,
      ) as Record<string, unknown>;
    } else {
      // Merge the incoming snapshot into the stored section instead of
      // replacing it wholesale — sibling keys survive stale/concurrent saves.
      value = value as unknown as Record<string, unknown>;
      const { data: existing } = await supabaseAdmin
        .from("events")
        .select(data.section)
        .eq("id", data.id)
        .maybeSingle();
      const existingRow = (existing ?? {}) as Record<string, unknown>;
      const currentSection =
        (existingRow[data.section] as Record<string, unknown> | null) ?? {};
      patch[data.section] = mergeSectionObjects(currentSection, value);
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
