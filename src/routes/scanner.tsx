import { createFileRoute } from "@tanstack/react-router";
import { EventOperatorScannerView } from "@/components/pages/event-operator-scanner-view";

export const Route = createFileRoute("/scanner")({
  component: () => <EventOperatorScannerView />,
  head: () => ({
    meta: [
      { title: "Universal QR Scanner — ગુજરાત રાજ્ય યોગ બોર્ડ" },
      {
        name: "description",
        content: "Authorized universal QR attendance scanner for all Gujarat State Yog Board events.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
