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
  organization: string | null;
  qr_token: string;
  event_title: string;
  event_date: string | null;
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
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEvent } = await import("@/lib/event-resolver.server");

    // Resolve the event by explicit slug, else the default microsite.
    const resolved = await resolveEvent(null);
    if (!resolved?.event?.id) return { ok: false as const, error: "Event not available." };
    const eventId = resolved.event.id as string;

    let query = supabaseAdmin
      .from("registrations")
      .select(
        "registration_number, full_name, mobile, gender, district, organization, qr_token",
      )
      .eq("event_id", eventId)
      .limit(1);
    if (data.reg) query = query.eq("registration_number", data.reg.trim());
    else if (data.mobile) query = query.eq("mobile", data.mobile.trim());
    else return { ok: false as const, error: "Provide a registration number or mobile." };

    const { data: rows } = await query;
    const reg = (rows ?? [])[0] as
      | {
          registration_number: string;
          full_name: string;
          mobile: string;
          gender: string | null;
          district: string | null;
          organization: string | null;
          qr_token: string | null;
        }
      | undefined;
    if (!reg) return { ok: false as const, error: "Registration not found." };

    // Ensure the row has a QR token (defensive backfill).
    let token = reg.qr_token;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await supabaseAdmin
        .from("registrations")
        .update({ qr_token: token })
        .eq("registration_number", reg.registration_number);
    }

    return {
      ok: true as const,
      card: {
        ...reg,
        qr_token: token,
        event_title:
          (resolved.event.general as { title?: string } | null)?.title ?? "Event",
        event_date:
          (resolved.event.general as { event_date?: string | null } | null)?.event_date ?? null,
      } as CardData,
    };
  });

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
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
      const res = await lookup({ data: { reg, mobile } });
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
  }, [search.reg, search.mobile]);

  // Render the QR code onto a canvas when card data arrives.
  useEffect(() => {
    if (!data?.qr_token) return;
    const payload = JSON.stringify({
      t: data.qr_token,
      r: data.registration_number,
    });
    QRCode.toDataURL(payload, {
      width: 512,
      margin: 1,
      color: { dark: "#0F766E", light: "#FFFFFF" },
    }).then(setQrDataUrl);
  }, [data?.qr_token, data?.registration_number]);

  async function downloadPng() {
    if (!cardRef.current || !data) return;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `idcard-${data.registration_number}.png`;
    a.click();
  }

  function printCard() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 print:max-w-none">
      <div className="mb-6 text-center print:hidden">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-brand-primary">
          <IdCardIcon className="h-6 w-6" />
          Your Event ID Card
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep this card with you and show it at the check-in desk.
        </p>
      </div>

      {!data && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm print:hidden">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mob">Mobile Number</Label>
              <Input
                id="mob"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="10-digit mobile"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full"
              disabled={busy || mobileInput.length !== 10}
              onClick={() => load(undefined, mobileInput)}
            >
              {busy ? "Loading…" : "View My ID Card"}
            </Button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* The printable card */}
          <div
            ref={cardRef}
            className="overflow-hidden rounded-2xl border-2 border-brand-primary bg-white shadow-lg"
          >
            <div className="brand-bar h-2 w-full" />
            <div className="bg-brand-primary px-4 py-3 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
                {BRAND.nameDisplay}
              </div>
              <div className="text-lg font-bold leading-tight">{data.event_title}</div>
              <div className="text-[10px] opacity-80">Participant ID Card</div>
            </div>
            <div className="flex gap-4 p-4">
              <div className="flex-1 space-y-2 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</div>
                  <div className="font-bold text-foreground">{data.full_name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Participant ID</div>
                  <div className="font-mono font-bold text-brand-primary">{data.registration_number}</div>
                </div>
                {data.district && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">District</div>
                    <div>{data.district}</div>
                  </div>
                )}
                {data.organization && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Organization</div>
                    <div>{data.organization}</div>
                  </div>
                )}
                {data.event_date && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</div>
                    <div>{formatEventDate(data.event_date)}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center justify-start">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Check-in QR code" className="h-28 w-28" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    QR…
                  </div>
                )}
                <div className="mt-1 text-[9px] text-muted-foreground">Scan to check in</div>
              </div>
            </div>
            <div className="border-t border-border bg-muted/40 px-4 py-2 text-center text-[10px] text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              {BRAND.name} — {data.event_title}
            </div>
          </div>

          <div className="mt-4 flex gap-2 print:hidden">
            <Button variant="outline" className="flex-1" onClick={printCard}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button className="flex-1" onClick={downloadPng}>
              <Download className="mr-2 h-4 w-4" />
              Download PNG
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-4 text-sm print:hidden">
            <p className="font-medium text-brand-primary">Instructions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Bring this ID card (printed or on your phone) to the shibir venue.</li>
              <li>Show the QR code at the check-in desk to mark your attendance.</li>
              <li>Your participation certificate depends on your recorded attendance.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
