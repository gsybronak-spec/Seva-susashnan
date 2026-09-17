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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-serif text-base font-bold text-brand-primary">
            {BRAND.name}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {BRAND.departmentLine}
          </div>
          {district && config.general.title && (
            <div className="mt-1 text-[11px] text-brand-primary font-medium">
              Active Event: {config.general.title}
            </div>
          )}
          <div className="mt-2 text-xs">
            © {new Date().getFullYear()} {BRAND.name}. Official digital portal.
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {config.features.social && <SocialStrip social={config.social} />}
          <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <Link to="/privacy" className="hover:text-brand-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-brand-primary">Terms of Service</Link>
            <Link to="/contact" className="hover:text-brand-primary">Contact Us</Link>
            <Link to="/admin" className="hover:text-brand-primary">Admin Portal</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/**
 * Dedicated Standalone Footer for Registration and Success flows.
 * Displays only official copyright & department notice with zero links.
 */
export function RegistrationFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-card/60 py-6 text-center text-xs text-muted-foreground select-none">
      <div className="mx-auto max-w-6xl px-4">
        © {new Date().getFullYear()} Gujarat State Yog Board • રમતગમત, યુવા અને સાંસ્કૃતિક પ્રવૃત્તિઓ વિભાગ, ગુજરાત સરકાર.
      </div>
    </footer>
  );
}
