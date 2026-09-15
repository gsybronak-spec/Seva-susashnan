import { createFileRoute } from "@tanstack/react-router";
import { GenericScannerView } from "@/components/pages/generic-scanner-view";
import { VADODARA_EVENT_ID } from "@/lib/event-engine.functions";

export const Route = createFileRoute("/vadodara-scanner")({
  component: () => <GenericScannerView defaultEventId={VADODARA_EVENT_ID} />,
  head: () => ({
    meta: [
      { title: "Vadodara Event QR Scanner" },
      { name: "description", content: "Authorized Vadodara Yog & Dhyan Shibir attendance scanner." },
      { property: "og:title", content: "Vadodara Event QR Scanner" },
      { property: "og:description", content: "Authorized Vadodara Yog & Dhyan Shibir attendance scanner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
