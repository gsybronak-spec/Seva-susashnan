import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { petalBandStyle } from "@/components/art/gsyb-art";

/**
 * Editorial campaign card shared by the homepage and the campaigns listing.
 * Falls back to a theme-tinted cover with the GSYB petal band when the
 * campaign has no uploaded banner image.
 */
export type CampaignCardData = {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  registration_status: "open" | "closed";
  event_count?: number;
};

export function CampaignCard({ c }: { c: CampaignCardData }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-editorial transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* cover */}
      <div className="relative h-40 w-full overflow-hidden">
        {c.banner_url ? (
          <img
            src={c.banner_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="relative h-full w-full bg-maroonwash">
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(120% 90% at 80% 10%, color-mix(in oklab, var(--brand-accent) 22%, transparent) 0%, transparent 60%)" }}
            />
            <div className="absolute bottom-3 left-4 right-4" style={petalBandStyle} />
          </div>
        )}
        {/* status chip */}
        <span
          className={
            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm " +
            (c.registration_status === "open"
              ? "bg-brand-success text-brand-success-foreground"
              : "bg-card/95 text-muted-foreground")
          }
        >
          <span
            className={
              "h-1.5 w-1.5 rounded-full " +
              (c.registration_status === "open" ? "bg-white" : "bg-muted-foreground/50")
            }
          />
          {c.registration_status === "open" ? "Registration open" : "Registration closed"}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-2.5">
          {c.logo_url && (
            <img src={c.logo_url} alt="" className="h-9 w-9 rounded-full border border-border bg-white object-contain p-0.5" />
          )}
          <h3 className="display-3 leading-snug">{c.name}</h3>
        </div>
        {c.slogan && (
          <p className="gujarati-display !text-sm text-foreground/80">“{c.slogan}”</p>
        )}
        {c.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {typeof c.event_count === "number" && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {c.event_count} event{c.event_count === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-3">
          <Link
            to="/campaigns/$slug"
            params={{ slug: c.slug }}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-brand-primary transition hover:bg-accent/60"
          >
            View Campaign
          </Link>
          {c.registration_status === "open" && (
            <Link
              to="/campaigns/$slug/register"
              params={{ slug: c.slug }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-primary px-3 py-2 text-center text-sm font-medium text-white transition hover:opacity-90"
            >
              Register <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
