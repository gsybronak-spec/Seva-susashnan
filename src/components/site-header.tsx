import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Menu, X, IdCard, Award, CalendarDays, Home } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getPublicSettings } from "@/lib/registration.functions";
import { useCurrentEvent } from "@/hooks/use-current-event";

// Official Gujarat State Yog Board emblem (public/logo-gsyb.png).
export function BrandEmblem({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.logoPath}
      alt={BRAND.name}
      className={className ?? "h-12 w-12 shrink-0 sm:h-16 sm:w-16"}
    />
  );
}

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const load = useServerFn(getPublicSettings);
  const { data } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => load(),
    staleTime: 30_000,
  });
  const certsEnabled = !!data?.certificates_enabled;
  const eventSlug = useCurrentEvent();

  const navLinkClass =
    "rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-muted hover:text-brand-primary";
  const navActiveClass =
    "rounded-md px-3 py-2 text-sm bg-muted text-brand-primary font-bold";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="brand-bar h-1.5 w-full" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 sm:gap-4"
        >
          <BrandEmblem />
          <div className="h-10 w-px bg-border sm:h-12" aria-hidden="true" />
          <div className="leading-tight">
            <div className="font-serif text-sm font-bold tracking-tight text-brand-primary sm:text-xl">
              {BRAND.nameDisplay}
            </div>
            <div className="mt-0.5 text-[9px] text-muted-foreground sm:text-xs">
              {BRAND.departmentLine}
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 sm:flex">
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
            Events / Registration
          </Link>
          <Link
            to="/idcard"
            className={navLinkClass}
            activeProps={{ className: navActiveClass }}
          >
            Digital ID Card
          </Link>
          <Link
            to="/certificate"
            className={navLinkClass}
            activeProps={{ className: navActiveClass }}
          >
            Certificate
          </Link>
          {eventSlug ? (
            <Link
              to="/$event/register"
              params={{ event: eventSlug }}
              className="ml-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Register Now
            </Link>
          ) : (
            <Link
              to="/campaigns"
              className="ml-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Register
            </Link>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-primary sm:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-card px-4 py-3 sm:hidden">
          <nav className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Home className="h-4 w-4 text-brand-primary" />
              Home
            </Link>
            <Link
              to="/campaigns"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <CalendarDays className="h-4 w-4 text-brand-primary" />
              Events / Registration
            </Link>
            <Link
              to="/idcard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <IdCard className="h-4 w-4 text-brand-primary" />
              Digital ID Card
            </Link>
            <Link
              to="/certificate"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Award className="h-4 w-4 text-brand-primary" />
              Participation Certificate
            </Link>
            <div className="pt-2">
              {eventSlug ? (
                <Link
                  to="/$event/register"
                  params={{ event: eventSlug }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg bg-brand-primary py-2.5 text-center text-sm font-semibold text-white"
                >
                  Register for Shibir
                </Link>
              ) : (
                <Link
                  to="/campaigns"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg bg-brand-primary py-2.5 text-center text-sm font-semibold text-white"
                >
                  Explore &amp; Register
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
