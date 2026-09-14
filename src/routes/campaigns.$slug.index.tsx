import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Users, ArrowRight, Megaphone, BadgeCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getCampaignBySlug, type CampaignTheme } from "@/lib/campaign.functions";
import { LotusMark, petalBandStyle } from "@/components/art/gsyb-art";

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
        <h1 className="display-2">Campaign not available</h1>
        <p className="mt-2 text-muted-foreground">This campaign does not exist or is not published.</p>
        <Link to="/campaigns" className="mt-6 inline-block rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white">
          All Campaigns
        </Link>
      </div>
    );
  }

  const campaign = data.campaign as CampaignData;
  const events = data.events as unknown as EventRow[];
  const t = campaign.theme ?? {};

  // Campaign-scoped accents fall back to global brand tokens.
  const cp = t.primaryColor || "var(--brand-primary)";
  const cb = t.buttonColor || "var(--brand-primary)";
  const ct = t.textColor || "var(--foreground)";

  return (
    <div style={themeStyle(t)}>
      {/* ---------- campaign hero (campaign identity only) ---------- */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: t.backgroundColor || "var(--campaign-bg, var(--background))" }}
      >
        {campaign.banner_url && (
          <img
            src={campaign.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(110% 80% at 50% 110%, color-mix(in oklab, var(--brand-accent) 20%, transparent) 0%, transparent 60%)" }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:py-20">
          {campaign.logo_url && (
            <img
              src={campaign.logo_url}
              alt=""
              className="mx-auto mb-5 h-20 w-20 rounded-full border border-border bg-white object-contain p-1 shadow-editorial"
            />
          )}
          <div
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1 text-xs font-semibold backdrop-blur"
            style={{ color: cp, borderColor: "color-mix(in oklab, currentColor 25%, transparent)" }}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Campaign of the {BRAND.name}
          </div>
          <h1 className="display-1" style={{ color: cp }}>
            {campaign.name}
          </h1>
          {campaign.slogan && (
            <p className="gujarati-display mt-5 max-w-2xl mx-auto" style={{ color: ct, opacity: 0.85 }}>
              “{campaign.slogan}”
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {(campaign.start_date || campaign.end_date) && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDate(campaign.start_date)}
                {campaign.end_date && campaign.end_date !== campaign.start_date
                  ? ` — ${formatDate(campaign.end_date)}`
                  : ""}
              </span>
            )}
            {campaign.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {campaign.venue}
              </span>
            )}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {campaign.registration_status === "open" ? (
              <Link
                to="/campaigns/$slug/register"
                params={{ slug: campaign.slug }}
                className="inline-flex items-center gap-2 rounded-lg px-7 py-3 text-base font-semibold text-white shadow-editorial transition hover:opacity-90"
                style={{ background: cb }}
              >
                Register Now <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-lg border border-border px-7 py-3 text-base font-medium text-muted-foreground">
                Registration Currently Closed
              </span>
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0" style={petalBandStyle} />
      </section>

      {/* ---------- about + events ---------- */}
      <div className="mx-auto max-w-5xl px-4 py-12">
        {campaign.description && (
          <section className="mb-12 rounded-2xl border border-border bg-card p-6 shadow-editorial sm:p-9">
            <p className="kicker">About the Campaign</p>
            <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {campaign.description}
            </p>
            <dl className="mt-7 grid gap-5 border-t border-border pt-6 text-sm sm:grid-cols-2">
              {campaign.organizer && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organizer</dt>
                  <dd className="mt-1 font-medium text-foreground">{campaign.organizer}</dd>
                </div>
              )}
              {campaign.contact_info && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</dt>
                  <dd className="mt-1 font-medium text-foreground">{campaign.contact_info}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="kicker">Programs</p>
              <h2 className="display-2 mt-2">Events under this campaign</h2>
            </div>
            <Users className="hidden h-6 w-6 text-brand-primary/40 sm:block" />
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <LotusMark className="mx-auto h-9 w-[4.5rem] opacity-60" />
              <p className="mt-3 text-sm text-muted-foreground">
                Events for this campaign will be announced soon.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((e) => (
                <article
                  key={e.id}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-editorial transition hover:-translate-y-0.5"
                >
                  <h3 className="display-3">{e.title}</h3>
                  {e.subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">{e.subtitle}</p>
                  )}
                  {e.event_date && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(e.event_date)}
                    </p>
                  )}
                  <div className="mt-5 flex gap-2 pt-1">
                    <Link
                      to="/$event"
                      params={{ event: e.slug }}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-brand-primary transition hover:bg-accent/60"
                    >
                      View Event
                    </Link>
                    <Link
                      to="/$event/register"
                      params={{ event: e.slug }}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-center text-sm font-medium text-white transition hover:opacity-90"
                      style={{ background: cb }}
                    >
                      Register <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* participant journey strip */}
        <section className="mt-12 rounded-2xl bg-maroonwash p-6 sm:p-8">
          <p className="kicker">What happens after you register</p>
          <ol className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Participant ID", desc: "Issued instantly with your registration." },
              { icon: Megaphone, title: "QR entry pass", desc: "Your digital ID card carries a secure QR." },
              { icon: BadgeCheck, title: "Official certificate", desc: "Download after verified attendance." },
            ].map((s) => (
              <li key={s.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                <span>
                  <span className="block font-semibold text-foreground">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
