import { createFileRoute } from "@tanstack/react-router";
import { EventOperatorScannerView } from "@/components/pages/event-operator-scanner-view";

export const Route = createFileRoute("/scan")({
  component: ScanRoute,
  head: () => ({
    meta: [
      { title: "Universal Digital ID Scanner — Gujarat State Yog Board" },
      { name: "description", content: "Official universal check-in scanner for Gujarat State Yog Board event operators." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function ScanRoute() {
  return <EventOperatorScannerView />;
}
