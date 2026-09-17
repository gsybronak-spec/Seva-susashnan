import { createFileRoute } from "@tanstack/react-router";
import { EventOperatorScannerView } from "@/components/pages/event-operator-scanner-view";

export const Route = createFileRoute("/$event/scan")({
  component: EventScanRoute,
  head: () => ({
    meta: [
      { title: "Event Scanner Operator Console — Gujarat State Yog Board" },
      { name: "description", content: "Official check-in scanner for Gujarat State Yog Board event operators." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function EventScanRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  return <EventOperatorScannerView eventSlug={eventSlug} />;
}
