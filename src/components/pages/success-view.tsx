import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Share2, Link as LinkIcon, Sparkles } from "lucide-react";
import { useEventConfig } from "@/hooks/use-event-config";
import { WhatsAppCard } from "@/components/whatsapp-card";
import {
  formatShareMessage,
  formatTimeRange,
  formatEventDate,
} from "@/lib/event-config";
import { EventIdCard } from "@/components/event-id-card";

export function SuccessView({
  reg,
  eventSlug,
  cardAccess,
}: {
  reg: string;
  eventSlug?: string;
  cardAccess?: string;
}) {
  const { config } = useEventConfig(eventSlug ?? null);
  const [copied, setCopied] = useState<"reg" | "link" | "msg" | null>(null);
  const registerPath = eventSlug ? `/${eventSlug}/register` : "/register";

  const [shareUrl, setShareUrl] = useState(`${registerPath}?ref=${reg}`);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}${registerPath}?ref=${reg}`);
    }
  }, [registerPath, reg]);

  const shareText = formatShareMessage(config.referral.share_template, {
    title: config.general.title,
    theme: config.general.theme,
    date: formatEventDate(config.general.event_date) || "TBA",
    time: formatTimeRange(config.general.start_time, config.general.end_time) || "TBA",
    link: shareUrl,
  });

  async function copy(text: string, which: "reg" | "link" | "msg") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2623] pt-3 sm:pt-5 pb-8 sm:pb-12 px-3.5 sm:px-6 relative overflow-x-hidden">
      {/* Subtle Lotus Background Accents */}
      <div className="fixed -top-12 -right-12 w-64 sm:w-80 h-64 sm:h-80 pointer-events-none opacity-20 z-0">
        <img
          src="/images/lotus-transparent.svg"
          alt=""
          className="w-full h-full object-contain"
          aria-hidden="true"
        />
      </div>

      <div className="mx-auto max-w-2xl space-y-6 relative z-10">
        {/* Registration Confirmation Glass Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E8E0D5] bg-white/95 backdrop-blur-md shadow-lg shadow-[#0F3E3E]/5">
          {/* Top Tricolor Bar */}
          <div className="h-1.5 w-full flex">
            <div className="w-1/3 bg-[#FF9933]" />
            <div className="w-1/3 bg-white" />
            <div className="w-1/3 bg-[#138808]" />
          </div>

          <div className="p-6 text-center sm:p-8 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E8E0D5] text-[#0F3E3E] text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                <span>સત્તાવાર નોંધણી પુષ્ટિ / Confirmed</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F3E3E] tracking-tight">
                Registration Successful!
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#5C7065] max-w-md mx-auto">
                તમારી નોંધણી સફળતાપૂર્વક પૂર્ણ થઈ ગઈ છે. તમારો સત્તાવાર પ્રવેશ પાસ અને QR કોડ નીચે ઉપલબ્ધ છે.
              </p>
            </div>

            {/* Registration Number Highlight Card */}
            <div className="mx-auto max-w-sm rounded-xl border border-dashed border-[#D97706]/50 bg-[#FAF8F5] p-4 space-y-1.5 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">
                Your Registration Number / નોંધણી નંબર
              </span>
              <div className="select-all font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-[#0F3E3E]">
                {reg}
              </div>
              <Button
                onClick={() => copy(reg, "reg")}
                variant="outline"
                size="sm"
                className="mt-2 text-xs border-[#E8E0D5] text-[#0F3E3E] hover:bg-white h-9 px-4 rounded-lg shadow-xs"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {copied === "reg" ? "Copied to Clipboard!" : "Copy Registration Number"}
              </Button>
            </div>
          </div>
        </div>

        {/* Clear Next Step Instructions for the Participant */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white/90 backdrop-blur-md border border-[#E8E0D5] shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#0F3E3E] flex items-center gap-2">
            <span>📋</span>
            <span>મહત્વપૂર્ણ સૂચનાઓ / Next Steps</span>
          </h3>
          <ul className="text-xs text-[#2D4A3E] space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#D97706]">•</span>
              <span><strong>ID કાર્ડ સાચવો:</strong> નીચે આપેલ બટન પર ક્લિક કરીને તમારો ડિજિટલ ID કાર્ડ (PNG) ડાઉનલોડ કરી લો.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#D97706]">•</span>
              <span><strong>સમયસર પહોંચો:</strong> શિબિર શરૂ થવાના ૧૫ મિનિટ પહેલા સ્થળ પર પહોંચવું અનિવાર્ય છે.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#D97706]">•</span>
              <span><strong>ગેટ એન્ટ્રી:</strong> પ્રવેશ દ્વાર પર તમારો QR કોડ સ્કેન કરાવીને હાજરી નોંધાવો.</span>
            </li>
          </ul>
        </div>

        {/* Official Digital ID Card with signed QR Code */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-4 h-4 text-[#D97706]" />
            <h2 className="text-base font-bold text-[#0F3E3E]">Official Event Pass & QR</h2>
          </div>
          <EventIdCard
            registrationNumber={reg}
            cardAccess={cardAccess}
            eventId={config.id}
          />
        </div>

        <WhatsAppCard whatsapp={config.whatsapp} />

        {/* Referral & Social Sharing */}
        {config.referral.enabled && (
          <div className="overflow-hidden rounded-2xl border border-[#E8E0D5] bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#0F3E3E]">
              <Share2 className="h-5 w-5 text-[#D97706]" />
              <h3 className="text-base sm:text-lg font-bold">
                Invite Friends & Family to the Camp
              </h3>
            </div>
            <p className="text-xs text-[#5C7065]">
              Share your personal referral link with your family and yoga enthusiasts.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 rounded-xl border border-[#E8E0D5] bg-[#FAF8F5] p-2.5">
              <input
                readOnly
                value={shareUrl}
                className="w-full bg-transparent text-xs font-mono text-[#0F3E3E] outline-none px-2"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                onClick={() => copy(shareUrl, "link")}
                className="bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white text-xs whitespace-nowrap h-10 px-4 rounded-lg font-medium"
              >
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                {copied === "link" ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
