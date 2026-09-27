import { createFileRoute } from "@tanstack/react-router";
import { EventOperatorScannerView } from "@/components/pages/event-operator-scanner-view";

export const Route = createFileRoute("/vadodara-scanner")({
  component: () => <EventOperatorScannerView eventSlug="vadodara-yog-shibir" />,
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
