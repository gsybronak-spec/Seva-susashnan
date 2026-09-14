// Server-only helper: resolves a public microsite slug (optional) to its
// published event row. Backward compatible: when no slug is given, falls
// back to the "junagadh" microsite.
//
// Hot-path caching: public routes (register, home, live) hit these resolvers
// on every request. To survive thousands of concurrent viewers without
// hammering Postgres, we add a very short in-memory TTL cache per worker
// isolate plus in-flight request deduplication. Content changes are rare
// (admins toggle features occasionally), so 10-15s staleness is acceptable
// and dramatically reduces `SELECT * FROM events` load — the top
// slow query in production.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeCoverage, type CoverageDistrict } from "@/lib/event-config";
import { BRAND } from "@/lib/brand";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResolvedEvent = {
  district_id: string | null;
  district_slug: string | null;
  district_name: string | null;
  // Districts the participant may select for this event (zone/state coverage).
  // null for single-district events — the effective district is district_id.
  coverage_districts: CoverageDistrict[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any;
};

// ---- Tiny TTL cache + single-flight ----
type CacheEntry<T> = { value: T; expires: number };
// 5s: bounds cross-isolate staleness. Writes also clear this isolate's cache
// via invalidatePublicEventCache().
const CACHE_TTL_MS = 5_000;
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Explicit allow-list of events columns that are safe to resolve for
// public surfaces. Secret/admin-only columns (qr_token, qr_token_disabled)
// are deliberately NEVER selected here, so they cannot leak through any public
// server function even by accident. Admin surfaces read the raw row through
// supabaseAdmin in the admin server functions instead.
const PUBLIC_EVENT_COLUMNS = [
  "id",
  "slug",
  "is_active",
  "is_template",
  "template_category",
  "lifecycle_status",
  "publish_status",
  "archived_at",
  "type",
  "description",
  "district",
  "district_id",
  "district_name",
  "event_date",
  "event_time",
  "registration_open_at",
  "registration_close_at",
  "max_registrations",
  "reg_prefix",
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
  "created_at",
  "updated_at",
].join(", ");
// Note: `coverage` is deliberately NOT a selected column — it lives inside the
// `general` JSONB column (present in every production DB). Selecting a
// dedicated coverage column here would break public pages on databases where
// the Phase-1 migration was never applied.

// (Event-level live-token columns removed — QR identifiers belong to
// participant registrations now. See checkin.functions.ts.)



// Any admin write to events (or districts) must drop the public
// resolver cache immediately, otherwise public pages keep serving the old
// configuration for up to CACHE_TTL_MS. Entries are cheap to rebuild, so we
// clear the whole map rather than trying to map a event_id back to every
// slug/token key that could reference it.
export function invalidatePublicEventCache(): void {
  cache.clear();
  inflight.clear();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = (async () => {
    try {
      const value = await load();
      cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Resolve the published event that belongs to ONE specific district.
// `districtId` is required: there is deliberately no "any published event"
// query, so a public page can never render a event it did not ask for.
async function fetchPublishedEventForDistrictId(
  districtId: string,
): Promise<ResolvedEvent["event"] | null> {
  const { data } = await supabaseAdmin
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("district_id", districtId)
    .eq("publish_status", "published")
    .eq("is_template", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as ResolvedEvent["event"] | null) ?? null;
}

async function fetchPublishedEventForSlug(slug: string): Promise<ResolvedEvent | null> {
  const { data: w } = await supabaseAdmin
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("slug", slug)
    .eq("publish_status", "published")
    .eq("is_template", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!w) return null;

  let district: { id: string; slug: string | null; name: string | null } | null = null;
  if ((w as unknown as { district_id?: string | null }).district_id) {
    const { data: d } = await supabaseAdmin
      .from("districts")
      .select("id, slug, name")
      .eq("id", (w as unknown as { district_id: string }).district_id)
      .maybeSingle();
    district = d ?? null;
  }

  const row = w as unknown as ResolvedEvent["event"] & {
    district_id?: string | null;
    district_name?: string | null;
    district?: string | null;
    slug?: string | null;
  };

  const cleanDistrictName =
    district?.name ??
    (row.district_name && !/^event[-_0-9]/i.test(row.district_name) && !/-zone$/i.test(row.district_name)
      ? row.district_name
      : null);

  return {
    district_id: district?.id ?? row.district_id ?? null,
    district_slug: district?.slug ?? null,
    district_name: cleanDistrictName,
    coverage_districts: await resolveEventCoverageDistricts(w),
    event: w,
  };
}

/**
 * Resolve the districts a participant may select for a event, based on its
 * coverage:
 *   single → null (no dropdown; the event's own district_id applies)
 *   zone   → exactly the configured district_ids
 *   state  → all active districts
 * Cached together with the event row (same cache entry, single-flight), and
 * dropped whenever invalidatePublicEventCache() runs.
 */
async function resolveEventCoverageDistricts(
  event: ResolvedEvent["event"],
): Promise<CoverageDistrict[] | null> {
  const row = event as {
    general?: { coverage?: unknown } | null;
    coverage?: unknown;
    district_id?: string | null;
  };
  const coverage = mergeCoverage(
    row.general?.coverage ?? row.coverage,
    row.district_id ?? null,
  );
  if (coverage.type === "single") return null;

  let q = supabaseAdmin
    .from("districts")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (coverage.type === "zone") {
    const ids = coverage.district_ids ?? [];
    if (ids.length === 0) return [];
    q = q.in("id", ids);
  }
  const { data } = await q;
  return (data ?? []) as CoverageDistrict[];
}

export async function resolveEvent(
  districtSlug?: string | null,
): Promise<ResolvedEvent | null> {
  const slug = (districtSlug ?? "").trim().toLowerCase();
  const key = `district:${slug || "__default__"}`;
  return cached(key, async () => {
    if (slug) {
      const byEventSlug = await fetchPublishedEventForSlug(slug);
      if (byEventSlug) return byEventSlug;

      const { data: d } = await supabaseAdmin
        .from("districts")
        .select("id, slug, name, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (!d) return null;
      const w = await fetchPublishedEventForDistrictId(d.id);
      if (!w) return null;
      return {
        district_id: d.id,
        district_slug: slug,
        district_name: d.name,
        coverage_districts: await resolveEventCoverageDistricts(w),
        event: w,
      };
    }

    // No slug given: the ONLY accepted resolution is the explicit default
    // microsite slug (BRAND.defaultMicrositeSlug) that the legacy top-level
    // routes map to. There is no active-event, latest-event or any-event
    // fallback — an unresolved request returns null rather than someone
    // else's event.
    const byDefaultSlug = await fetchPublishedEventForSlug(BRAND.defaultMicrositeSlug);
    if (byDefaultSlug) return byDefaultSlug;

    const { data: def } = await supabaseAdmin
      .from("districts")
      .select("id, slug, name")
      .eq("slug", BRAND.defaultMicrositeSlug)
      .maybeSingle();
    if (!def) return null;

    const w = await fetchPublishedEventForDistrictId(def.id);
    if (!w) return null;
    return {
      district_id: def.id,
      district_slug: def.slug,
      district_name: def.name,
      coverage_districts: await resolveEventCoverageDistricts(w),
      event: w,
    };
  });
}
