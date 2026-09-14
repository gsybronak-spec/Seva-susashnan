import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Share2, MessageCircle, Facebook, Link as LinkIcon, IdCard } from "lucide-react";
import { useEventConfig } from "@/hooks/use-event-config";
import { WhatsAppCard } from "@/components/whatsapp-card";
import {
  formatShareMessage,
  formatTimeRange,
  formatEventDate,
} from "@/lib/event-config";

export function SuccessView({ reg, eventSlug }: { reg: string; eventSlug?: string }) {
  const { config } = useEventConfig(eventSlug ?? null);
  const [copied, setCopied] = useState<"reg" | "link" | "msg" | null>(null);
  const registerPath = eventSlug ? `/${eventSlug}/register` : "/register";

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${registerPath}?ref=${reg}`
      : `${registerPath}?ref=${reg}`;

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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <div className="p-6 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-success/10 text-brand-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-brand-primary sm:text-3xl">
            Registration Successful
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you for registering.
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-xl border border-dashed border-brand-primary/40 bg-accent/30 p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Your Participant ID
            </div>
            <div className="mt-1 select-all font-mono text-2xl font-bold tracking-wider text-brand-primary">
              {reg}
            </div>
            <Button
              onClick={() => copy(reg, "reg")}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied === "reg" ? "Copied!" : "Copy Participant ID"}
            </Button>
          </div>

          {/* Digital ID card — the core physical-event deliverable */}
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-brand-accent/50 bg-brand-accent/5 p-5">
            <div className="flex items-center justify-center gap-2 font-semibold text-brand-primary">
              <IdCard className="h-5 w-5" />
              Get Your Event ID Card
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Download your ID card with the check-in QR code. Bring it to the shibir
              venue — show it at the check-in desk to mark your attendance.
            </p>
            <Button asChild className="mt-3 w-full">
              <Link
                to="/idcard"
                search={{ reg, mobile: undefined }}
              >
                <IdCard className="mr-2 h-4 w-4" />
                View / Download ID Card
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <WhatsAppCard whatsapp={config.whatsapp} />

      {config.referral.enabled && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-brand-primary">
              <Share2 className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Invite your friends to join this event</h2>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
              <input
                readOnly
                value={shareUrl}
                className="w-full bg-transparent text-sm text-foreground outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button size="sm" onClick={() => copy(shareUrl, "link")}>
                <LinkIcon className="mr-2 h-4 w-4" />
                {copied === "link" ? "Copied!" : "Copy Link"}
              </Button>
            </div>

            <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Share message
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-foreground">{shareText}</pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => copy(shareText, "msg")}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied === "msg" ? "Copied!" : "Copy Message"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <ShareBtn
                icon={MessageCircle}
                label="WhatsApp"
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              />
              <ShareBtn
                icon={Facebook}
                label="Facebook"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              />
              <ShareBtn
                icon={LinkIcon}
                label="Copy Link"
                onClick={() => copy(shareUrl, "link")}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Button asChild variant="outline">
          <Link
            to={eventSlug ? "/$event" : "/"}
            {...(eventSlug ? { params: { event: eventSlug } } : {})}
          >
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ShareBtn({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        <Icon className="h-4 w-4" /> {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}