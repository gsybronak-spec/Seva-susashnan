import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import type { Json } from "@/integrations/supabase/types";

// ============================================================
// CAMPAIGNS — Gujarat State Yog Board → Campaigns → Events
// A campaign is a first-class entity (e.g. Seva Sushasan Abhiyan).
// Events, registrations and certificates belong to a campaign.
// ============================================================

export type CampaignTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
};

export type Campaign = {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  organizer: string | null;
  contact_info: string | null;
  logo_url: string | null;
  banner_url: string | null;
  theme: CampaignTheme;
  publish_status: "draft" | "published" | "archived";
  registration_status: "open" | "closed";
  seo_title: string | null;
  created_at: string;
  updated_at: string;
};

const CAMPAIGN_COLUMNS =
  "id, slug, name, slogan, description, start_date, end_date, venue, organizer, contact_info, logo_url, banner_url, theme, publish_status, registration_status, seo_title, created_at, updated_at";

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb color");

const campaignInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  slogan: z.string().trim().max(240).optional(),
  description: z.string().trim().max(4000).optional(),
  start_date: z.string().trim().max(10).optional(),
  end_date: z.string().trim().max(10).optional(),
  venue: z.string().trim().max(300).optional(),
  organizer: z.string().trim().max(200).optional(),
  contact_info: z.string().trim().max(400).optional(),
  logo_url: z.string().trim().max(500).optional(),
  banner_url: z.string().trim().max(500).optional(),
  seo_title: z.string().trim().max(160).optional(),
  theme: z
    .object({
      primaryColor: hexColor.optional(),
      secondaryColor: hexColor.optional(),
      accentColor: hexColor.optional(),
      backgroundColor: hexColor.optional(),
      textColor: hexColor.optional(),
      buttonColor: hexColor.optional(),
    })
    .optional(),
  publish_status: z.enum(["draft", "published", "archived"]).optional(),
  registration_status: z.enum(["open", "closed"]).optional(),
});

// ---------------- Public: list published campaigns ----------------
export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message, campaigns: [] };
  // Event counts per campaign for the public listing.
  const campaigns = (data ?? []) as unknown as Campaign[];
  let counts = new Map<string, number>();
  if (campaigns.length) {
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("campaign_id")
      .not("campaign_id", "is", null)
      .in("campaign_id", campaigns.map((c) => c.id));
    counts = new Map<string, number>();
    for (const e of ev ?? []) {
      const id = (e as { campaign_id: string }).campaign_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return {
    ok: true as const,
    campaigns: campaigns.map((c) => ({ ...c, event_count: counts.get(c.id) ?? 0 })),
  };
});

// ---------------- Public: get one campaign by slug ----------------
export const getCampaignBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80).toLowerCase() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    const campaign = row as unknown as Campaign | null;
    if (!campaign || campaign.publish_status === "archived") {
      return { ok: false as const, error: "Campaign not found" };
    }
    // Draft campaigns are visible only to signed-in admins (preview).
    if (campaign.publish_status === "draft") {
      try {
        await requireAdmin();
      } catch {
        return { ok: false as const, error: "Campaign not found" };
      }
    }
    // Campaign events (published, not templates) for the campaign page.
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, slug, general, publish_status, lifecycle_status")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false });
    const eventRows = (events ?? []) as unknown as Array<{
      id: string;
      slug: string;
      general: { title?: string; event_date?: string | null; subtitle?: string } | null;
      publish_status: string;
      lifecycle_status: string;
    }>;
    return {
      ok: true as const,
      campaign,
      events: eventRows
        .filter((e) => e.publish_status === "published" && e.lifecycle_status !== "archived")
        .map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.general?.title ?? e.slug,
          subtitle: e.general?.subtitle ?? "",
          event_date: e.general?.event_date ?? null,
        })),
    };
  });

// ---------------- Admin: list all campaigns ----------------
export const adminListCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message, campaigns: [] as Campaign[] };
  return { ok: true as const, campaigns: ((data ?? []) as unknown as Campaign[]) };
});

// ---------------- Admin: create campaign ----------------
export const adminCreateCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => campaignInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "A campaign with this slug already exists." };
    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        slug: data.slug,
        name: data.name,
        slogan: data.slogan ?? null,
        description: data.description ?? null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        venue: data.venue ?? null,
        organizer: data.organizer ?? null,
        contact_info: data.contact_info ?? null,
        logo_url: data.logo_url ?? null,
        banner_url: data.banner_url ?? null,
        seo_title: data.seo_title ?? null,
        theme: data.theme ?? {},
        publish_status: data.publish_status ?? "draft",
        registration_status: data.registration_status ?? "closed",
      })
      .select("id, slug")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, campaign: row };
  });

// ---------------- Admin: update campaign ----------------
export const adminUpdateCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .extend(campaignInputSchema.partial().shape)
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) {
      const { data: clash } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.id)
        .maybeSingle();
      if (clash) return { ok: false as const, error: "Another campaign already uses this slug." };
      patch.slug = data.slug;
    }
    for (const key of [
      "slogan", "description", "venue", "organizer", "contact_info",
      "logo_url", "banner_url", "seo_title",
    ] as const) {
      if (data[key] !== undefined) patch[key] = data[key] || null;
    }
    if (data.start_date !== undefined) patch.start_date = data.start_date || null;
    if (data.end_date !== undefined) patch.end_date = data.end_date || null;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.publish_status !== undefined) patch.publish_status = data.publish_status;
    if (data.registration_status !== undefined) patch.registration_status = data.registration_status;

    const { error } = await supabaseAdmin.from("campaigns").update(patch as never).eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Admin: duplicate (clone) a campaign ----------------
export const adminDuplicateCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!src) return { ok: false as const, error: "Campaign not found." };
    const s = src as Record<string, unknown>;
    // Derive a unique slug: base-copy, base-copy-2, ...
    let slug = `${s.slug as string}-copy`;
    for (let n = 2; ; n++) {
      const { data: clash } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${s.slug as string}-copy-${n}`;
    }
    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        slug,
        name: `${s.name as string} (Copy)`,
        slogan: s.slogan as string | null,
        description: s.description as string | null,
        start_date: s.start_date as string | null,
        end_date: s.end_date as string | null,
        venue: s.venue as string | null,
        organizer: s.organizer as string | null,
        contact_info: s.contact_info as string | null,
        logo_url: s.logo_url as string | null,
        banner_url: s.banner_url as string | null,
        seo_title: s.seo_title as string | null,
        theme: (s.theme ?? {}) as NonNullable<Json>,
        // Clones always start as unpublished drafts.
        publish_status: "draft",
        registration_status: "closed",
      })
      .select("id, slug")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, campaign: row };
  });

// ---------------- Admin: archive / delete ----------------
export const adminArchiveCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ publish_status: "archived", registration_status: "closed", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Safe delete only: a campaign with events or registrations can never be
    // deleted — archive it instead. This protects the audit trail.
    const { count: evCount } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.id);
    const { count: regCount } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.id);
    if ((evCount ?? 0) > 0 || (regCount ?? 0) > 0) {
      return {
        ok: false as const,
        error: `This campaign has ${evCount ?? 0} event(s) and ${regCount ?? 0} registration(s). Archive it instead of deleting.`,
      };
    }
    const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Admin: upload campaign media ----------------
// Uploads a logo/banner/hero image to the public `campaign-media` storage
// bucket and returns its public URL. Primary path for campaign branding;
// manual URL entry remains available as a secondary option.
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export const adminUploadCampaignImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        fileName: z.string().trim().min(1).max(200),
        contentType: z.string().trim().min(3).max(100),
        // Base64 payload — server functions are JSON-transported.
        dataBase64: z.string().max(8 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const ext = UPLOAD_TYPES[data.contentType];
    if (!ext) {
      return { ok: false as const, error: "Unsupported image type. Use PNG, JPG, WebP or SVG." };
    }
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.length === 0) return { ok: false as const, error: "Empty file." };
    if (bytes.length > UPLOAD_MAX_BYTES) {
      return { ok: false as const, error: "Image is larger than 5 MB." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Path layout: campaigns/<slug-or-id>-<purpose>-<random><ext>
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("campaign-media")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) return { ok: false as const, error: `Upload failed: ${upErr.message}` };
    const { data: pub } = supabaseAdmin.storage.from("campaign-media").getPublicUrl(path);
    if (!pub?.publicUrl) return { ok: false as const, error: "Upload succeeded but the public URL could not be generated." };
    return { ok: true as const, url: pub.publicUrl };
  });
