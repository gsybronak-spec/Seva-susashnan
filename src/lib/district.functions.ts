import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";



// ------------------------- Public ---------------------------

// List districts whose registration is open — used by the legacy /register,
// /live, /certificate picker pages.
export const listOpenDistricts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: districts, error } = await supabaseAdmin
    .from("districts")
    .select("id, slug, name, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { ok: false as const, error: error.message, rows: [] };

  const ids = (districts ?? []).map((d) => d.id);
  if (ids.length === 0) return { ok: true as const, rows: [] };

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, district_id, is_active, publish_status, lifecycle_status, general, features, status")
    .in("district_id", ids)
    .eq("publish_status", "published")
    .eq("is_template", false)
    .order("updated_at", { ascending: false });


  // Newest active event per district
  type EventLite = NonNullable<typeof events>[number];
  const byDistrict = new Map<string, EventLite>();
  for (const w of events ?? []) {
    if (w.district_id && !byDistrict.has(w.district_id)) {
      byDistrict.set(w.district_id, w);
    }
  }

  const rows = (districts ?? []).map((d) => {
    const w = byDistrict.get(d.id);
    const g = (w?.general ?? {}) as {
      title?: string;
      event_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
    };
    const f = (w?.features ?? {}) as { registration?: boolean; live?: boolean };
    const s = (w?.status ?? {}) as { value?: string };
    return {
      slug: d.slug,
      name: d.name,
      event_id: w?.id ?? null,
      event_title: g.title ?? "",
      event_date: g.event_date ?? null,
      start_time: g.start_time ?? null,
      end_time: g.end_time ?? null,
      registration_open: !!(w && f.registration !== false),
      live_open: !!(w && f.live && s.value === "live"),
      lifecycle_status: w?.lifecycle_status ?? "upcoming",
    };
  });

  return { ok: true as const, rows };
});

// Get district metadata by slug (used by the $district layout to validate + render).
export const getDistrictBySlug = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80).toLowerCase() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin
      .from("districts")
      .select("id, slug, name, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!d) return { ok: false as const, error: "District not found." };
    return { ok: true as const, district: d };
  });

// ------------------------- Admin ---------------------------

const districtInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens.")
    .transform((v) => v.toLowerCase()),
  name: z.string().trim().min(2).max(120),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});

export const adminListDistricts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("districts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message, rows: [] };

  const ids = (rows ?? []).map((d) => d.id);
  const counts = new Map<string, number>();
  const events = new Map<
    string,
    { id: string; is_active: boolean; general: Record<string, unknown> | null; features: Record<string, unknown> | null }
  >();

  if (ids.length) {
    const { data: regRows } = await supabaseAdmin
      .from("registrations")
      .select("district_id")
      .in("district_id", ids);
    for (const r of regRows ?? []) {
      const k = r.district_id as string | null;
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const { data: wRows } = await supabaseAdmin
      .from("events")
      .select("id, district_id, is_active, general, features, updated_at")
      .in("district_id", ids)
      .order("updated_at", { ascending: false });
    for (const w of wRows ?? []) {
      const k = w.district_id as string | null;
      if (!k) continue;
      if (!events.has(k)) {
        events.set(k, {
          id: w.id,
          is_active: !!w.is_active,
          general: (w.general ?? {}) as Record<string, unknown> | null,
          features: (w.features ?? {}) as Record<string, unknown> | null,
        });
      }
    }
  }

  return {
    ok: true as const,
    rows: (rows ?? []).map((d) => {
      const w = events.get(d.id);
      return {
        ...d,
        registration_count: counts.get(d.id) ?? 0,
        event_id: w?.id ?? null,
        event_is_active: !!w?.is_active,
        event_title: (w?.general as { title?: string } | null)?.title ?? "",
        registration_open: !!(w && (w.features as { registration?: boolean } | null)?.registration !== false),
      };
    }),
  };
});

export const adminCreateDistrict = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => districtInput.parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("districts")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "A district with this slug already exists." };
    const { data: row, error } = await supabaseAdmin
      .from("districts")
      .insert({
        slug: data.slug,
        name: data.name,
        is_active: data.is_active ?? true,
        sort_order: data.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const, id: row.id };
  });

export const adminUpdateDistrict = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).merge(districtInput.partial()).parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    // Uniqueness check when slug changes
    if (fields.slug) {
      const { data: dup } = await supabaseAdmin
        .from("districts")
        .select("id")
        .eq("slug", fields.slug)
        .neq("id", id)
        .maybeSingle();
      if (dup) return { ok: false as const, error: "Another district already uses this slug." };
    }
    const { error } = await supabaseAdmin
      .from("districts")
      .update({
        ...(fields.slug !== undefined ? { slug: fields.slug } : {}),
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.is_active !== undefined ? { is_active: fields.is_active } : {}),
        ...(fields.sort_order !== undefined ? { sort_order: fields.sort_order } : {}),
      })
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

export const adminDeleteDistrict = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Refuse if any registrations reference this district — protects historical data.
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("district_id", data.id);
    if ((count ?? 0) > 0) {
      return {
        ok: false as const,
        error: `Cannot delete: ${count} registration(s) are attached to this district. Disable it instead.`,
      };
    }
    // Also refuse if any events are attached (ON DELETE RESTRICT would fail anyway).
    const { count: wc } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("district_id", data.id);
    if ((wc ?? 0) > 0) {
      return {
        ok: false as const,
        error: `Cannot delete: ${wc} event(s) are attached to this district. Reassign or delete them first.`,
      };
    }
    const { error } = await supabaseAdmin.from("districts").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// Toggle registration open/closed for an EXPLICIT event. The caller must
// always identify the exact event — never "the most recent event for the
// district", which could target the wrong row when a district has several.
export const adminSetDistrictRegistrationOpen = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        open: z.boolean(),
        // Optional cross-check: when provided, the event must actually
        // belong to this district.
        district_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: w } = await supabaseAdmin
      .from("events")
      .select("id, district_id, features")
      .eq("id", data.event_id)
      .maybeSingle();
    if (!w) return { ok: false as const, error: "Event not found." };
    if (data.district_id && w.district_id !== data.district_id) {
      return { ok: false as const, error: "Event does not belong to this district." };
    }
    const cur = (w.features ?? {}) as Record<string, unknown>;
    const nextFeatures = { ...cur, registration: data.open };
    const { error } = await supabaseAdmin
      .from("events")
      .update({ features: nextFeatures })
      .eq("id", w.id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });
