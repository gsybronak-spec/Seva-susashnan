import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { partnerLookup } from "@/lib/partner.functions";

export const Route = createFileRoute("/register/partner/$slug")({
  component: LegacyPartnerRedirect,
});

// Backward-compat: old partner links used /register/partner/SLUG without a
// district in the URL. Resolve the partner's own district and forward to the
// district-scoped registration form. If the partner is not attached to a
// district, we refuse rather than sending the visitor to a default event.
function LegacyPartnerRedirect() {
  const { slug } = Route.useParams();
  const upper = (slug ?? "").toUpperCase();
  const lookup = useServerFn(partnerLookup);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!upper) return;
    let cancelled = false;
    lookup({ data: { slug: upper } })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (!res.district_slug) {
          setError("This partner link is not linked to a event.");
          return;
        }
        navigate({
          to: "/$event/register",
          params: { event: res.district_slug },
          search: { partner: res.slug },
          replace: true,
        });
      })

      .catch(() => setError("Could not verify partner link."));
    return () => { cancelled = true; };
  }, [upper, lookup, navigate]);

  if (!upper) {
    return <Navigate to="/register" replace />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Invalid partner link</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <a href="/register" className="mt-4 inline-block text-sm text-brand-primary underline">
          Back to registration
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Opening partner registration…
    </div>
  );
}
