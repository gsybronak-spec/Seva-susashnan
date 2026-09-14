import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CalendarDays,
  IdCard,
  BadgeCheck,
  ScanLine,
  FileSearch,
  LifeBuoy,
  MapPin,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { listPublicEvents } from "@/lib/event.functions";
import { listCampaigns } from "@/lib/campaign.functions";
import { CampaignCard, type CampaignCardData } from "@/components/campaign-card";
import {
  SunriseField,
  MeditationSilhouette,
  TreePoseSilhouette,
  LotusMark,
  LotusBadge,
  SunRayCrown,
  CommunityYogaScene,
  PetalFrame,
  petalBandStyle,
} from "@/components/art/gsyb-art";

/**
 * GUJARAT STATE YOG BOARD — official digital platform homepage.
 *
 * Original editorial design (not derived from any earlier layout):
 * identity-first hero → about the board → campaigns → programs →
 * community band → impact → inspiration → official quick links.
 * Campaigns and events are live data; everything else is static,
 * truthful organizational content.
 */

export const Route = createFileRoute("/")({
  component: RootHome,
  head: () => ({
    meta: [
      { title: `${BRAND.nameDisplay} — Official Portal` },
      {
        name: "description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. The official platform for yoga & meditation campaigns, events and registrations across Gujarat.`,
      },
      { property: "og:title", content: `${BRAND.nameDisplay} — Official Portal` },
      {
        property: "og:description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. Explore campaigns and register for yoga and meditation events.`,
      },
    ],
  }),
});

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

/* ---------- sections ---------- */

function Hero({ openEvents }: { openEvents: number }) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-sunwash">
      <SunriseField className="absolute inset-x-0 bottom-0 h-[62%] w-full" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
        {/* copy */}
        <div>
          <p className="kicker" style={{ textTransform: "none" }}>{BRAND.departmentLine}</p>
          <h1 className="display-1 mt-4">{BRAND.nameDisplay}</h1>
          <p className="gujarati-display mt-5 max-w-xl text-foreground/85">
            યોગથી સ્વસ્થ જીવન તરફ એક પગલું — સમગ્ર ગુજરાત માટે યોગ અને ધ્યાનની સત્તાવાર પહેલ.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            The official digital platform of the Gujarat State Yog Board — discover statewide
            yoga &amp; meditation campaigns, register for events, and receive your participant
            ID, QR entry pass and certificate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/campaigns"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-editorial transition hover:opacity-90"
            >
              Explore Campaigns <ArrowRight className="h-4 w-4" />
            </Link>
            {openEvents > 0 && (
              <Link
                to="/campaigns"
                className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-card/80 px-6 py-3 text-sm font-semibold text-brand-primary backdrop-blur transition hover:bg-accent/60"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-success" />
                {openEvents} event{openEvents === 1 ? "" : "s"} open for registration
              </Link>
            )}
          </div>
        </div>

        {/* art composition */}
        <div className="relative hidden justify-center lg:flex" aria-hidden="true">
          <PetalFrame className="w-full max-w-md">
            <div className="flex h-72 items-end justify-center gap-2 pb-2 sm:h-80">
              <MeditationSilhouette className="h-56 w-56 sm:h-64 sm:w-64" />
            </div>
            <div className="absolute inset-x-6 top-6 flex justify-between opacity-70">
              <LotusMark className="h-8 w-16 -scale-x-100" />
              <LotusMark className="h-8 w-16" />
            </div>
          </PetalFrame>
        </div>
      </div>
    </section>
  );
}

function AboutBoard() {
  const points = [
    {
      title: "Statewide programs",
      body: "Yog ane Dhyan Shibir camps and wellbeing initiatives conducted across Gujarat, open to every citizen free of cost.",
    },
    {
      title: "Official & verified",
      body: "Registrations, attendance and participation certificates are issued and verified by the Board under its official identity.",
    },
    {
      title: "Simple citizen journey",
      body: "Register online, receive a digital ID card with a secure QR pass, check in at the venue, and download your certificate.",
    },
  ];
  return (
    <section className="bg-maroonwash">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
        {/* art */}
        <div className="relative order-2 flex justify-center lg:order-1" aria-hidden="true">
          <div className="relative flex h-72 w-72 items-end justify-center rounded-full bg-gradient-to-b from-accent/70 to-transparent sm:h-80 sm:w-80">
            <TreePoseSilhouette className="h-64 w-44 sm:h-72 sm:w-48" />
            <div className="absolute bottom-4" style={petalBandStyle} />
          </div>
        </div>
        {/* copy */}
        <div className="order-1 lg:order-2">
          <p className="kicker">About the Board</p>
          <h2 className="display-2 mt-3">A healthier Gujarat, built through yoga</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The <span className="font-semibold text-foreground">Gujarat State Yog Board</span>,
            under the {BRAND.departmentLine.replace(/^Under /, "")}, guides the state&apos;s yoga
            and meditation movement — from large public shibirs to year-round wellbeing
            programs — with a single, trustworthy digital platform for participants and
            organizers alike.
          </p>
          <ul className="mt-8 space-y-5">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <LotusBadge className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h3 className="display-3">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CampaignsSection({
  campaigns,
  isLoading,
}: {
  campaigns: CampaignCardData[];
  isLoading: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" id="campaigns">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Campaigns</p>
          <h2 className="display-2 mt-2">Current campaigns of the Board</h2>
        </div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
        >
          View all campaigns <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <LotusMark className="mx-auto h-10 w-20 opacity-60" />
          <p className="mt-3 text-sm text-muted-foreground">
            New campaigns are announced here. Please check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProgramsSection({
  rows,
  isLoading,
}: {
  rows: PublicEventRow[];
  isLoading: boolean;
}) {
  return (
    <section className="border-y border-border bg-sunwash">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="kicker">Programs &amp; Events</p>
          <h2 className="display-2 mt-2">Open for registration</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Upcoming shibirs and sessions conducted under Board campaigns. Choose a program to
            view details and register — your participant ID and QR entry pass are issued
            instantly.
          </p>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading programs…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No events are open right now — new programs are announced regularly.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-editorial">
            {rows.map((e) => (
              <li key={e.id}>
                <Link
                  to="/$event"
                  params={{ event: e.slug ?? "" }}
                  className="group flex flex-col gap-3 p-5 transition hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="display-3 group-hover:underline">{e.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {e.event_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(e.event_date)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.coverage_type === "state"
                          ? "State-wide"
                          : e.coverage_type === "zone"
                            ? `Zone · ${e.coverage_district_names?.length ?? 0} districts`
                            : (e.coverage_district_names?.[0] ?? "District")}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition group-hover:opacity-90">
                    Register <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function CommunityBand() {
  return (
    <section className="overflow-hidden bg-maroonwash" aria-hidden="false">
      <div className="mx-auto max-w-6xl px-4 pt-14 text-center">
        <p className="kicker justify-center">Yoga for every generation</p>
        <p className="gujarati-display mx-auto mt-4 max-w-2xl text-foreground/85">
          બાળકોથી વડીલો સુધી — દરેક ઉંમરે યોગ, દરેક ગામડે આરોગ્ય.
        </p>
      </div>
      <div className="mx-auto max-w-5xl px-4" aria-hidden="true">
        <CommunityYogaScene className="h-40 w-full sm:h-56" />
      </div>
    </section>
  );
}

function ImpactBand({ campaigns, events }: { campaigns: number; events: number }) {
  const tiles = [
    { value: "34", label: "Districts in the registration network" },
    { value: String(Math.max(campaigns, 0)), label: "Ongoing campaigns" },
    { value: String(Math.max(events, 0)), label: "Programs open now" },
    { value: "Free", label: "Participation in public shibirs" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-editorial lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card p-6 text-center sm:p-8">
            <div className="font-serif text-3xl font-bold text-brand-primary sm:text-4xl">
              {t.value}
            </div>
            <div className="mt-2 text-xs leading-snug text-muted-foreground sm:text-sm">
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InspirationBand() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-gradient-to-b from-accent/30 to-background">
      <SunRayCrown className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 opacity-60" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
        <LotusMark className="mx-auto h-9 w-[4.5rem]" />
        <p className="quote-serif mt-6 text-brand-primary">
          “યોગ — સ્વસ્થ શરીર, શાંત મન.”
        </p>
        <p className="mt-3 text-sm italic text-muted-foreground">
          Healthy body, calm mind — the spirit of every Board programme.
        </p>
      </div>
    </section>
  );
}

const quickLinks = [
  { to: "/campaigns", icon: CalendarDays, title: "Register for an event", desc: "Campaign and shibir registrations" },
  { to: "/idcard", icon: IdCard, title: "Digital ID card", desc: "View or download your QR entry pass" },
  { to: "/certificate", icon: BadgeCheck, title: "Participation certificate", desc: "Download your official certificate" },
  { to: "/admin", icon: FileSearch, title: "Admin panel", desc: "For Board staff and event officials" },
  { to: "/admin/checkin", icon: ScanLine, title: "Event check-in (staff)", desc: "QR and manual attendance for volunteers" },
  { to: "/contact", icon: LifeBuoy, title: "Help & contact", desc: "Support for participants and organizers" },
] as const;

function QuickLinks() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="mb-8 max-w-2xl">
        <p className="kicker">Official Services</p>
        <h2 className="display-2 mt-2">Important links</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((l) => (
          <Link
            key={l.title}
            to={l.to}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-editorial transition hover:-translate-y-0.5 hover:border-brand-primary/30"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary transition group-hover:bg-brand-primary group-hover:text-white">
              <l.icon className="h-5 w-5" />
            </span>
            <span>
              <span className="display-3 block">{l.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- page ---------- */

function RootHome() {
  const list = useServerFn(listPublicEvents);
  const listC = useServerFn(listCampaigns);

  const campaignsQ = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => listC(),
    staleTime: 15_000,
  });
  const campaigns = (campaignsQ.data?.ok ? campaignsQ.data.campaigns : []) as unknown as CampaignCardData[];

  const eventsQ = useQuery({
    queryKey: ["public-events"],
    queryFn: () => list(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const rows = (eventsQ.data?.ok ? (eventsQ.data.rows as PublicEventRow[]) : []) ?? [];

  return (
    <div>
      <Hero openEvents={rows.length} />
      <AboutBoard />
      <CampaignsSection campaigns={campaigns} isLoading={campaignsQ.isLoading} />
      <ProgramsSection rows={rows} isLoading={eventsQ.isLoading} />
      <CommunityBand />
      <ImpactBand campaigns={campaigns.length} events={rows.length} />
      <InspirationBand />
      <QuickLinks />
    </div>
  );
}
