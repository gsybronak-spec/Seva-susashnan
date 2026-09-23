import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import { sortAdminEventsChronological } from "@/lib/event-config";

// Per-event Organisation list, used by the Partner form and the
// Organisations tab in the admin. Read is allowed for any admin scoped to
// the event; writes are super-admin only.

export const organisationList = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ event_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    await resolveEventFilter(session, data.event_id); // throws Forbidden if out of scope
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("event_organisations")
      .select("id, name, status, notes, created_at")
      .eq("event_id", data.event_id)
      .order("name", { ascending: true });
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });

export const organisationCreate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        name: z.string().trim().min(2).max(200),
        status: z.enum(["active", "inactive"]).default("active"),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_organisations").insert({
      event_id: data.event_id,
      name: data.name,
      status: data.status,
      notes: data.notes || null,
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) {
        return { ok: false as const, error: "That organisation already exists for this event." };
      }
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const organisationUpdate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(200),
        status: z.enum(["active", "inactive"]),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("event_organisations")
      .update({ name: data.name, status: data.status, notes: data.notes || null })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const organisationDelete = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("event_organisations")
      .delete()
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// Ensure a free-text organisation name exists in the event's list (called
// when Partner form submits a value that isn't in the dropdown).
export const organisationEnsure = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        name: z.string().trim().min(2).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const escapePostgREST = (str: string) => str.replace(/[%_\\]/g, '\\$&');
    const safeName = escapePostgREST(data.name);
    const { data: existing } = await supabaseAdmin
      .from("event_organisations")
      .select("id")
      .eq("event_id", data.event_id)
      .ilike("name", safeName)
      .maybeSingle();
    if (existing) return { ok: true as const, id: existing.id, created: false };
    const { data: row, error } = await supabaseAdmin
      .from("event_organisations")
      .insert({ event_id: data.event_id, name: data.name, status: "active" })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: row.id, created: true };
  });

// -------- Event overview cards --------
export const adminEventOverview = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("event_overview" as never);
  if (error) return { ok: false as const, error: error.message, rows: [] };
  type Row = {
    id: string;
    slug: string;
    is_active: boolean;
    lifecycle_status: string;
    publish_status: "draft" | "published" | "archived";

    title: string;
    district: string | null;
    district_name?: string | null;
    level?: string | null;
    venue?: string | null;
    event_date: string | null;
    event_time: string | null;
    registration_open_at: string | null;
    registration_close_at: string | null;
    created_at: string;
    registrations: number;
    today: number;
    joined_live: number;
    certificates_issued: number;
    partners: number;
    organisations: number;
  };
  let rows = (data as Row[] | null) ?? [];

  // Enrich with level, venue, and district_name from events table
  try {
    const { data: evMeta } = await supabaseAdmin
      .from("events")
      .select("id, general, venue, district_name");
    const metaMap = new Map<string, { level?: string; venue?: string; district_name?: string }>();
    for (const em of evMeta ?? []) {
      const lvl = (em.general as { level?: string } | null)?.level;
      metaMap.set(em.id, {
        level: lvl,
        venue: em.venue || undefined,
        district_name: em.district_name || undefined,
      });
    }
    rows = rows.map((r) => {
      const m = metaMap.get(r.id);
      return {
        ...r,
        level: m?.level || (r.title?.includes("મહાનગરપાલિકા") ? "Municipal" : "District"),
        venue: m?.venue || null,
        district_name: m?.district_name || r.district || null,
      };
    });
  } catch (enrichErr) {
    console.warn("[adminEventOverview] enrich meta error:", enrichErr);
  }

  // Scope to allowed events for viewer admins
  if (session.role !== "super_admin") {
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, null);
    if (filter.mode === "many") {
      const allowed = new Set(filter.ids);
      rows = rows.filter((r) => allowed.has(r.id));
    }
  }
  return { ok: true as const, rows: sortAdminEventsChronological(rows) };
});
