import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { listCampaigns } from "@/lib/campaign.functions";
import { CampaignCard, type CampaignCardData } from "@/components/campaign-card";
import { LotusMark, petalBandStyle } from "@/components/art/gsyb-art";

export const Route = createFileRoute("/campaigns/")({
  head: () => ({
    meta: [
      { title: `Campaigns — ${BRAND.name}` },
      { name: "description", content: `Campaigns of the ${BRAND.name} — ${BRAND.departmentLine}.` },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const load = useServerFn(listCampaigns);
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => load(),
  });

  const campaigns = (data?.ok ? data.campaigns : []) as unknown as CampaignCardData[];

  return (
    <div>
      {/* page masthead */}
      <section className="relative overflow-hidden border-b border-border bg-sunwash">
        <div className="absolute inset-x-0 bottom-0" style={petalBandStyle} />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:py-16">
          <p className="kicker justify-center normal-case tracking-widest">
            {BRAND.name}
          </p>
          <h1 className="display-1 mt-3">Campaigns</h1>
          <p className="gujarati-display mt-4 text-foreground/80">
            સ્વસ્થ ગુજરાત, સશક્ત ગુજરાત.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every campaign listed here is conducted under the Gujarat State Yog Board. Open a
            campaign to view its events, register as a participant, and receive your QR entry
            pass.
          </p>
        </div>
      </section>

      {/* listing */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <LotusMark className="mx-auto h-10 w-20 opacity-60" />
            <p className="mt-3 text-sm text-muted-foreground">
              No active campaigns right now. New campaigns are announced here — please check
              back soon.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
