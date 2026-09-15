import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { GenericScannerView } from "@/components/pages/generic-scanner-view";

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
  return <GenericScannerView defaultEventId={search?.event} />;
}
