import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import type { Json } from "@/integrations/supabase/types";
import { YOG_SNEH_MILAN_BRANDING, isYogSnehMilanCampaign } from "@/lib/campaign-branding";

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
  event_count?: number;
  registration_count?: number;
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

  const rawList = (data ?? []) as unknown as Campaign[];
  const enriched = await Promise.all(
    rawList.map(async (c) => {
      const [{ count: evCount }, { count: regCount }] = await Promise.all([
        supabaseAdmin
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .neq("publish_status", "archived"),
        supabaseAdmin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id),
      ]);
      return {
        ...c,
        event_count: evCount ?? 0,
        registration_count: regCount ?? 0,
      };
    })
  );

  // Sort active running campaigns first: published -> open -> highest registrations -> newest
  enriched.sort((a, b) => {
    const aPub = a.publish_status === "published" ? 1 : 0;
    const bPub = b.publish_status === "published" ? 1 : 0;
    if (aPub !== bPub) return bPub - aPub;

    const aOpen = a.registration_status === "open" ? 1 : 0;
    const bOpen = b.registration_status === "open" ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;

    const aReg = a.registration_count || 0;
    const bReg = b.registration_count || 0;
    if (aReg !== bReg) return bReg - aReg;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { ok: true as const, campaigns: enriched };
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

    const publishStatus = data.publish_status ?? "published";
    const regStatus = data.registration_status ?? "open";

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
        publish_status: publishStatus,
        registration_status: regStatus,
      })
      .select("id, slug")
      .single();
    if (error) return { ok: false as const, error: error.message };

    // Automatically create a primary event under this campaign so registration works out of the box
    try {
      const isSneh = isYogSnehMilanCampaign({
        campaignSlug: data.slug,
        campaignName: data.name,
      });

      await supabaseAdmin.from("events").insert({
        campaign_id: row.id,
        slug: data.slug,
        type: "state",
        district: data.venue || "Gujarat",
        district_name: data.venue || "Gujarat",
        publish_status: publishStatus,
        lifecycle_status: "upcoming",
        is_active: true,
        reg_prefix: (data.slug.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "") || "EVT"),
        general: {
          title: isSneh ? YOG_SNEH_MILAN_BRANDING.line3 : data.name,
          subtitle: isSneh ? YOG_SNEH_MILAN_BRANDING.line2 : data.slogan || "Gujarat State Yog Board",
          theme: isSneh ? YOG_SNEH_MILAN_BRANDING.line3 : data.slogan || data.name,
          description: isSneh
            ? "ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા આયોજિત યોગ સ્નેહમિલન કાર્યક્રમ"
            : data.description || `${data.name} organized by Gujarat State Yog Board.`,
          banner_url: data.banner_url || "",
          registration_enabled: regStatus === "open",
          registration_mode: "online",
          level: "State",
          coverage: { type: "state" },
        },
        features: {
          registration: regStatus === "open",
          attendance: true,
          certificate: true,
          referral: true,
          footer: true,
        },
        form: {
          version: 2,
          fields: [
            {
              key: "full_name",
              type: "text",
              label: "Full Name / પૂરું નામ",
              order: 1,
              hidden: false,
              unique: false,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: { min: 2, max: 120 },
              placeholder: "ENTER YOUR FULL NAME",
              help: "Enter your official name as it should appear on your ID card.",
              default_value: "",
            },
            {
              key: "mobile",
              type: "phone",
              label: "Mobile Number / મોબાઈલ નંબર",
              order: 2,
              hidden: false,
              unique: true,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: { pattern: "^[6-9]\\d{9}$", message: "Enter a valid 10-digit Indian mobile number." },
              placeholder: "10 DIGIT MOBILE NUMBER",
              help: "Your Participant ID and pass will be linked to this mobile number.",
              default_value: "",
            },
            {
              key: "district",
              type: "dropdown",
              label: "District / જિલ્લો",
              order: 3,
              hidden: false,
              unique: false,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: {},
              placeholder: "Select District / જિલ્લો પસંદ કરો",
              help: "Select your district / તમારો જિલ્લો પસંદ કરો.",
              default_value: "",
            },
          ],
        },
      });
    } catch (e) {
      console.warn("Primary event auto-creation notice:", e);
    }

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

    // Synchronize linked events under this campaign
    try {
      const { data: primaryEvents } = await supabaseAdmin
        .from("events")
        .select("id, general, features")
        .eq("campaign_id", data.id);
      if (primaryEvents && primaryEvents.length > 0) {
        for (const ev of primaryEvents) {
          const evGen = (ev.general as Record<string, unknown>) || {};
          const evFeat = (ev.features as Record<string, unknown>) || {};
          const evPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (data.name !== undefined) evGen.title = data.name;
          if (data.slogan !== undefined) evGen.theme = data.slogan;
          if (data.banner_url !== undefined) evGen.banner_url = data.banner_url;
          if (data.publish_status !== undefined) evPatch.publish_status = data.publish_status;
          if (data.registration_status !== undefined) {
            const isOpen = data.registration_status === "open";
            evGen.registration_enabled = isOpen;
            evFeat.registration = isOpen;
          }
          evPatch.general = evGen;
          evPatch.features = evFeat;
          await supabaseAdmin.from("events").update(evPatch as never).eq("id", ev.id);
        }
      }
    } catch (evErr) {
      console.warn("Linked events sync notice:", evErr);
    }

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

// ============================================================
// CAMPAIGN INDEPENDENT DASHBOARD & ZONE MANAGEMENT
// ============================================================

export type CampaignZone = {
  id: string;
  campaign_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  registration_count?: number;
};

export function sanitizeCampaignEventForPublic<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const clone: Record<string, unknown> = {};
  const allowed = [
    "id", "slug", "is_active", "is_template", "template_category",
    "lifecycle_status", "publish_status", "archived_at", "type",
    "description", "district", "district_id", "district_name", "campaign_id",
    "event_date", "event_time", "venue", "registration_open_at",
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

// ---------------- Admin: Get Campaign Dashboard ----------------
export const adminGetCampaignDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ campaignId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch Campaign
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("id", data.campaignId)
      .maybeSingle();

    if (cErr || !campaign) {
      return { ok: false as const, error: "Campaign not found." };
    }

    // 2. Fetch primary event for this campaign
    const { data: primaryEvent } = await supabaseAdmin
      .from("events")
      .select("id, slug, general, features, form, publish_status, registration_open_at, registration_close_at, max_registrations")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch zones for this campaign
    const { data: zones } = await supabaseAdmin
      .from("campaign_zones")
      .select("id, name, slug, description, is_active, display_order, created_at, updated_at")
      .eq("campaign_id", data.campaignId)
      .order("display_order", { ascending: true });

    const activeZones = (zones ?? []) as CampaignZone[];

    // 4. Counts: total registrations for this campaign
    const { count: totalRegistrations } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.campaignId);

    // 5. Today's registrations in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, "0")}-${String(istNow.getUTCDate()).padStart(2, "0")}T00:00:00+05:30`;
    const todayISO = new Date(todayStr).toISOString();

    const { count: todayRegistrations } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.campaignId)
      .gte("created_at", todayISO);

    // 6. Zone-wise counts
    const zoneCounts = await Promise.all(
      activeZones.map(async (z) => {
        const { count } = await supabaseAdmin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", data.campaignId)
          .eq("zone_id", z.id);
        return {
          id: z.id,
          campaign_id: z.campaign_id,
          name: z.name,
          slug: z.slug,
          description: z.description,
          is_active: z.is_active,
          display_order: z.display_order,
          created_at: z.created_at,
          updated_at: z.updated_at,
          registration_count: count ?? 0,
        };
      })
    );

    // Count without zone
    const { count: unassignedCount } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.campaignId)
      .is("zone_id", null);

    return {
      ok: true as const,
      campaign: campaign as unknown as Campaign,
      primaryEvent,
      zones: zoneCounts,
      stats: {
        totalRegistrations: totalRegistrations ?? 0,
        todayRegistrations: todayRegistrations ?? 0,
        zoneStats: zoneCounts,
        unassignedCount: unassignedCount ?? 0,
        activeZonesCount: zoneCounts.filter((z) => z.is_active).length,
      },
    };
  });

// ---------------- Admin: List Zones for a Campaign ----------------
export const adminListCampaignZones = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ campaignId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: zones, error } = await supabaseAdmin
      .from("campaign_zones")
      .select("id, campaign_id, name, slug, description, is_active, display_order, created_at, updated_at")
      .eq("campaign_id", data.campaignId)
      .order("display_order", { ascending: true });
    if (error) return { ok: false as const, error: error.message };

    const withCounts = await Promise.all(
      (zones ?? []).map(async (z: any) => {
        const { count } = await supabaseAdmin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", data.campaignId)
          .eq("zone_id", z.id);
        return { ...z, registration_count: count ?? 0 };
      })
    );
    return { ok: true as const, zones: withCounts };
  });

// ---------------- Admin: Create Zone under a Campaign ----------------
export const adminCreateCampaignZone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      name: z.string().trim().min(1).max(100),
      slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i, "Slug must be alphanumeric, hyphen or underscore"),
      description: z.string().trim().max(300).optional(),
      is_active: z.boolean().default(true),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanSlug = data.slug.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("campaign_zones")
      .select("id")
      .eq("campaign_id", data.campaignId)
      .eq("slug", cleanSlug)
      .maybeSingle();
    if (existing) {
      return { ok: false as const, error: "A zone with this slug already exists in this campaign." };
    }

    const { data: lastZone } = await supabaseAdmin
      .from("campaign_zones")
      .select("display_order")
      .eq("campaign_id", data.campaignId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (lastZone?.display_order ?? 0) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("campaign_zones")
      .insert({
        campaign_id: data.campaignId,
        name: data.name,
        slug: cleanSlug,
        description: data.description || null,
        is_active: data.is_active,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, zone: inserted };
  });

// ---------------- Admin: Update Zone ----------------
export const adminUpdateCampaignZone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(100).optional(),
      slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i).optional(),
      description: z.string().trim().max(300).optional().nullable(),
      is_active: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug.toLowerCase();
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_active !== undefined) patch.is_active = data.is_active;

    const { data: updated, error } = await supabaseAdmin
      .from("campaign_zones")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, zone: updated };
  });

// ---------------- Admin: Delete Zone ----------------
export const adminDeleteCampaignZone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("zone_id", data.id);

    if (count && count > 0) {
      return {
        ok: false as const,
        error: `Cannot delete zone because it has ${count} registration(s). You can disable it instead.`,
      };
    }

    const { error } = await supabaseAdmin
      .from("campaign_zones")
      .delete()
      .eq("id", data.id);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Admin: Get Campaign Registrations (Isolated & Paginated) ----------------
export const adminGetCampaignRegistrations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      zoneId: z.string().uuid().optional(),
      search: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("registrations")
      .select(
        "id, registration_number, full_name, mobile, district, zone_id, zone_name, referred_by, created_at, custom_fields",
        { count: "exact" }
      )
      .eq("campaign_id", data.campaignId);

    if (data.zoneId) {
      query = query.eq("zone_id", data.zoneId);
    }

    if (data.search) {
      const s = data.search.trim();
      query = query.or(`full_name.ilike.%${s}%,mobile.ilike.%${s}%,registration_number.ilike.%${s}%,referred_by.ilike.%${s}%`);
    }

    const { data: rows, count, error } = await query
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, registrations: rows ?? [], totalCount: count ?? 0 };
  });

// ---------------- Admin: Export Campaign Registrations ----------------
export const adminExportCampaignRegistrations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      zoneId: z.string().uuid().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("registrations")
      .select("id, registration_number, full_name, mobile, gender, district, taluka, zone_id, zone_name, referred_by, created_at")
      .eq("campaign_id", data.campaignId);

    if (data.zoneId) {
      query = query.eq("zone_id", data.zoneId);
    }

    const { data: rows, error } = await query
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, rows: rows ?? [] };
  });

// ---------------- Admin: Update Campaign Form Settings (Isolated to Campaign's Event) ----------------
export const adminUpdateCampaignFormSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      form: z.record(z.string(), z.any()),
      general: z.record(z.string(), z.any()).optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("id, general, form")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ev) {
      return { ok: false as const, error: "Primary event for this campaign not found." };
    }

    const updatePayload: Record<string, unknown> = {
      form: data.form,
      updated_at: new Date().toISOString(),
    };

    if (data.general) {
      updatePayload.general = {
        ...((ev.general as Record<string, unknown>) || {}),
        ...data.general,
      };
    }

    const { error } = await supabaseAdmin
      .from("events")
      .update(updatePayload)
      .eq("id", ev.id);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Public: Get Campaign Zones ----------------
export const getCampaignZonesPublic = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ campaignSlug: z.string().trim().min(1).max(80).toLowerCase() }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id, slug")
      .eq("slug", data.campaignSlug)
      .maybeSingle();

    if (!campaign) return { ok: false as const, error: "Campaign not found" };

    const { data: zones } = await supabaseAdmin
      .from("campaign_zones")
      .select("id, name, slug, description, is_active, display_order")
      .eq("campaign_id", campaign.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    return { ok: true as const, zones: zones ?? [] };
  });

// ---------------- Public: Load Campaign Zone Registration Data ----------------
export const loadCampaignZoneRegistrationData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      slug: z.string().trim().min(1).max(80).toLowerCase(),
      zoneSlug: z.string().trim().min(1).max(80).toLowerCase(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select("id, name, slug, publish_status, registration_status")
        .eq("slug", data.slug)
        .maybeSingle();

      const c = campaign as { id: string; name: string; slug: string; publish_status: string; registration_status: string } | null;
      if (!c || c.publish_status === "archived") {
        return { ok: false as const, error: "Campaign not available" };
      }
      if (c.registration_status !== "open") {
        return { ok: false as const, error: "Registration for this campaign is currently closed." };
      }

      // Resolve Zone under this campaign
      const { data: zone } = await supabaseAdmin
        .from("campaign_zones")
        .select("id, name, slug, description, is_active")
        .eq("campaign_id", c.id)
        .eq("slug", data.zoneSlug)
        .maybeSingle();

      if (!zone) {
        return { ok: false as const, error: `Zone "${data.zoneSlug}" not found in this campaign.` };
      }
      if (!zone.is_active) {
        return { ok: false as const, error: `Registration for ${zone.name} is currently disabled.` };
      }

      // Fetch primary event (foundational/first created event, canonical yog-sneh-milan-2026 for Sneh Milan)
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("id, slug, general, publish_status, lifecycle_status, features, created_at")
        .eq("campaign_id", c.id)
        .order("created_at", { ascending: true });

      const events = (ev ?? []) as unknown as Array<{
        id: string;
        slug: string;
        general: { title?: string } | null;
        publish_status: string;
        lifecycle_status: string;
        features: { registration?: boolean } | null;
        created_at: string;
      }>;

      const publishedEvents = events.filter(
        (e) =>
          e.publish_status === "published" &&
          e.lifecycle_status !== "archived" &&
          e.features?.registration !== false,
      );

      if (publishedEvents.length === 0) {
        return { ok: false as const, error: "No open events under this campaign right now." };
      }

      const event =
        publishedEvents.find((e) => e.slug === "yog-sneh-milan-2026") ??
        publishedEvents[0];

      const { resolveEvent } = await import("@/lib/event-resolver.server");
      const resolved = await resolveEvent(event.slug);
      if (!resolved?.event) {
        return { ok: false as const, error: "Event details could not be loaded." };
      }

      return {
        ok: true as const,
        campaign: { id: c.id, slug: c.slug, name: c.name },
        eventSlug: event.slug,
        zone: {
          id: zone.id as string,
          name: zone.name as string,
          slug: zone.slug as string,
          description: (zone.description as string) || null,
        },
        initialData: {
          config: sanitizeCampaignEventForPublic(resolved.event),
          district_name: resolved.district_name,
          coverage_districts: resolved.coverage_districts,
        },
      };
    } catch (err) {
      console.warn("[loadCampaignZoneRegistrationData] error:", err);
      return { ok: false as const, error: "Could not load the zone registration form. Please try again." };
    }
  });

// ---------------- Admin: Get All Events for a Specific Campaign ----------------
export const adminGetCampaignEvents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ campaignId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: events, error } = await supabaseAdmin
      .from("events")
      .select("id, slug, district, district_name, general, features, form, publish_status, lifecycle_status, registration_open_at, registration_close_at, max_registrations, event_date, event_time, venue, created_at, updated_at")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false });

    if (error) return { ok: false as const, error: error.message };

    // Fetch registration count for each event
    const withCounts = await Promise.all(
      (events ?? []).map(async (ev) => {
        const { count } = await supabaseAdmin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", ev.id);
        return {
          ...ev,
          registration_count: count ?? 0,
        };
      })
    );

    return { ok: true as const, events: withCounts };
  });

// ---------------- Admin: Add a New Independent Event under a Campaign ----------------
export const adminAddEventToCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      title: z.string().trim().min(2).max(200),
      slug: z.string().trim().max(80).optional(),
      event_date: z.string().trim().optional(),
      start_time: z.string().trim().optional(),
      end_time: z.string().trim().optional(),
      venue: z.string().trim().max(300).optional(),
      description: z.string().trim().max(2000).optional(),
      reg_prefix: z.string().trim().max(10).optional(),
      publish_status: z.enum(["published", "draft"]).default("published"),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id, slug, name, slogan, banner_url, theme, publish_status, registration_status")
      .eq("id", data.campaignId)
      .maybeSingle();

    if (!campaign) return { ok: false as const, error: "Campaign not found" };

    const safeSlugify = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    let cleanBase = data.slug ? safeSlugify(data.slug) : "";
    if (!cleanBase) {
      const titleSlug = safeSlugify(data.title);
      cleanBase = titleSlug ? `${campaign.slug}-${titleSlug}` : `${campaign.slug}-session`;
    }
    if (!cleanBase) cleanBase = "session";
    let uniqueSlug = cleanBase;
    let i = 1;
    while (true) {
      const { data: exists } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", uniqueSlug)
        .maybeSingle();
      if (!exists) break;
      i++;
      uniqueSlug = `${cleanBase}-${i}`;
    }

    const isSneh = isYogSnehMilanCampaign({
      campaignSlug: campaign.slug,
      campaignName: campaign.name,
    });

    const prefix = data.reg_prefix || (isSneh ? "YSM2026" : (campaign.slug.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "") || "EVT"));
    const timeDisplay = data.start_time
      ? data.end_time
        ? `${data.start_time} - ${data.end_time}`
        : data.start_time
      : null;

    const parseSafeTime = (t?: string | null): string | null => {
      if (!t) return null;
      const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!m) return null;
      let hr = parseInt(m[1], 10);
      const min = m[2];
      const sec = m[3] || "00";
      const ampm = m[4]?.toLowerCase();
      if (ampm === "pm" && hr < 12) hr += 12;
      if (ampm === "am" && hr === 12) hr = 0;
      return `${String(hr).padStart(2, "0")}:${min}:${sec}`;
    };
    const safeTime = parseSafeTime(data.start_time);

    const { data: newEvent, error } = await supabaseAdmin
      .from("events")
      .insert({
        campaign_id: campaign.id,
        slug: uniqueSlug,
        type: "state",
        district: data.venue || "Gujarat",
        district_name: data.venue || "Gujarat",
        publish_status: data.publish_status,
        lifecycle_status: "upcoming",
        is_active: data.publish_status === "published",
        reg_prefix: prefix,
        event_date: data.event_date || null,
        event_time: safeTime,
        venue: data.venue || null,
        description: data.description || null,
        general: {
          title: data.title,
          subtitle: isSneh ? YOG_SNEH_MILAN_BRANDING.line2 : campaign.slogan || "Gujarat State Yog Board",
          theme: data.title,
          description: data.description || `${data.title} under ${campaign.name}`,
          banner_url: campaign.banner_url || "",
          event_date: data.event_date || null,
          event_time: timeDisplay || null,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          venue: data.venue || null,
          registration_enabled: true,
          registration_mode: "online",
          level: "State",
          coverage: { type: "state" },
        },
        features: {
          registration: true,
          attendance: true,
          certificate: true,
          referral: true,
          footer: true,
        },
        form: {
          version: 2,
          fields: [
            {
              key: "full_name",
              type: "text",
              label: "Full Name / પૂરું નામ",
              order: 1,
              hidden: false,
              unique: false,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: { min: 2, max: 120 },
              placeholder: "ENTER YOUR FULL NAME",
              help: "Enter your official name as it should appear on your ID card.",
              default_value: "",
            },
            {
              key: "mobile",
              type: "phone",
              label: "Mobile Number / મોબાઈલ નંબર",
              order: 2,
              hidden: false,
              unique: true,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: { pattern: "^[6-9]\\d{9}$", message: "Enter a valid 10-digit Indian mobile number" },
              placeholder: "9876543210",
              help: "10-digit Indian mobile number.",
              default_value: "",
            },
            {
              key: "district",
              type: "dropdown",
              label: "District / જિલ્લો",
              order: 3,
              hidden: false,
              unique: false,
              builtin: true,
              enabled: true,
              options: [],
              readonly: false,
              required: true,
              validation: {},
              placeholder: "Select District",
              help: "Please select your district.",
              default_value: "",
            },
          ],
        },
      })
      .select("id, slug, general")
      .single();

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, event: newEvent };
  });

// ---------------- Admin: Delete / Archive Event from Campaign ----------------
export const adminDeleteCampaignEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      eventId: z.string().uuid(),
      campaignId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if event has registrations
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);

    if ((count ?? 0) > 0) {
      // Archive instead of hard delete to avoid corrupting participant data
      const { error: archErr } = await supabaseAdmin
        .from("events")
        .update({
          publish_status: "archived",
          lifecycle_status: "archived",
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq("id", data.eventId)
        .eq("campaign_id", data.campaignId);

      if (archErr) return { ok: false as const, error: archErr.message };
      return { ok: true as const, archived: true, message: `Event has ${count} existing registrations, so it was safely archived.` };
    }

    const { error } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", data.eventId)
      .eq("campaign_id", data.campaignId);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, archived: false, message: "Event deleted successfully." };
  });

// ---------------- Admin: Update Event under Campaign ----------------
export const adminUpdateCampaignEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      eventId: z.string().uuid(),
      campaignId: z.string().uuid(),
      title: z.string().min(2),
      slug: z.string().min(2),
      event_date: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      venue: z.string().optional(),
      description: z.string().optional(),
      publish_status: z.enum(["draft", "published", "archived"]).default("published"),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch existing event under this campaign
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("events")
      .select("id, general, slug")
      .eq("id", data.eventId)
      .eq("campaign_id", data.campaignId)
      .single();

    if (fetchErr || !existing) {
      return { ok: false as const, error: "Event not found under this campaign." };
    }

    const timeDisplay = data.start_time && data.end_time
      ? `${data.start_time} - ${data.end_time}`
      : data.start_time || "";

    const parseSafeTime = (t?: string | null): string | null => {
      if (!t) return null;
      const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!m) return null;
      let hr = parseInt(m[1], 10);
      const min = m[2];
      const sec = m[3] || "00";
      const ampm = m[4]?.toLowerCase();
      if (ampm === "pm" && hr < 12) hr += 12;
      if (ampm === "am" && hr === 12) hr = 0;
      return `${String(hr).padStart(2, "0")}:${min}:${sec}`;
    };
    const safeTime = parseSafeTime(data.start_time);

    const general = (existing.general || {}) as Record<string, any>;
    general.title = data.title;
    if (data.description) general.description = data.description;
    if (timeDisplay) general.event_time = timeDisplay;
    if (data.start_time) general.start_time = data.start_time;
    if (data.end_time) general.end_time = data.end_time;
    if (data.venue) general.venue = data.venue;
    if (data.event_date) general.event_date = data.event_date;

    const { error: updErr } = await supabaseAdmin
      .from("events")
      .update({
        event_date: data.event_date || null,
        event_time: safeTime,
        venue: data.venue || null,
        description: data.description || null,
        publish_status: data.publish_status,
        is_active: data.publish_status === "published",
        general,
      })
      .eq("id", data.eventId)
      .eq("campaign_id", data.campaignId);

    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, message: "Event updated successfully." };
  });
