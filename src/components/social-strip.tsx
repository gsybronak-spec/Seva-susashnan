import { Facebook, Instagram, Youtube, Send, MessageCircle, Twitter, Globe } from "lucide-react";
import type { EventSocial, SocialPlatformKey } from "@/lib/event-config";

const META: Record<SocialPlatformKey, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  facebook: { label: "Facebook", Icon: Facebook },
  instagram: { label: "Instagram", Icon: Instagram },
  youtube: { label: "YouTube", Icon: Youtube },
  telegram: { label: "Telegram", Icon: Send },
  whatsapp_channel: { label: "WhatsApp", Icon: MessageCircle },
  twitter: { label: "Twitter (X)", Icon: Twitter },
  website: { label: "Website", Icon: Globe },
};

export function SocialStrip({ social }: { social: EventSocial }) {
  const items = (Object.keys(META) as SocialPlatformKey[])
    .filter((k) => social[k]?.enabled && social[k]?.url)
    .map((k) => ({ key: k, ...META[k], url: social[k].url }));
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, label, Icon, url }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-brand-primary transition hover:bg-accent"
          aria-label={label}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
