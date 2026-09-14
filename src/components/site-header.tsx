import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { getPublicSettings } from "@/lib/registration.functions";
import { useCurrentEvent } from "@/hooks/use-current-event";

// Official Gujarat State Yog Board emblem (public/logo-gsyb.png).
export function BrandEmblem({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.logoPath}
      alt={BRAND.name}
      className={className ?? "h-14 w-14 shrink-0 sm:h-20 sm:w-20"}
    />
  );
}

export function SiteHeader() {
  const load = useServerFn(getPublicSettings);
  const { data } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => load(),
    staleTime: 30_000,
  });
  const certsEnabled = !!data?.certificates_enabled;
  const eventSlug = useCurrentEvent();

  const navLinkClass =
    "rounded-md px-3 py-2 text-foreground hover:bg-muted";
  const navActiveClass =
    "rounded-md px-3 py-2 bg-muted text-brand-primary font-medium";

  return (
    <header className="border-b border-border bg-card">
      <div className="brand-bar h-1.5 w-full" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link
          to="/"
          className="flex items-center gap-3 sm:gap-5"
        >
          <BrandEmblem />
          <div className="h-12 w-px bg-border sm:h-16" aria-hidden="true" />
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight text-brand-primary sm:text-2xl">
              {BRAND.nameDisplay}
            </div>
            <div className="mt-1 border-t border-border pt-1 text-[10px] text-muted-foreground sm:text-xs">
              {BRAND.departmentLine}
            </div>
          </div>
        </Link>
        <nav className="hidden gap-1 text-sm sm:flex">
          <Link
            to="/"
            className={navLinkClass}
            activeOptions={{ exact: true }}
            activeProps={{ className: navActiveClass }}
          >
            Home
          </Link>
          <Link
            to="/campaigns"
            className={navLinkClass}
            activeProps={{ className: navActiveClass }}
          >
            Campaigns
          </Link>
          {eventSlug && (
            <Link
              to="/$event/register"
              params={{ event: eventSlug }}
              className={navLinkClass}
              activeProps={{ className: navActiveClass }}
            >
              Register
            </Link>
          )}
          {eventSlug && certsEnabled && (
            <Link
              to="/$event/certificate"
              params={{ event: eventSlug }}
              className={navLinkClass}
              activeProps={{ className: navActiveClass }}
            >
              Certificate
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
