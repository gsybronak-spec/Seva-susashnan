import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventWhatsapp } from "@/lib/event-config";

export function WhatsAppCard({ whatsapp }: { whatsapp: EventWhatsapp }) {
  if (!whatsapp.enabled || !whatsapp.url) return null;
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-brand-success/40 bg-brand-success/5 shadow-sm">
      <div className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-success text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">
              Join our Official WhatsApp Channel
            </div>
            <div className="text-xs text-muted-foreground">
              Get instant updates about the event.
            </div>
          </div>
        </div>
        <Button asChild className="bg-brand-success hover:bg-brand-success/90">
          <a href={whatsapp.url} target="_blank" rel="noopener noreferrer">
            {whatsapp.button_text || "Join Now"}
          </a>
        </Button>
      </div>
    </div>
  );
}
