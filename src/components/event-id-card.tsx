import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Download, Printer, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEventIdCard, recordIdCardDownload } from "@/lib/event-engine.functions";

type CardData = Awaited<ReturnType<typeof getEventIdCard>>;

interface EventIdCardProps {
  registrationNumber: string;
  cardAccess?: string;
  eventId?: string;
}

export function EventIdCard({ registrationNumber, cardAccess, eventId }: EventIdCardProps) {
  const load = useServerFn(getEventIdCard);
  const track = useServerFn(recordIdCardDownload);
  const [data, setData] = useState<CardData | null>(null);
  const [qr, setQr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const effectiveAccess =
    cardAccess ||
    (typeof window !== "undefined"
      ? window.sessionStorage.getItem(`gsyb_card_access:${registrationNumber}`) || ""
      : "");

  useEffect(() => {
    let active = true;
    if (!registrationNumber) return;

    if (typeof window !== "undefined" && effectiveAccess) {
      try {
        window.sessionStorage.setItem(`gsyb_card_access:${registrationNumber}`, effectiveAccess);
      } catch {}
    }

    setLoading(true);
    load({
      data: {
        registration_number: registrationNumber,
        access_key: effectiveAccess || undefined,
        event_id: eventId,
      },
    })
      .then(async (result) => {
        if (!active) return;
        setData(result);
        if (result.ok && result.qr_token) {
          const qrDataUrl = await QRCode.toDataURL(result.qr_token, {
            width: 360,
            margin: 4,
            errorCorrectionLevel: "M",
          });
          setQr(qrDataUrl);
        }
      })
      .catch((err) => {
        console.error("Failed to load ID card:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveAccess, eventId, load, registrationNumber]);

  async function renderCardToCanvas(
    card: NonNullable<CardData> & { ok: true },
    qrSrc: string,
  ): Promise<HTMLCanvasElement> {
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context is unavailable");

    // 1. Background & double borders
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 1200, 760);

    ctx.strokeStyle = "#E8E0D5";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 1196, 756);

    ctx.strokeStyle = "#FAF8F5";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 1180, 740);

    // 2. National Tricolor Top Stripe
    ctx.fillStyle = "#FF9933"; // Saffron
    ctx.fillRect(2, 2, 400, 10);
    ctx.fillStyle = "#FFFFFF"; // White
    ctx.fillRect(402, 2, 396, 10);
    ctx.fillStyle = "#138808"; // India Green
    ctx.fillRect(798, 2, 400, 10);

    // 3. Header Authority Branding
    ctx.fillStyle = "#0F3E3E";
    ctx.font = "bold 22px 'Noto Sans', 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("GUJARAT STATE YOG BOARD", 60, 58);

    ctx.fillStyle = "#4E7D66";
    ctx.font = "bold 16px 'Noto Sans Gujarati', 'Noto Sans', sans-serif";
    ctx.fillText(
      "ગુજરાત રાજ્ય યોગ બોર્ડ • રમતગમત, યુવા અને સાંસ્કૃતિક પ્રવૃત્તિઓ વિભાગ, ગુજરાત સરકાર",
      60,
      86,
    );

    // 4. Event Title Section
    ctx.fillStyle = "#D97706";
    ctx.font = "bold 17px 'Noto Serif Gujarati', 'Noto Serif', serif";
    ctx.fillText("“સેવા સંકલ્પ અભિયાન” અંતર્ગત", 60, 126);

    ctx.fillStyle = "#0F3E3E";
    ctx.font = "bold 34px 'Noto Serif Gujarati', 'Noto Serif', serif";
    ctx.fillText(card.event_title || "યોગ અને ધ્યાન શિબિર", 60, 170);

    // Divider line
    ctx.strokeStyle = "#E8E0D5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 196);
    ctx.lineTo(1140, 196);
    ctx.stroke();

    // 5. Left Column: Participant Information
    // Participant Name
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 14px 'Noto Sans', sans-serif";
    ctx.fillText("PARTICIPANT NAME / સહભાગીનું નામ", 60, 235);

    ctx.fillStyle = "#1C2623";
    ctx.font = "bold 28px 'Noto Sans', 'Noto Sans Gujarati', sans-serif";
    ctx.fillText((card.participant_name || "").slice(0, 36), 60, 270);

    // Registration Number
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 14px 'Noto Sans', sans-serif";
    ctx.fillText("REGISTRATION NO / નોંધણી ક્રમાંક", 60, 325);

    ctx.fillStyle = "#0F3E3E";
    ctx.font = "bold 26px monospace";
    ctx.fillText(card.participant_id, 60, 358);

    const isFiveField =
      !card.participant_type ||
      card.district?.toUpperCase().includes("VADODARA") ||
      card.event_title?.includes("વડોદરા") ||
      card.event_title?.toLowerCase().includes("vadodara");

    if (isFiveField) {
      // Authoritative 5-Field Vadodara Layout
      // District
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px 'Noto Sans', sans-serif";
      ctx.fillText("DISTRICT / વિસ્તાર", 60, 412);

      ctx.fillStyle = "#0F3E3E";
      ctx.font = "bold 20px 'Noto Sans', sans-serif";
      ctx.fillText((card.district || "VADODARA").toUpperCase(), 60, 440);

      // Reference Name
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px 'Noto Sans', sans-serif";
      ctx.fillText("REFERENCE NAME / સંદર્ભ", 60, 492);

      ctx.fillStyle = "#1C2623";
      ctx.font = "600 20px 'Noto Sans', 'Noto Sans Gujarati', sans-serif";
      ctx.fillText((card.reference_name || "DIRECT REGISTRATION").slice(0, 38), 60, 520);

      // Referral Code (ONLY IF present)
      if (card.referral_code && card.referral_code.trim()) {
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 14px 'Noto Sans', sans-serif";
        ctx.fillText("REFERRAL CODE / રેફરલ કોડ", 440, 492);

        ctx.fillStyle = "#D97706";
        ctx.font = "bold 20px monospace";
        ctx.fillText(card.referral_code.trim().toUpperCase(), 440, 520);
      }
    } else {
      // Participant Type & Zone
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px 'Noto Sans', sans-serif";
      ctx.fillText("PARTICIPANT TYPE / કેટેગરી", 60, 405);

      ctx.fillStyle = "#D97706";
      ctx.font = "bold 20px 'Noto Sans', sans-serif";
      ctx.fillText(card.participant_type || "Yog Sadhak", 60, 432);

      // District / Zone / Location
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px 'Noto Sans', sans-serif";
      ctx.fillText("DISTRICT & ZONE / જિલ્લો અને ઝોન", 400, 405);

      ctx.fillStyle = "#0F3E3E";
      ctx.font = "bold 20px 'Noto Sans', sans-serif";
      const locStr = [card.district, card.zone || card.taluka].filter(Boolean).join(" • ").toUpperCase();
      ctx.fillText(locStr || "GUJARAT", 400, 432);

      // Reference / Coach
      const refTitle = card.coach_name
        ? "COACH NAME / કોચનું નામ"
        : card.coordinator_name
        ? "COORDINATOR / સંયોજક"
        : "REFERENCE / સંદર્ભ";
      const refValue = card.coach_name || card.coordinator_name || card.reference_name || "DIRECT REGISTRATION";

      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px 'Noto Sans', sans-serif";
      ctx.fillText(refTitle, 60, 485);

      ctx.fillStyle = "#1C2623";
      ctx.font = "600 20px 'Noto Sans', 'Noto Sans Gujarati', sans-serif";
      ctx.fillText(refValue.slice(0, 38), 60, 512);

      // Referral Code (if available)
      if (card.referral_code && card.referral_code.trim()) {
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 14px 'Noto Sans', sans-serif";
        ctx.fillText("REFERRAL CODE / રેફરલ કોડ", 400, 485);

        ctx.fillStyle = "#D97706";
        ctx.font = "bold 20px monospace";
        ctx.fillText(card.referral_code.trim().toUpperCase(), 400, 512);
      }
    }

    // 6. Right Column: Event Check-in QR Code Panel
    ctx.fillStyle = "#FDFBF7";
    ctx.fillRect(810, 216, 330, 360);
    ctx.strokeStyle = "#E8E0D5";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(810, 216, 330, 360);

    const effectiveQr =
      qrSrc ||
      (card.qr_token
        ? await QRCode.toDataURL(card.qr_token, { width: 360, margin: 4, errorCorrectionLevel: "M" })
        : "");

    if (effectiveQr) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        let loaded = false;
        const done = () => {
          if (loaded) return;
          loaded = true;
          ctx.drawImage(img, 825, 235, 300, 300);
          resolve();
        };
        img.onload = done;
        img.onerror = () => {
          loaded = true;
          resolve();
        };
        img.src = effectiveQr;
        if (img.complete) done();
      });

      ctx.fillStyle = "#0F3E3E";
      ctx.font = "bold 15px 'Noto Sans Gujarati', 'Noto Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("પ્રવેશ માટે આ QR કોડ સ્કેન કરાવો", 975, 545);
      ctx.fillStyle = "#64748B";
      ctx.font = "12px 'Noto Sans', sans-serif";
      ctx.fillText("Official Digital Check-in Pass", 975, 563);
      ctx.textAlign = "start";
    }

    // 7. Event Logistics Footer Bar
    ctx.fillStyle = "#F4F8F5";
    ctx.fillRect(4, 608, 1192, 148);

    ctx.strokeStyle = "#E8E0D5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 608);
    ctx.lineTo(1196, 608);
    ctx.stroke();

    const dateText = card.event_date ? `તારીખ: ${card.event_date}` : "તારીખ: ટૂંક સમયમાં જાહેર થશે";
    const timeText = card.event_time ? `સમય: ${card.event_time}` : "સમય: ટૂંક સમયમાં જાહેર થશે";
    const venueText = card.venue ? `સ્થળ: ${card.venue}` : "સ્થળ: ટૂંક સમયમાં જાહેર થશે";

    ctx.fillStyle = "#0F3E3E";
    ctx.font = "bold 18px 'Noto Sans Gujarati', 'Noto Sans', sans-serif";
    ctx.fillText(
      `${dateText}   |   ${timeText}`,
      60,
      646,
    );

    ctx.fillStyle = "#1C2623";
    ctx.font = "500 16px 'Noto Sans Gujarati', 'Noto Sans', sans-serif";
    ctx.fillText(venueText, 60, 680);

    ctx.fillStyle = "#4E7D66";
    ctx.font = "600 13px 'Noto Sans Gujarati', 'Noto Sans', sans-serif";
    ctx.fillText(
      "સત્તાવાર ડિજિટલ પ્રવેશ પાસ • ગુજરાત રાજ્ય યોગ બોર્ડ (Gujarat State Yog Board) • હેલ્પલાઇન: 1800-233-9642",
      60,
      715,
    );

    return canvas;
  }

  async function downloadCard() {
    if (!data?.ok) return;
    setDownloading(true);
    const filename = `${data.participant_id}-id-card.png`;

    try {
      const canvas = await renderCardToCanvas(data, qr);
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Image blob creation failed"));
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, "image/png");
      });

      track({
        data: {
          card_id: data.card_id,
          registration_number: data.participant_id,
        },
      }).catch(() => {});

      toast.success("Digital ID card downloaded successfully.");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to generate download. Please try again or use Print.");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function copyPassLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Pass link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 rounded-2xl bg-white/60 border border-[#E8E0D5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#D97706]" />
        <p className="text-sm font-medium text-[#0F3E3E]">Generating official digital ID card...</p>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200">
        <p className="text-sm font-medium text-rose-700">
          {data?.error || "Could not retrieve digital ID card."}
        </p>
      </div>
    );
  }

  const isFiveField =
    !data.participant_type ||
    data.district?.toUpperCase().includes("VADODARA") ||
    data.event_title?.includes("વડોદરા") ||
    data.event_title?.toLowerCase().includes("vadodara");

  return (
    <div className="space-y-6">
      {/* Visual ID Card Preview Container */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl bg-white border border-[#E8E0D5] shadow-xl shadow-[#0F3E3E]/5"
      >
        {/* Top Tricolor Stripe */}
        <div className="h-2 w-full flex">
          <div className="w-1/3 bg-[#FF9933]" />
          <div className="w-1/3 bg-white" />
          <div className="w-1/3 bg-[#138808]" />
        </div>

        {/* Subtle Watermark Lotus Ornament */}
        <div className="absolute -right-8 -bottom-8 w-60 sm:w-80 h-60 sm:h-80 pointer-events-none opacity-[0.07] z-0">
          <img
            src="/images/lotus-transparent.svg"
            alt=""
            className="w-full h-full object-contain"
            aria-hidden="true"
          />
        </div>

        <div className="p-5 sm:p-8 space-y-6 relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D5] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                <h3 className="text-sm sm:text-base font-bold text-[#0F3E3E] tracking-tight uppercase">
                  Gujarat State Yog Board
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-[#4E7D66] font-medium mt-0.5">
                ગુજરાત રાજ્ય યોગ બોર્ડ • રમતગમત, યુવા અને સાંસ્કૃતિક પ્રવૃત્તિઓ વિભાગ
              </p>
              <p className="text-xs font-semibold text-[#D97706] mt-1">
                {data.event_title}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-[#FAF8F5] px-3 py-1 rounded-full border border-[#E8E0D5]">
              <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="text-[11px] font-semibold text-[#0F3E3E]">Verified Pass</span>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Participant Details */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Participant Name / સહભાગીનું નામ
                </p>
                <p className="text-xl sm:text-2xl font-bold text-[#1C2623] mt-0.5">{data.participant_name}</p>
              </div>

              {isFiveField ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Registration No / ક્રમાંક
                      </p>
                      <p className="text-base sm:text-lg font-mono font-bold text-[#0F3E3E] mt-0.5">
                        {data.participant_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        District / વિસ્તાર
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-[#0F3E3E] mt-0.5">
                        {data.district || "VADODARA"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-stone-100">
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Reference Name / સંદર્ભ
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-[#1C2623] mt-0.5">
                        {data.reference_name || "DIRECT REGISTRATION"}
                      </p>
                    </div>
                    {data.referral_code && (
                      <div>
                        <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Referral Code / રેફરલ કોડ
                        </p>
                        <p className="text-xs sm:text-sm font-mono font-bold text-[#D97706] mt-0.5">
                          {data.referral_code}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Registration No / ક્રમાંક
                      </p>
                      <p className="text-base sm:text-lg font-mono font-bold text-[#0F3E3E] mt-0.5">
                        {data.participant_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Category / કેટેગરી
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-[#D97706] mt-0.5">
                        {data.participant_type || "Yog Sadhak"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-stone-100">
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        District & Zone / જિલ્લો
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-[#0F3E3E] mt-0.5">
                        {[data.district, data.zone || data.taluka].filter(Boolean).join(" • ") || "Gujarat"}
                      </p>
                    </div>
                    {(data.coach_name || data.coordinator_name || data.reference_name) && (
                      <div>
                        <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          {data.coach_name
                            ? "Coach Name"
                            : data.coordinator_name
                            ? "Coordinator"
                            : "Reference"}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-[#1C2623] mt-0.5">
                          {data.coach_name || data.coordinator_name || data.reference_name}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* QR Code Panel */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E0D5] shadow-xs">
              {qr ? (
                <img
                  src={qr}
                  alt="Check-in QR Code"
                  className="w-40 h-40 rounded-lg bg-white p-2 shadow-xs border border-[#E8E0D5]"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center bg-stone-100 rounded-lg">
                  <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
                </div>
              )}
              <p className="text-xs font-semibold text-[#0F3E3E] mt-2.5 text-center">
                પ્રવેશ માટે આ QR કોડ સ્કેન કરાવો
              </p>
              <p className="text-[10px] text-[#64748B] text-center">Event Check-in QR</p>
            </div>
          </div>

          {/* Footer Logistics */}
          <div className="pt-4 border-t border-[#E8E0D5] bg-[#FAF8F5] -mx-5 -mb-5 sm:-mx-8 sm:-mb-8 p-4 sm:p-5 rounded-b-2xl">
            <div className="text-xs font-medium text-[#0F3E3E] space-y-1">
              <p className="font-bold">
                તારીખ: {data.event_date || "ટૂંક સમયમાં જાહેર થશે"} &bull; સમય: {data.event_time || "ટૂંક સમયમાં જાહેર થશે"}
              </p>
              <p className="text-[#2D4A3E]">સ્થળ: {data.venue || "સ્થળ ટૂંક સમયમાં જાહેર કરવામાં આવશે"}</p>
              <p className="text-[10.5px] text-[#5C7065] pt-0.5">
                સત્તાવાર ડિજિટલ પ્રવેશ પાસ • ગુજરાત રાજ્ય યોગ બોર્ડ • હેલ્પલાઇન: 1800-233-9642
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Mobile First */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 print:hidden">
        <Button
          onClick={downloadCard}
          disabled={downloading}
          className="h-13 px-6 rounded-xl bg-[#0F3E3E] hover:bg-[#144D4D] text-[#FAF8F5] font-bold shadow-md shadow-[#0F3E3E]/20 text-sm gap-2 cursor-pointer transition-all"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{downloading ? "Generating PNG..." : "Download ID Card (PNG)"}</span>
        </Button>

        <div className="grid grid-cols-2 sm:flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="h-12 px-4 rounded-xl border-[#E8E0D5] bg-white hover:bg-stone-50 text-[#0F3E3E] font-medium text-xs gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Pass</span>
          </Button>

          <Button
            variant="outline"
            onClick={copyPassLink}
            className="h-12 px-4 rounded-xl border-[#E8E0D5] bg-white hover:bg-stone-50 text-[#0F3E3E] font-medium text-xs gap-1.5 shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied" : "Share Link"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
