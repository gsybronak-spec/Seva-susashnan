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

/* ---------- sections ---------- */

function Hero({ openEvents, firstEventSlug }: { openEvents: number; firstEventSlug?: string | null }) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-sunwash to-background py-10 sm:py-14">
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* copy */}
          <div>
            <p className="kicker">{BRAND.departmentLine}</p>
            <h1 className="display-1 mt-3">{BRAND.nameDisplay}</h1>
            <p className="gujarati-display mt-4 text-base font-semibold text-foreground/90 sm:text-lg">
              યોગથી સ્વસ્થ જીવન તરફ એક પગલું — સમગ્ર ગુજરાત માટે યોગ અને ધ્યાનની સત્તાવાર પહેલ.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              The official digital platform of the Gujarat State Yog Board. Discover statewide
              yoga &amp; meditation campaigns, register for physical shibirs, and receive your
              digital participant pass and verified certificate.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {firstEventSlug ? (
                <Link
                  to="/$event/register"
                  params={{ event: firstEventSlug }}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Register for Shibir <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/campaigns"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Explore Campaigns <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/idcard"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-brand-primary shadow-xs transition hover:bg-muted"
              >
                <IdCard className="h-4 w-4" />
                Download ID Pass
              </Link>
            </div>
          </div>

          {/* Featured Highlight Card */}
          <div className="rounded-2xl border border-brand-primary/20 bg-card p-6 shadow-md sm:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
                  Official Public Shibir
                </div>
                <div className="font-serif text-lg font-bold text-foreground">
                  Vadodara Yog Shibir
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Date:</span>
                <span>Sunday, 20 September 2026 (6:00 AM to 8:00 AM)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-foreground">Venue:</span>
                <span>Railway Police Parade Ground, Kothi Kacheri Char Rasta, Behind Kothi Kacheri, Vadodara, Gujarat</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Registrations Open
                </span>
                <span className="text-[11px] text-muted-foreground">Free Participation</span>
              </div>
            </div>
            <div className="mt-5">
              <Link
                to="/$event/register"
                params={{ event: "vadodara-yog-shibir" }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
              >
                Register Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutBoard() {
  const points = [
    {
      title: "Statewide Shibir Programs",
      body: "Public yoga and meditation camps conducted across Gujarat's districts, organized under the Board for citizen health and wellbeing.",
    },
    {
      title: "Official & Verified Credentials",
      body: "Participants receive an official digital ID pass with secure QR verification for venue entry, and participation certificates.",
    },
    {
      title: "Free Citizen Participation",
      body: "All Board shibirs and wellness campaigns are completely free and open to citizens, coaches, trainers, and sadhaks.",
    },
  ];
  return (
    <section className="border-b border-border bg-card py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="kicker">About the Board</p>
          <h2 className="display-2 mt-2">A healthier Gujarat through yoga</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The <span className="font-semibold text-foreground">Gujarat State Yog Board</span>,
            operating under the {BRAND.departmentLine.replace(/^Under /, "")}, leads the state&apos;s
            movement for wellness and holistic health with a modern digital platform.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-background p-5 shadow-xs">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <LotusBadge className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-bold text-brand-primary">{p.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
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
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16" id="campaigns">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
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
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
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
    <section className="border-y border-border bg-sunwash py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 max-w-2xl">
          <p className="kicker">Programs &amp; Events</p>
          <h2 className="display-2 mt-2">Open for registration</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Choose an upcoming program to view details and register. Your participant ID pass and
            venue QR code are generated instantly upon registration.
          </p>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading programs…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No events are open right now. New programs are announced regularly.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {rows.map((e) => (
              <li key={e.id}>
                <Link
                  to="/$event/register"
                  params={{ event: e.slug ?? "" }}
                  className="group flex flex-col gap-3 p-5 transition hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base font-bold text-foreground group-hover:text-brand-primary group-hover:underline">
                      {e.title}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {e.event_date && (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <CalendarDays className="h-3.5 w-3.5 text-brand-primary" />
                          {formatDate(e.event_date)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                        {e.coverage_type === "state"
                          ? "State-wide"
                          : e.coverage_type === "zone"
                            ? `Zone · ${e.coverage_district_names?.length ?? 0} districts`
                            : (e.coverage_district_names?.[0] ?? "District")}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition group-hover:opacity-90">
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
    <section className="overflow-hidden bg-maroonwash py-10 sm:py-12" aria-hidden="false">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="kicker justify-center">Yoga for every generation</p>
        <p className="gujarati-display mx-auto mt-3 max-w-2xl text-base font-semibold text-foreground/85 sm:text-lg">
          બાળકોથી વડીલો સુધી — દરેક ઉંમરે યોગ, દરેક ગામડે આરોગ્ય.
        </p>
      </div>
      <div className="mx-auto mt-6 max-w-5xl px-4" aria-hidden="true">
        <CommunityYogaScene className="h-28 w-full sm:h-40" />
      </div>
    </section>
  );
}

function ImpactBand({ campaigns, events }: { campaigns: number; events: number }) {
  const tiles = [
    { value: "34", label: "Districts in registration network" },
    { value: String(Math.max(campaigns, 0)), label: "Active state campaigns" },
    { value: String(Math.max(events, 0)), label: "Open shibir programs" },
    { value: "100% Free", label: "Citizen participation" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-xs lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card p-5 text-center sm:p-6">
            <div className="font-serif text-2xl font-bold text-brand-primary sm:text-3xl">
              {t.value}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
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
  const firstEventSlug = rows.find((r) => r.slug === "vadodara-yog-shibir")?.slug || rows[0]?.slug;

  return (
    <div>
      <Hero openEvents={rows.length} firstEventSlug={firstEventSlug} />
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
