import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { GenericScannerView } from "@/components/pages/generic-scanner-view";
import { adminCheck } from "@/lib/registration.functions";

export const Route = createFileRoute("/admin/checkin")({
  validateSearch: (search: Record<string, unknown>) => ({
    event: typeof search.event === "string" ? search.event : undefined,
  }),
  head: () => ({
    meta: [{ title: `Check-In Scanner — ${BRAND.name}` }],
  }),
  component: CheckinRoutePage,
});

export function CheckinPage({ eventId }: { eventId?: string } = {}) {
  const search = Route.useSearch?.() as { event?: string } | undefined;
  return <GenericScannerView defaultEventId={eventId || search?.event} />;
}

function CheckinRoutePage() {
  const search = Route.useSearch?.() as { event?: string } | undefined;
  const navigate = useNavigate();
  const check = useServerFn(adminCheck);
  const { data } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => check(),
  });

  useEffect(() => {
    if (data?.authed && data.role === "view_admin") {
      navigate({ to: "/admin" });
    }
  }, [data, navigate]);

  if (data?.authed && data.role === "view_admin") {
    return null;
  }

  return <GenericScannerView defaultEventId={search?.event} />;
}
