import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";

const partnerInput = z.object({
  partner_name: z.string().trim().min(2).max(160),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  organizations: z.array(z.string().trim().max(200)).max(50).optional(),
  contact_person: z.string().trim().max(160).optional().or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  district: z.string().trim().max(120).optional().or(z.literal("")),
  taluka: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
  event_id: z.string().uuid().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

function sanitizeCustomFields(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length === 0 || k.length > 80) continue;
    if (val === undefined) continue;
    out[k] = val;
  }
  if (JSON.stringify(out).length > 16000) throw new Error("custom_fields too large");
  return out;
}

function normaliseOrgs(data: {
  organizations?: string[];
  organization?: string;
}): { orgs: string[]; legacy: string | null } {
  const arr = Array.from(
    new Set(
      (data.organizations ?? (data.organization ? [data.organization] : []))
        .map((s) => (s ?? "").trim())
        .filter(Boolean),
    ),
  );
  const legacy = arr.length ? arr.join(", ") : null;
  return { orgs: arr, legacy };
}

function makeSlug(): string {
  // 8-char alphanumeric (upper) — avoids ambiguous chars.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (const b of arr) out += alphabet[b % alphabet.length];
  return out;
}


async function ensurePartnerAccess() {
  // Super admin OR viewer admin with can_view_partners
  const s = await requireAdmin();
  if (s.role === "super_admin") return s;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("can_view_partners")
    .eq("id", s.userId!)
    .maybeSingle();
  if (!data?.can_view_partners) throw new Error("Forbidden");
  return s;
}

// Verifies that `partner_id` belongs to a event the caller may access.
async function assertPartnerInScope(
  session: Awaited<ReturnType<typeof requireAdmin>>,
  partnerId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("partners")
    .select("event_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (!p) throw new Error("Partner not found");
  const { resolveEventFilter } = await import("@/lib/admin-scope.server");
  await resolveEventFilter(session, (p as { event_id: string | null }).event_id ?? null);
}


export const partnerList = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ event_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
  const session = await ensurePartnerAccess();
  const { resolveEventFilter } = await import("@/lib/admin-scope.server");
  const filter = await resolveEventFilter(session, data.event_id ?? null);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("partners").select("*").order("created_at", { ascending: false });
  if (filter.mode === "single") q = q.eq("event_id", filter.id);
  else if (filter.mode === "many") {
    if (filter.ids.length === 0) return { ok: true as const, rows: [] };
    q = q.in("event_id", filter.ids);
  }
  const { data: rowsData, error } = await q;
  if (error) return { ok: false as const, error: error.message, rows: [] };

  // Attach registration counts
  const ids = (rowsData ?? []).map((p) => p.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: regs } = await supabaseAdmin
      .from("registrations")
      .select("partner_id")
      .in("partner_id", ids);
    (regs ?? []).forEach((r) => {
      const k = r.partner_id as string;
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  }
  return {
    ok: true as const,
    rows: (rowsData ?? []).map((p) => ({ ...p, registration_count: counts.get(p.id) ?? 0 })),
  };
});

export const partnerCreate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => partnerInput.parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Generate a unique slug (retry a couple of times)
    let slug = makeSlug();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin
        .from("partners")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = makeSlug();
    }
    // Resolve district_id from event (if event has one) so partner_lookup
    // and the district-scoped URL keep working.
    let districtId: string | null = null;
    if (data.event_id) {
      const { data: w } = await supabaseAdmin
        .from("events").select("district_id").eq("id", data.event_id).maybeSingle();
      districtId = ((w ?? {}) as { district_id?: string | null }).district_id ?? null;
    }
    if (!data.event_id) {
      return { ok: false as const, error: "event_id is required" };
    }
    const { orgs, legacy } = normaliseOrgs(data);
    const custom = sanitizeCustomFields(data.custom_fields);
    const { error } = await supabaseAdmin.from("partners").insert({
      slug,
      partner_name: data.partner_name,
      organization: legacy,
      organizations: orgs,
      contact_person: data.contact_person || null,
      mobile: data.mobile || null,
      email: data.email || null,
      district: data.district || null,
      taluka: data.taluka || null,
      status: data.status,
      event_id: data.event_id,
      district_id: districtId,
      custom_fields: custom,
    } as never);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, slug };
  });

export const partnerUpdate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).merge(partnerInput).parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const { orgs, legacy } = normaliseOrgs(fields);
    const custom = sanitizeCustomFields(fields.custom_fields);
    const updates: Record<string, unknown> = {
      partner_name: fields.partner_name,
      organization: legacy,
      organizations: orgs,
      contact_person: fields.contact_person || null,
      mobile: fields.mobile || null,
      email: fields.email || null,
      district: fields.district || null,
      taluka: fields.taluka || null,
      status: fields.status,
      custom_fields: custom,
    };
    if (fields.event_id) {
      updates.event_id = fields.event_id;
      const { data: w } = await supabaseAdmin
        .from("events").select("district_id").eq("id", fields.event_id).maybeSingle();
      updates.district_id = ((w ?? {}) as { district_id?: string | null }).district_id ?? null;
    }
    const { error } = await supabaseAdmin
      .from("partners")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updates as any)
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    // Keep partner_name on existing registrations in sync
    await supabaseAdmin
      .from("registrations")
      .update({ partner_name: fields.partner_name })
      .eq("partner_id", id);
    return { ok: true as const };
  });

export const partnerDelete = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partners").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const partnerSetStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const partnerSetLinkDisabled = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ link_disabled: data.disabled })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const partnerRegenerateSlug = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let slug = makeSlug();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin
        .from("partners")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = makeSlug();
    }
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ slug })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, slug };
  });

export const partnerStats = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const session = await ensurePartnerAccess();
    await assertPartnerInScope(session, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: stats, error } = await supabaseAdmin.rpc(
      "partner_stats" as never,
      { _partner_id: data.id } as never,
    );
    if (error) return { ok: false as const, error: error.message };
    const s = (stats ?? {}) as {
      total?: number;
      today?: number;
      byGender?: Record<string, number>;
      byAgeGroup?: Record<string, number>;
      byDistrict?: Record<string, number>;
      byDay?: Array<{ date: string; count: number }>;
    };
    return {
      ok: true as const,
      total: s.total ?? 0,
      today: s.today ?? 0,
      byGender: s.byGender ?? {},
      byAgeGroup: s.byAgeGroup ?? {},
      byDistrict: s.byDistrict ?? {},
      byDay: s.byDay ?? [],
    };
  });


export const partnerRegistrations = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        search: z.string().trim().max(120).optional().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const session = await ensurePartnerAccess();
    await assertPartnerInScope(session, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const PAGE = 1000;
    type Reg = {
      id: string;
      registration_number: string;
      full_name: string;
      mobile: string;
      gender: string | null;
      date_of_birth: string | null;
      age: number | null;
      age_group: string | null;
      village: string | null;
      taluka: string | null;
      district: string | null;
      designation: string | null;
      partner_id: string | null;
      partner_name: string | null;
      referral_code: string;
      referred_by: string | null;
      certificate_available: boolean;
      created_at: string;
    };

    // Helper to prevent PostgREST ilike injection
    const escapePostgREST = (str: string) => str.replace(/[%_\\]/g, '\\$&');

    const MAX_ADMIN_LIST_ROWS = 10000;
    const s = (data.search ?? "").trim();
    const safeSearch = escapePostgREST(s);

    const rows: Reg[] = [];
    let truncated = false;
    for (let from = 0; ; from += PAGE) {
      if (rows.length >= MAX_ADMIN_LIST_ROWS) {
        truncated = true;
        break;
      }
      let q = supabaseAdmin
        .from("registrations")
        .select(
          "id, registration_number, full_name, mobile, gender, date_of_birth, age, age_group, village, taluka, district, designation, partner_id, partner_name, referral_code, referred_by, certificate_available, created_at",
        )
        .eq("partner_id", data.id)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (safeSearch) {
        q = q.or(
          `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%`,
        );
      }
      const { data: page, error } = await q;
      if (error) return { ok: false as const, error: error.message, rows: [] as Reg[], truncated: false };
      if (!page || page.length === 0) break;
      rows.push(...(page as Reg[]));
      if (page.length < PAGE) break;
    }

    if (truncated) {
      let qCheck = supabaseAdmin
        .from("registrations")
        .select("id")
        .eq("partner_id", data.id)
        .order("created_at", { ascending: false })
        .range(MAX_ADMIN_LIST_ROWS, MAX_ADMIN_LIST_ROWS)
        .limit(1);
      if (safeSearch) {
        qCheck = qCheck.or(
          `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%`,
        );
      }
      const { data: extra } = await qCheck;
      if (!extra || extra.length === 0) {
        truncated = false;
      }
    }

    return { ok: true as const, rows, truncated };
  });


// Public: look up partner by slug for the registration form.
export const partnerLookup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ slug: z.string().trim().min(4).max(32) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("partners")
      .select("id, slug, partner_name, status, link_disabled, district_id, event_id")
      .eq("slug", data.slug.toUpperCase())
      .maybeSingle();
    if (!p) return { ok: false as const, error: "Partner link not found." };
    if (p.status !== "active" || p.link_disabled) {
      return { ok: false as const, error: "This partner link is no longer active." };
    }
    // Public routing is event-slug first. Fall back to the old district slug
    // only for legacy partner rows that predate event_id scoping.
    let district_slug: string | null = null;
    if ((p as { event_id?: string | null }).event_id) {
      const { data: w } = await supabaseAdmin
        .from("events")
        .select("slug")
        .eq("id", (p as { event_id: string }).event_id)
        .maybeSingle();
      district_slug = w?.slug ?? null;
    }
    if (!district_slug && p.district_id) {
      const { data: d } = await supabaseAdmin
        .from("districts")
        .select("slug")
        .eq("id", p.district_id)
        .maybeSingle();
      district_slug = d?.slug ?? null;
    }
    return {
      ok: true as const,
      partner_id: p.id,
      slug: p.slug,
      partner_name: p.partner_name,
      district_id: p.district_id,
      event_id: (p as { event_id?: string | null }).event_id ?? null,
      district_slug,
    };
  });
