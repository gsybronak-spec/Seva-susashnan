import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { RegisterView } from "@/components/pages/register-view";
import { getCampaignBySlug, type CampaignTheme } from "@/lib/campaign.functions";
import type { EventConfigInitialData } from "@/hooks/use-event-config";

// The campaign register route reuses the existing RegisterView + event form
// builder — campaigns provide the branding/scoping layer; registration itself
// is still event-scoped (the campaign's primary event by default).
const loadCampaignRegistrationData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80).toLowerCase() }).parse(input),
  )
  .handler(async ({ data }) => {
    const z = await import("zod");
    void z;
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
      // The campaign's primary event = its most recent published event.
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("id, slug, general, publish_status, lifecycle_status, features")
        .eq("campaign_id", c.id)
        .order("created_at", { ascending: false });
      const events = (ev ?? []) as unknown as Array<{
        id: string;
        slug: string;
        general: { title?: string } | null;
        publish_status: string;
        lifecycle_status: string;
        features: { registration?: boolean } | null;
      }>;
      const event = events.find(
        (e) =>
          e.publish_status === "published" &&
          e.lifecycle_status !== "archived" &&
          e.features?.registration !== false,
      );
      if (!event) {
        return { ok: false as const, error: "No open events under this campaign right now." };
      }
      const { resolveEvent } = await import("@/lib/event-resolver.server");
      const resolved = await resolveEvent(event.slug);
      if (!resolved?.event) {
        return { ok: false as const, error: "Event details could not be loaded." };
      }
      const { stripAdminOnlyFields } = await import("@/lib/event.functions");
      const initialData: EventConfigInitialData = {
        config: stripAdminOnlyFields(resolved.event),
        district_name: resolved.district_name,
        coverage_districts: resolved.coverage_districts,
      };
      return {
        ok: true as const,
        campaign: { slug: c.slug, name: c.name },
        eventSlug: event.slug,
        initialData,
      };
    } catch (err) {
      console.warn("[loadCampaignRegistrationData] error:", err);
      return { ok: false as const, error: "Could not load the registration form. Please try again." };
    }
  });

export const Route = createFileRoute("/campaigns/$slug/register")({
  validateSearch: (search: Record<string, unknown>): { ref?: string; partner?: string } => ({
    ...(typeof search.ref === "string" ? { ref: search.ref } : {}),
    ...(typeof search.partner === "string" ? { partner: search.partner } : {}),
  }),
  head: () => ({
    meta: [{ title: `Register — ${BRAND.name}` }],
  }),
  component: CampaignRegisterPage,
});

import { z } from "zod";

function themeStyle(theme: CampaignTheme | null | undefined): React.CSSProperties {
  if (!theme) return {};
  const v: Record<string, string> = {};
  if (theme.primaryColor) v["--campaign-primary"] = theme.primaryColor;
  if (theme.backgroundColor) v["--campaign-bg"] = theme.backgroundColor;
  if (theme.textColor) v["--campaign-text"] = theme.textColor;
  if (theme.buttonColor) v["--campaign-btn"] = theme.buttonColor;
  return v as React.CSSProperties;
}

function CampaignRegisterPage() {
  const { slug } = Route.useParams();
  const { ref, partner } = Route.useSearch();
  const load = useServerFn(loadCampaignRegistrationData);
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-register", slug],
    queryFn: () => load({ data: { slug } }),
  });

  if (isLoading) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Loading registration form…</p>;
  }

  if (!data?.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Registration unavailable</h1>
        <p className="mt-2 text-muted-foreground">{data?.ok === false ? data.error : "Please try again later."}</p>
        <Link
          to="/campaigns/$slug"
          params={{ slug }}
          className="mt-6 inline-block rounded-md bg-brand-primary px-4 py-2 text-sm text-white"
        >
          Back to Campaign
        </Link>
      </div>
    );
  }

  const payload = data as {
    ok: true;
    campaign: { slug: string; name: string };
    eventSlug: string;
    initialData: EventConfigInitialData;
  };

  return (
    <div style={themeStyle((payload.initialData.config as { theme?: CampaignTheme } | null)?.theme)}>
      <div className="border-b border-border bg-muted/30 px-4 py-3 text-center text-sm">
        <span className="text-muted-foreground">Campaign: </span>
        <Link
          to="/campaigns/$slug"
          params={{ slug: payload.campaign.slug }}
          className="font-semibold text-brand-primary hover:underline"
        >
          {payload.campaign.name}
        </Link>
      </div>
      <RegisterView
        eventSlug={payload.eventSlug}
        refCode={ref}
        partnerSlug={partner}
        initialData={payload.initialData}
      />
    </div>
  );
}
