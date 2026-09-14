import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { useEventConfig } from "@/hooks/use-event-config";
import { useCurrentEvent } from "@/hooks/use-current-event";
import { SocialStrip } from "./social-strip";

export function SiteFooter() {
  const district = useCurrentEvent();
  const { config } = useEventConfig(district);
  if (!config.features.footer) return null;
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="brand-bar h-1 w-full" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-brand-primary">
            {config.general.subtitle || BRAND.name}
          </div>
          <div className="text-xs">{config.general.theme}</div>
          <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
            {BRAND.departmentLine}
          </div>
          <div className="mt-1 text-xs">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {config.features.social && <SocialStrip social={config.social} />}
          <nav className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-brand-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-brand-primary">Terms</Link>
            <Link to="/contact" className="hover:text-brand-primary">Contact</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
