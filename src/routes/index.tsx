import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { listPublicEvents } from "@/lib/event.functions";
import { listCampaigns } from "@/lib/campaign.functions";

// The homepage is the GUJARAT STATE YOG BOARD homepage. Campaigns are the
// secondary layer shown here; each campaign leads to its own page and events.

export const Route = createFileRoute("/")({
  component: RootHome,
  head: () => ({
    meta: [
      { title: `${BRAND.nameDisplay} — Official Portal` },
      {
        name: "description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. Explore campaigns and register for yoga and meditation events across Gujarat.`,
      },
      { property: "og:title", content: `${BRAND.nameDisplay} — Official Portal` },
      {
        property: "og:description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. Explore campaigns and register for yoga and meditation events.`,
      },
    ],
  }),
});

type CampaignCard = {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  registration_status: "open" | "closed";
  event_count?: number;
};

type PublicEventRow = {
  id: string;
  slug: string | null;
  title: string;
  event_date: string | null;
  coverage_type: "single" | "zone" | "state";
  coverage_district_names: string[];
  status: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function RootHome() {
  const list = useServerFn(listPublicEvents);
  const listC = useServerFn(listCampaigns);

  const campaignsQ = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => listC(),
    staleTime: 15_000,
  });
  const campaigns = (campaignsQ.data?.ok ? campaignsQ.data.campaigns : []) as unknown as CampaignCard[];

  const eventsQ = useQuery({
    queryKey: ["public-events"],
    queryFn: () => list(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const rows = (eventsQ.data?.ok ? (eventsQ.data.rows as PublicEventRow[]) : []) ?? [];

  return (
    <div>
      {/* GSYB hero — organization identity, not any campaign */}
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <img
              src={BRAND.logoPath}
              alt={BRAND.name}
              className="mx-auto mb-6 h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
            <h1 className="text-3xl font-bold text-brand-primary sm:text-5xl">
              {BRAND.nameDisplay}
            </h1>
            <p className="mt-3 text-sm font-medium text-muted-foreground sm:text-base">
              {BRAND.departmentLine}
            </p>
            <p className="mt-6 text-lg text-muted-foreground">
              Explore our campaigns and register for yoga & meditation events across Gujarat.
            </p>
          </div>
        </div>
      </section>

      {/* Campaigns — the secondary layer */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-brand-primary">
            <Megaphone className="h-6 w-6" />
            Campaigns
          </h2>
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {campaignsQ.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No active campaigns right now. Please check back soon.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
              >
                {c.banner_url ? (
                  <img src={c.banner_url} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="h-36 w-full bg-gradient-to-br from-brand-primary to-brand-accent" />
                )}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center gap-2">
                    {c.logo_url && (
                      <img src={c.logo_url} alt="" className="h-8 w-8 rounded-full object-contain" />
                    )}
                    <h3 className="text-lg font-bold text-brand-primary">{c.name}</h3>
                  </div>
                  {c.slogan && <p className="text-sm italic text-muted-foreground">“{c.slogan}”</p>}
                  {c.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <span
                    className={
                      c.registration_status === "open"
                        ? "mt-1 text-xs font-medium text-brand-success"
                        : "mt-1 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {c.registration_status === "open" ? "Registration Open" : "Registration Closed"}
                  </span>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Link
                      to="/campaigns/$slug"
                      params={{ slug: c.slug }}
                      className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-brand-primary hover:bg-muted"
                    >
                      View Campaign
                    </Link>
                    {c.registration_status === "open" && (
                      <Link
                        to="/campaigns/$slug/register"
                        params={{ slug: c.slug }}
                        className="flex-1 rounded-md bg-brand-primary px-3 py-2 text-center text-sm font-medium text-white hover:opacity-90"
                      >
                        Register
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All open events across campaigns */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-brand-primary">
            <CalendarDays className="h-6 w-6" />
            Events Open for Registration
          </h2>

          {eventsQ.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading available events…
            </p>
          )}

          {rows.length === 0 && !eventsQ.isLoading && (
            <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold text-brand-primary">
                No event is currently open for registration.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please check back later — new events are announced regularly.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-brand-primary">{e.title}</h3>
                    {e.event_date && (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(e.event_date)}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {e.coverage_type === "state" ? "State-wide" : e.coverage_type === "zone" ? "Zone" : "District"}
                  </span>
                </div>
                <Link
                  to="/$event"
                  params={{ event: e.slug ?? "" }}
                  className="mt-4 inline-flex items-center gap-1 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Users className="mr-1 h-4 w-4" />
                  View & Register <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
