import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { RegisterView } from "@/components/pages/register-view";
import { loadCampaignZoneRegistrationData, type CampaignTheme } from "@/lib/campaign.functions";
import type { EventConfigInitialData } from "@/hooks/use-event-config";
import { isYogSnehMilanCampaign } from "@/lib/campaign-branding";

export const Route = createFileRoute("/campaigns/$slug/zone/$zoneSlug")({
  validateSearch: (search: Record<string, unknown>): { ref?: string; partner?: string } => ({
    ...(typeof search.ref === "string" ? { ref: search.ref } : {}),
    ...(typeof search.partner === "string" ? { partner: search.partner } : {}),
  }),
  head: () => ({
    meta: [{ title: `Zone Registration — ${BRAND.name}` }],
  }),
  component: CampaignZoneRegisterPage,
});

function themeStyle(theme: CampaignTheme | null | undefined): React.CSSProperties {
  if (!theme) return {};
  const v: Record<string, string> = {};
  if (theme.primaryColor) v["--campaign-primary"] = theme.primaryColor;
  if (theme.backgroundColor) v["--campaign-bg"] = theme.backgroundColor;
  if (theme.textColor) v["--campaign-text"] = theme.textColor;
  if (theme.buttonColor) v["--campaign-btn"] = theme.buttonColor;
  return v as React.CSSProperties;
}

function CampaignZoneRegisterPage() {
  const { slug, zoneSlug } = Route.useParams();
  const { ref, partner } = Route.useSearch();
  const load = useServerFn(loadCampaignZoneRegistrationData);
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-zone-register", slug, zoneSlug],
    queryFn: () => load({ data: { slug, zoneSlug } }),
  });

  if (isLoading) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Loading zone registration form…</p>;
  }

  if (!data?.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Zone Registration Unavailable</h1>
        <p className="mt-2 text-muted-foreground">{data?.ok === false ? data.error : "Please try again later."}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-block rounded-md bg-brand-primary px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const payload = data as {
    ok: true;
    campaign: { id: string; slug: string; name: string };
    eventSlug: string;
    zone: { id: string; name: string; slug: string; description: string | null };
    initialData: EventConfigInitialData;
  };

  const isSnehMilan = isYogSnehMilanCampaign({
    campaignSlug: payload.campaign.slug,
    campaignName: payload.campaign.name,
    eventSlug: payload.eventSlug,
  });

  return (
    <div style={themeStyle((payload.initialData.config as { theme?: CampaignTheme } | null)?.theme)}>
      {!isSnehMilan && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-center text-sm select-none">
          <span className="text-muted-foreground">Campaign: </span>
          <span className="font-semibold text-brand-primary">
            {payload.campaign.name}
          </span>
          <span className="mx-2 text-muted-foreground">•</span>
          <span className="font-semibold text-foreground">
            {payload.zone.name}
          </span>
        </div>
      )}
      <RegisterView
        eventSlug={payload.eventSlug}
        refCode={ref}
        partnerSlug={partner}
        initialData={payload.initialData}
        lockedZone={payload.zone}
      />
    </div>
  );
}
