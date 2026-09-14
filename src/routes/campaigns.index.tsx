import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Megaphone, CalendarDays } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { listCampaigns } from "@/lib/campaign.functions";

export const Route = createFileRoute("/campaigns/")({
  head: () => ({
    meta: [
      { title: `Campaigns — ${BRAND.name}` },
      { name: "description", content: `Campaigns of the ${BRAND.name} — ${BRAND.departmentLine}.` },
    ],
  }),
  component: CampaignsPage,
});

type CampaignRow = {
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

function CampaignsPage() {
  const load = useServerFn(listCampaigns);
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => load(),
  });

  const campaigns = (data?.ok ? data.campaigns : []) as unknown as CampaignRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-brand-primary">
          <Megaphone className="h-3.5 w-3.5" />
          {BRAND.name}
        </div>
        <h1 className="text-3xl font-bold text-brand-primary sm:text-4xl">Campaigns</h1>
        <p className="mt-2 text-muted-foreground">
          Ongoing campaigns under the {BRAND.name} — {BRAND.departmentLine}.
        </p>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No active campaigns right now. Please check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  <h2 className="text-lg font-bold text-brand-primary">{c.name}</h2>
                </div>
                {c.slogan && <p className="text-sm italic text-muted-foreground">“{c.slogan}”</p>}
                {c.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {typeof c.event_count === "number" && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {c.event_count} event{c.event_count === 1 ? "" : "s"}
                    </span>
                  )}
                  <span
                    className={
                      c.registration_status === "open"
                        ? "font-medium text-brand-success"
                        : "font-medium text-muted-foreground"
                    }
                  >
                    {c.registration_status === "open" ? "Registration Open" : "Registration Closed"}
                  </span>
                </div>
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
                      Register <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
