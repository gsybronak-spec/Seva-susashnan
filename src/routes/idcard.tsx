import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Printer, Download, IdCard as IdCardIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/idcard")({
  validateSearch: z.object({
    reg: z.string().optional(),
    mobile: z.string().optional(),
    event: z.string().optional(),
  }),
  head: () => ({
    meta: [{ title: `Participant ID Card — ${BRAND.name}` }],
  }),
  component: IdCardPage,
});

type CardData = {
  registration_number: string;
  full_name: string;
  mobile: string;
  gender: string | null;
  district: string | null;
  taluka: string | null;
  zone: string | null;
  participant_type: string | null;
  coach_name: string | null;
  coordinator_name: string | null;
  organization: string | null;
  qr_token: string;
  event_title: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
};

const lookupCard = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reg: z.string().trim().max(40).optional(),
      mobile: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
        .optional(),
      event_slug: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let reg:
      | {
          registration_number: string;
          full_name: string;
          mobile: string;
          gender: string | null;
          district: string | null;
          taluka: string | null;
          custom_fields: Record<string, unknown> | null;
          organization: string | null;
          designation?: string | null;
          qr_token: string | null;
          event_id: string | null;
        }
      | undefined;

    if (data.reg) {
      // Registration numbers are globally unique — query directly to preserve exact event context
      const { data: rows } = await supabaseAdmin
        .from("registrations")
        .select(
          "registration_number, full_name, mobile, gender, district, taluka, custom_fields, organization, designation, qr_token, event_id",
        )
        .eq("registration_number", data.reg.trim())
        .limit(1);
      reg = (rows ?? [])[0] as typeof reg;
    } else if (data.mobile) {
      let targetEventId: string | null = null;
      if (data.event_slug) {
        const { resolveEvent } = await import("@/lib/event-resolver.server");
        const resolved = await resolveEvent(data.event_slug);
        targetEventId = resolved?.event?.id ?? null;
      }

      let q = supabaseAdmin
        .from("registrations")
        .select(
          "registration_number, full_name, mobile, gender, district, taluka, custom_fields, organization, designation, qr_token, event_id",
        )
        .eq("mobile", data.mobile.trim())
        .order("created_at", { ascending: false });

      if (targetEventId) {
        q = q.eq("event_id", targetEventId);
      }

      const { data: rows } = await q.limit(1);
      reg = (rows ?? [])[0] as typeof reg;
    } else {
      return { ok: false as const, error: "Provide a registration number or mobile." };
    }

    if (!reg) return { ok: false as const, error: "Registration not found." };

    // Resolve the matching event details from the registration's actual event_id
    let eventTitle = "Vadodara Yog Shibir";
    let eventDate: string | null = "2026-09-20";
    let eventVenue: string | null = "Railway Police Parade Ground, Kothi Kacheri Char Rasta, Behind Kothi Kacheri, Vadodara, Gujarat";
    let startTime: string | null = "06:00";
    let endTime: string | null = "08:00";

    if (reg.event_id) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("general, venue")
        .eq("id", reg.event_id)
        .maybeSingle();
      const g = (ev?.general ?? {}) as {
        title?: string;
        event_date?: string | null;
        venue?: string | null;
        start_time?: string | null;
        end_time?: string | null;
      };
      if (g.title) eventTitle = g.title;
      if (g.event_date) eventDate = g.event_date;
      if (g.start_time) startTime = g.start_time;
      if (g.end_time) endTime = g.end_time;
      eventVenue = ev?.venue ?? g.venue ?? eventVenue;
    }

    // Ensure the row has a QR token (defensive backfill).
    let token = reg.qr_token;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await supabaseAdmin
        .from("registrations")
        .update({ qr_token: token })
        .eq("registration_number", reg.registration_number);
    }

    const cf = (reg.custom_fields ?? {}) as Record<string, unknown>;
    const rawParticipantType =
      typeof cf.participant_type === "string" && cf.participant_type.trim().length > 0
        ? cf.participant_type.trim()
        : typeof reg.designation === "string" && reg.designation.trim().length > 0
        ? reg.designation.trim()
        : null;

    // Strict normalization to allowed options: Yog Coach, Yog Trainer, Yog Sadhak
    const participantType =
      rawParticipantType === "Yoga Coach" || rawParticipantType === "Yog Coach"
        ? "Yog Coach"
        : rawParticipantType === "Yoga Trainer" || rawParticipantType === "Yog Trainer"
        ? "Yog Trainer"
        : rawParticipantType === "Yoga Sadhak" || rawParticipantType === "Yog Sadhak"
        ? "Yog Sadhak"
        : rawParticipantType;

    // Coach Name is ONLY applicable/visible for Yog Trainers
    const coachName =
      participantType === "Yog Trainer" &&
      typeof cf.coach_name === "string" &&
      cf.coach_name.trim().length > 0
        ? cf.coach_name.trim()
        : null;

    const coordinatorName =
      typeof cf.coordinator_name === "string" && cf.coordinator_name.trim().length > 0
        ? cf.coordinator_name.trim()
        : null;

    const zone =
      typeof cf.zone === "string" && cf.zone.trim().length > 0
        ? cf.zone.trim()
        : null;

    return {
      ok: true as const,
      card: {
        registration_number: reg.registration_number,
        full_name: reg.full_name,
        mobile: reg.mobile,
        gender: reg.gender,
        district: reg.district || "Vadodara",
        taluka: reg.taluka,
        zone,
        participant_type: participantType,
        coach_name: coachName,
        coordinator_name: coordinatorName,
        organization: reg.organization,
        qr_token: token,
        event_title: eventTitle,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        venue: eventVenue,
      } as CardData,
    };
  });

function formatEventDate(iso: string | null): string {
  if (!iso || iso === "2026-09-20") return "Sunday, 20 September 2026";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(start: string | null, end: string | null): string {
  const to12h = (t: string) => {
    const parts = t.trim().split(":");
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parts[1].padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
    return t;
  };
  if (start && end) return `${to12h(start)} – ${to12h(end)}`;
  if (start) return to12h(start);
  if (end) return to12h(end);
  return "6:00 AM – 8:00 AM";
}

function IdCardPage() {
  const search = useSearch({ from: "/idcard" });
  const lookup = useServerFn(lookupCard);
  const [data, setData] = useState<CardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileInput, setMobileInput] = useState(search.mobile ?? "");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const load = async (reg?: string, mobile?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await lookup({ data: { reg, mobile, event_slug: search.event } });
      if (!res.ok) {
        setError(res.error);
        setData(null);
        return;
      }
      setData(res.card);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (search.reg) void load(search.reg);
    else if (search.mobile) void load(undefined, search.mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.reg, search.mobile, search.event]);

  // Render high-contrast QR code
  useEffect(() => {
    if (!data?.qr_token) return;
    const payload = JSON.stringify({
      t: data.qr_token,
      r: data.registration_number,
    });
    QRCode.toDataURL(payload, {
      width: 512,
      margin: 2,
      color: { dark: "#1A1A1A", light: "#FFFFFF" },
    }).then(setQrDataUrl);
  }, [data?.qr_token, data?.registration_number]);

  async function downloadPng() {
    if (!cardRef.current || !data) return;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `gsyb-pass-${data.registration_number}.png`;
    a.click();
  }

  function printCard() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 text-center print:hidden">
        <p className="kicker justify-center">Digital Entry Pass</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-primary sm:text-3xl">
          Participant ID Card
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Keep this official digital pass ready on your phone or print it for entry at the venue.
        </p>
      </div>

      {!data && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm print:hidden">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mob">Find by Mobile Number</Label>
              <Input
                id="mob"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="10-digit registered mobile"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button
              className="w-full"
              disabled={busy || mobileInput.length !== 10}
              onClick={() => load(undefined, mobileInput)}
            >
              {busy ? "Looking up..." : "View ID Card"}
            </Button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* DIGITAL PARTICIPANT PASS */}
          <div
            ref={cardRef}
            className="overflow-hidden rounded-2xl border-2 border-brand-primary/80 bg-white text-slate-900 shadow-xl print:m-0 print:w-full print:border-none print:shadow-none"
            style={{ minWidth: "320px" }}
          >
            {/* Top brand ribbon */}
            <div className="brand-bar h-2 w-full" />

            {/* Official Header */}
            <div className="border-b border-brand-primary/20 bg-brand-primary px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm">
                  <img
                    src={BRAND.logoPath}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    {BRAND.nameDisplay}
                  </div>
                  <div className="text-[10px] text-white/85 leading-tight">
                    {BRAND.departmentLine}
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between border-t border-white/20 pt-2.5">
                <div className="font-serif text-lg font-bold leading-tight text-white sm:text-xl">
                  {data.event_title}
                </div>
                <span className="shrink-0 rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Entry Pass
                </span>
              </div>
            </div>

            {/* Event Timing Banner */}
            {(data.event_date || data.start_time) && (
              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-amber-500/10 px-5 py-2 text-[11px] font-medium text-amber-950">
                {data.event_date && (
                  <span>📅 {formatEventDate(data.event_date)}</span>
                )}
                {(data.start_time || data.end_time) && (
                  <span>⏰ {formatTime(data.start_time, data.end_time)}</span>
                )}
              </div>
            )}

            {/* Participant Identity Block */}
            <div className="border-b border-border/80 bg-gradient-to-b from-slate-50 to-white px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Participant Name
                  </div>
                  <div className="font-serif text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
                    {data.full_name}
                  </div>
                </div>
                {data.participant_type && (
                  <span className="inline-flex items-center rounded-md border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">
                    {data.participant_type}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs shadow-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">ID:</span>
                  <span className="font-mono font-bold text-brand-primary">{data.registration_number}</span>
                </div>
                {data.gender && (
                  <span className="text-xs text-slate-600">
                    Gender: <strong className="text-slate-800">{data.gender}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Structured Location & Assignment Chips */}
            <div className="border-b border-border/80 bg-white px-5 py-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Participation Details
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {data.district && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">District</div>
                    <div className="font-semibold text-slate-800 truncate">{data.district}</div>
                  </div>
                )}
                {data.taluka && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Taluka</div>
                    <div className="font-semibold text-slate-800 truncate">{data.taluka}</div>
                  </div>
                )}
                {data.zone && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                    <div className="text-[9px] uppercase tracking-wider text-amber-800 font-bold">Zone</div>
                    <div className="font-bold text-amber-900 truncate">{data.zone}</div>
                  </div>
                )}
                {data.coach_name && (
                  <div className="col-span-2 sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Coach Name</div>
                    <div className="font-semibold text-slate-800">{data.coach_name}</div>
                  </div>
                )}
                {data.coordinator_name && (
                  <div className="col-span-2 sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Coordinator Name</div>
                    <div className="font-semibold text-slate-800">{data.coordinator_name}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Venue Container */}
            {data.venue && (
              <div className="border-b border-border/80 bg-slate-50/50 px-5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Venue Address
                </div>
                <div className="mt-0.5 text-xs font-medium leading-relaxed text-slate-800">
                  {data.venue}
                </div>
              </div>
            )}

            {/* High-Contrast QR Code Pass */}
            <div className="flex flex-col items-center justify-center bg-white px-5 py-5 text-center">
              <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white p-2.5 shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Check-in QR Pass for ${data.registration_number}`}
                    className="h-44 w-44 object-contain"
                  />
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                    Generating QR…
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-brand-primary">
                SCAN TO CHECK IN AT VENUE
              </p>
              <p className="text-[11px] text-slate-500">
                Present this QR code to the event coordinator at the registration desk.
              </p>
            </div>

            {/* Security Strip Footer */}
            <div className="flex items-center justify-center gap-1.5 border-t border-border bg-slate-100 px-4 py-2.5 text-center text-[10px] font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
              <span>Gujarat State Yog Board • Verified Participant Pass</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row print:hidden">
            <Button variant="outline" className="flex-1 h-11" onClick={printCard}>
              <Printer className="mr-2 h-4 w-4" />
              Print Pass
            </Button>
            <Button className="flex-1 h-11" onClick={downloadPng}>
              <Download className="mr-2 h-4 w-4" />
              Download Pass (PNG)
            </Button>
          </div>

          {/* Guidelines */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 print:hidden">
            <p className="font-bold text-amber-950">Important Event Guidelines:</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-amber-900/90">
              <li>Arrive 15 minutes before the scheduled start time.</li>
              <li>Have this digital pass or printed copy ready at the entry checkpoint.</li>
              <li>Attendance verified via QR scan is required to qualify for the participation certificate.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
