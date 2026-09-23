import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  IdCard,
  MapPin,
  QrCode,
  Award,
  UserCheck,
  Sparkles,
  Phone,
  Users,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { listPublicEvents } from "@/lib/event.functions";
import { formatTimeRange } from "@/lib/event-config";

/**
 * GUJARAT STATE YOG BOARD — Official Digital Event Registration Portal
 *
 * Streamlined Information Architecture:
 * 1. SiteHeader (Global in __root.tsx)
 * 2. Compact Premium Hero (One static serene Yoga visual + official identity + CTAs)
 * 3. Active / Upcoming Events (Generic dynamic listing of open shibirs & programmes)
 * 4. 3-Feature Workflow Strip (Registration → Digital ID/QR → Attendance & Certificate)
 * 5. SiteFooter (Global in __root.tsx)
 */

export const Route = createFileRoute("/")({
  loader: async () => {
    return await listPublicEvents();
  },
  component: RootHome,
  head: () => ({
    meta: [
      { title: `${BRAND.nameDisplay} — Official Portal` },
      {
        name: "description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. The official platform for yoga & meditation events, registrations, digital ID passes, and attendance.`,
      },
      { property: "og:title", content: `${BRAND.nameDisplay} — Official Portal` },
      {
        property: "og:description",
        content: `${BRAND.name} — ${BRAND.departmentLine}. Register for official yoga and meditation shibirs across Gujarat.`,
      },
    ],
  }),
});

type PublicEventRow = {
  id: string;
  slug: string | null;
  title: string;
  level?: string | null;
  type?: string | null;
  event_date: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  event_time?: string | null;
  venue?: string | null;
  coverage_type: "single" | "zone" | "state";
  coverage_district_names: string[];
  status: string | null;
  registration_enabled: boolean;
  registration_status?: "open" | "in_progress" | "completed" | "closed" | "external";
  registration_message_gu?: string;
  registration_message_en?: string;
  registration_mode?: string | null;
  contact_mobile?: string | null;
  expected_participants?: number | null;
};

function formatEventDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Yet to be Declared";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventTime(
  eventTime: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  if (startTime && endTime) {
    return formatTimeRange(startTime, endTime);
  }
  if (eventTime && eventTime.trim().length > 0 && !eventTime.includes("00:00:00")) {
    if (eventTime.includes("AM") || eventTime.includes("PM") || eventTime.includes("–") || eventTime.includes("-")) {
      return eventTime.trim();
    }
    return formatTimeRange(eventTime, endTime);
  }
  if (startTime) {
    return formatTimeRange(startTime, endTime);
  }
  return "Yet to be Declared";
}

/* ============================================================
   1. COMPACT PREMIUM HERO
   ============================================================ */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-sunwash/60 via-background to-background py-6 sm:py-10 lg:py-12">
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          {/* Official Portal Copy */}
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-brand-primary/20 bg-brand-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
              <span>{BRAND.departmentLine}</span>
            </div>

            <h1 className="display-1 mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {BRAND.nameDisplay}
            </h1>

            <p className="gujarati-display mt-2.5 text-base font-semibold leading-snug text-brand-primary sm:text-lg">
              યોગથી સ્વસ્થ જીવન તરફ એક પગલું — સમગ્ર ગુજરાત માટે યોગ અને ધ્યાનની સત્તાવાર પહેલ.
            </p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              ગુજરાત રાજ્ય યોગ બોર્ડનું સત્તાવાર ડિજિટલ રજીસ્ટ્રેશન પોર્ટલ. રાજ્યભરની શિબિરોમાં
              સરળતાથી નોંધણી કરો, ઇન્સ્ટન્ટ ડિજિટલ ID કાર્ડ મેળવો અને કાર્યક્રમમાં ભાગ લો.
            </p>

            {/* Thumb-friendly action CTAs (Immediately accessible in first viewport) */}
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <a
                href="#events"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
              >
                <span>ચાલુ કાર્યક્રમો જુઓ</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                to="/idcard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-brand-primary shadow-xs transition hover:bg-muted active:scale-[0.98]"
              >
                <IdCard className="h-4 w-4" />
                <span>Digital ID Card</span>
              </Link>
            </div>
          </div>

          {/* Single Premium Static Yoga Visual */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
              <img
                src="/images/yoga-hero-dawn.jpg"
                alt="Serene Yoga and Meditation at Dawn in Gujarat"
                width={800}
                height={500}
                className="h-40 w-full object-cover sm:h-56 lg:h-64"
                loading="eager"
              />
              <div className="border-t border-border/60 bg-card/95 px-4 py-2 text-center text-xs text-muted-foreground">
                <span className="font-medium text-foreground">સત્તાવાર શિબિર નોંધણી પોર્ટલ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   2. CURRENT / UPCOMING EVENTS (GENERIC DYNAMIC ENGINE)
   ============================================================ */

function EventsSection({
  rows,
  isLoading,
}: {
  rows: PublicEventRow[];
  isLoading: boolean;
}) {
  return (
    <section id="events" className="scroll-mt-16 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="mb-6 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-primary">
            <span>સત્તાવાર આયોજન</span>
          </div>
          <h2 className="display-2 mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
            ચાલુ કાર્યક્રમો
          </h2>
          <p className="gujarati-display mt-1.5 text-sm font-medium text-muted-foreground sm:text-base">
            આગામી યોગ શિબિર અને કાર્યક્રમોમાં નોંધણી કરો.
          </p>
        </div>

        {/* Dynamic Event Content */}
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">કાર્યક્રમો લોડ થઈ રહ્યા છે…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-serif text-base font-semibold text-foreground">
              હાલમાં કોઈ કાર્યક્રમ માટે નોંધણી ખુલ્લી નથી.
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              નવી શિબિર અને કાર્યક્રમો ટૂંક સમયમાં અહીં જાહેર કરવામાં આવશે.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {rows.map((e) => {
              const eventDateStr = formatEventDate(e.event_date);
              const eventTimeStr = formatEventTime(e.event_time, e.start_time, e.end_time);
              const venueStr = e.venue && e.venue.trim().length > 0 ? e.venue.trim() : null;
              const levelLabel =
                e.level === "State"
                  ? "રાજ્ય કક્ષા (State Level)"
                  : e.level === "Municipal"
                    ? "મહાનગરપાલિકા (Municipal)"
                    : "જિલ્લા કક્ષા (District)";

              return (
                <div
                  key={e.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
                >
                  <div>
                    {/* Header Badges: Level + Registration Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                        {levelLabel}
                      </span>

                      {e.registration_enabled ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          નોંધણી ચાલુ (Open)
                        </span>
                      ) : e.registration_status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                          <Award className="h-3 w-3 text-brand-primary" />
                          શિબિર પૂર્ણ (Completed)
                        </span>
                      ) : e.registration_status === "in_progress" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
                          શિબિર ચાલુ છે (In Progress)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                          {e.registration_status === "external" ? "બાહ્ય પોર્ટલ પર નોંધણી" : "નોંધણી બંધ (Closed)"}
                        </span>
                      )}
                    </div>

                    {/* Event Title */}
                    <h3 className="font-serif mt-3 text-lg font-bold text-foreground sm:text-xl">
                      {e.title}
                    </h3>

                    {/* Logistics Details */}
                    <div className="mt-3.5 space-y-2.5 text-xs text-muted-foreground sm:text-sm">
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                        <span className="font-medium text-foreground">
                          {eventDateStr && !eventDateStr.toLowerCase().includes("declared")
                            ? eventDateStr
                            : "Date: Yet to be Declared"}
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                        <span className="text-foreground font-medium">
                          {eventTimeStr && !eventTimeStr.toLowerCase().includes("declared")
                            ? eventTimeStr
                            : "Time: Yet to be Declared"}
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                        <span className={`leading-relaxed ${venueStr ? "text-foreground" : "text-muted-foreground italic"}`}>
                          {venueStr || "સ્થળ ટૂંક સમયમાં જાહેર કરવામાં આવશે"}
                        </span>
                      </div>

                      {e.expected_participants != null && e.expected_participants > 0 && (
                        <div className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 shrink-0 text-brand-primary" />
                          <span>
                            અપેક્ષિત સંખ્યા:{" "}
                            <strong className="font-medium text-foreground">
                              {Number(e.expected_participants).toLocaleString("en-IN")}
                            </strong>
                          </span>
                        </div>
                      )}

                      {e.contact_mobile && (
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-4 w-4 shrink-0 text-brand-primary" />
                          <span>
                            સંપર્ક:{" "}
                            <strong className="font-mono text-foreground font-semibold">
                              {e.contact_mobile}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="mt-6 pt-2">
                    {e.registration_enabled ? (
                      <Link
                        to="/$event/register"
                        params={{ event: e.slug ?? "" }}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white shadow-xs transition hover:opacity-90 active:scale-[0.99]"
                      >
                        <span>નોંધણી કરો (Register Now)</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : e.registration_status === "completed" ? (
                      <Link
                        to="/$event/certificate"
                        params={{ event: e.slug ?? "" }}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white shadow-xs transition hover:opacity-90 active:scale-[0.99]"
                      >
                        <Award className="h-4 w-4" />
                        <span>પ્રમાણપત્ર મેળવો (Download Certificate)</span>
                      </Link>
                    ) : e.registration_status === "in_progress" ? (
                      <div className="space-y-1.5">
                        <div className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500/10 text-amber-800 px-5 text-xs sm:text-sm font-semibold border border-amber-500/20">
                          <span>શિબિર ચાલુ છે (Registration Closed)</span>
                        </div>
                        {e.contact_mobile && (
                          <p className="text-[11px] text-center text-muted-foreground">
                            વધુ વિગતો માટે સંપર્ક: <span className="font-mono font-bold text-foreground">{e.contact_mobile}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-muted/80 text-muted-foreground px-5 text-xs sm:text-sm font-semibold border border-border">
                          <span>
                            {e.registration_status === "external"
                              ? "બાહ્ય પોર્ટલ પર નોંધણી (External Portal)"
                              : "નોંધણી બંધ થયેલ છે (Registration Closed)"}
                          </span>
                        </div>
                        {e.contact_mobile && (
                          <p className="text-[11px] text-center text-muted-foreground">
                            વધુ વિગતો માટે સંપર્ક: <span className="font-mono font-bold text-foreground">{e.contact_mobile}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   3. SMALL WORKFLOW STRIP (3-STEP PARTICIPATION JOURNEY)
   ============================================================ */

function WorkflowStrip() {
  const steps = [
    {
      step: "01",
      icon: UserCheck,
      title: "સરળ Registration",
      subtitle: "તમારી નોંધણી સરળતાથી પૂર્ણ કરો",
      desc: "મોબાઇલ નંબર અને વિગતો ભરીને 1 મિનિટમાં શિબિર માટે નોંધણી કરો.",
    },
    {
      step: "02",
      icon: QrCode,
      title: "Digital ID & QR",
      subtitle: "સુરક્ષિત Digital ID અને QR મેળવો",
      desc: "નોંધણી પૂર્ણ થતાં જ તમારું સત્તાવાર ડિજિટલ પાસ અને એન્ટ્રી QR કોડ ડાઉનલોડ કરો.",
    },
    {
      step: "03",
      icon: Award,
      title: "Certificate",
      subtitle: "શિબિર પૂર્ણ થયા બાદ પ્રમાણપત્ર મેળવો",
      desc: "યોગ શિબિર પૂર્ણ થયા બાદ તમારું સત્તાવાર ભાગીદારી પ્રમાણપત્ર ડાઉનલોડ કરો.",
    },
  ];

  return (
    <section className="border-t border-border bg-sunwash/40 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
            ભાગીદારી પ્રક્રિયા
          </p>
          <h2 className="font-serif mt-1 text-lg font-bold text-foreground sm:text-xl">
            માત્ર 3 સરળ પગલાંમાં પોર્ટલનો લાભ લો
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.step}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-brand-primary/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-serif text-sm font-bold text-muted-foreground/60">
                  {s.step}
                </span>
              </div>
              <h3 className="font-serif mt-3 text-base font-bold text-foreground">
                {s.title}
              </h3>
              <p className="gujarati-display mt-0.5 text-xs font-semibold text-brand-primary">
                {s.subtitle}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   MAIN HOMEPAGE COMPONENT
   ============================================================ */

function RootHome() {
  const initialData = Route.useLoaderData();
  const list = useServerFn(listPublicEvents);

  const eventsQ = useQuery({
    queryKey: ["public-events"],
    queryFn: () => list(),
    initialData,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const rows = (eventsQ.data?.ok ? (eventsQ.data.rows as PublicEventRow[]) : []) ?? [];

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col">
      {/* 1. Compact Hero */}
      <Hero />

      {/* 2. Active Events Section */}
      <EventsSection rows={rows} isLoading={eventsQ.isLoading} />

      {/* 3. Small Workflow / Features Strip */}
      <WorkflowStrip />
    </div>
  );
}
