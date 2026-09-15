import { createFileRoute } from "@tanstack/react-router";
import { GenericScannerView } from "@/components/pages/generic-scanner-view";
import { useEventConfig } from "@/hooks/use-event-config";

export const Route = createFileRoute("/$event/scanner")({
  component: EventScannerRoute,
  head: () => ({
    meta: [
      { title: "Event QR Scanner — Gujarat State Yog Board" },
      { name: "description", content: "Official check-in scanner for Gujarat State Yog Board events." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function EventScannerRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  const { config } = useEventConfig(eventSlug);
  return <GenericScannerView defaultEventId={config?.id} />;
}
