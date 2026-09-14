import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Users, ArrowRight, Megaphone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getCampaignBySlug, type CampaignTheme } from "@/lib/campaign.functions";

export const Route = createFileRoute("/campaigns/$slug/")({
  head: () => ({
    meta: [{ title: `Campaign — ${BRAND.name}` }],
  }),
  component: CampaignPage,
});

type CampaignData = {
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
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  event_date: string | null;
};

function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return d;
  }
}

/** Campaign-scoped CSS variables — these apply ONLY within this page's
 * subtree and never touch the global GSYB branding. */
function themeStyle(theme: CampaignTheme): React.CSSProperties {
  const v: Record<string, string> = {};
  if (theme.primaryColor) v["--campaign-primary"] = theme.primaryColor;
  if (theme.accentColor) v["--campaign-accent"] = theme.accentColor;
  if (theme.backgroundColor) v["--campaign-bg"] = theme.backgroundColor;
  if (theme.textColor) v["--campaign-text"] = theme.textColor;
  if (theme.buttonColor) v["--campaign-btn"] = theme.buttonColor;
  return v as React.CSSProperties;
}

function CampaignPage() {
  const { slug } = Route.useParams();
  const load = useServerFn(getCampaignBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["campaign", slug],
    queryFn: () => load({ data: { slug } }),
  });

  if (isLoading) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Loading campaign…</p>;
  }
  if (!data?.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Campaign not available</h1>
        <p className="mt-2 text-muted-foreground">This campaign does not exist or is not published.</p>
        <Link to="/campaigns" className="mt-6 inline-block rounded-md bg-brand-primary px-4 py-2 text-sm text-white">
          All Campaigns
        </Link>
      </div>
    );
  }

  const campaign = data.campaign as CampaignData;
  const events = data.events as unknown as EventRow[];
  const t = campaign.theme ?? {};

  return (
    <div style={themeStyle(t)}>
      {/* Campaign hero — campaign-scoped colors, GSYB stays in the global header */}
      <section
        className="relative border-b border-border"
        style={{ background: t.backgroundColor || "var(--campaign-bg, var(--background))" }}
      >
        {campaign.banner_url && (
          <img
            src={campaign.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:py-20">
          {campaign.logo_url && (
            <img
              src={campaign.logo_url}
              alt=""
              className="mx-auto mb-4 h-20 w-20 rounded-full bg-white object-contain p-1 shadow"
            />
          )}
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
            style={{ color: t.primaryColor || "var(--campaign-primary, var(--brand-primary))", borderColor: "var(--border)" }}>
            <Megaphone className="h-3.5 w-3.5" />
            Campaign
          </div>
          <h1
            className="text-3xl font-bold sm:text-5xl"
            style={{ color: t.primaryColor || "var(--campaign-primary, var(--brand-primary))" }}
          >
            {campaign.name}
          </h1>
          {campaign.slogan && (
            <p className="mt-3 text-lg italic" style={{ color: t.textColor || "var(--campaign-text, var(--foreground))" }}>
              “{campaign.slogan}”
            </p>
          )}
          {(campaign.start_date || campaign.end_date) && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {formatDate(campaign.start_date)}
              {campaign.end_date && campaign.end_date !== campaign.start_date
                ? ` — ${formatDate(campaign.end_date)}`
                : ""}
            </p>
          )}
          {campaign.venue && (
            <p className="mt-1 inline-flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {campaign.venue}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {campaign.registration_status === "open" ? (
              <Link
                to="/campaigns/$slug/register"
                params={{ slug: campaign.slug }}
                className="rounded-lg px-6 py-3 text-base font-semibold text-white shadow"
                style={{ background: t.buttonColor || "var(--campaign-btn, var(--brand-primary))" }}
              >
                Register Now <ArrowRight className="ml-1 inline h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-lg border border-border px-6 py-3 text-base font-medium text-muted-foreground">
                Registration Currently Closed
              </span>
            )}
          </div>
        </div>
      </section>

      {/* About + events */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        {campaign.description && (
          <section className="mb-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-3 text-xl font-bold text-brand-primary">About the Campaign</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{campaign.description}</p>
            {campaign.organizer && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Organizer:</span> {campaign.organizer}
              </p>
            )}
            {campaign.contact_info && (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Contact:</span> {campaign.contact_info}
              </p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-brand-primary">
            <Users className="h-5 w-5" />
            Events under this Campaign
          </h2>
          {events.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Events for this campaign will be announced soon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-brand-primary">{e.title}</h3>
                  {e.subtitle && <p className="text-sm text-muted-foreground">{e.subtitle}</p>}
                  {e.event_date && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(e.event_date)}
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Link
                      to="/$event"
                      params={{ event: e.slug }}
                      className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-brand-primary hover:bg-muted"
                    >
                      View Event
                    </Link>
                    <Link
                      to="/$event/register"
                      params={{ event: e.slug }}
                      className="flex-1 rounded-md bg-brand-primary px-3 py-2 text-center text-sm font-medium text-white hover:opacity-90"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
