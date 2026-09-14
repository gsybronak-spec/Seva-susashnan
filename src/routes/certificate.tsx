import { createFileRoute } from "@tanstack/react-router";
import { CertificateView } from "@/components/pages/certificate-view";

export const Route = createFileRoute("/certificate")({
  head: () => ({
    meta: [
      { title: "Download Certificate — Gujarat State Yog Board" },
      { name: "description", content: "Download your event participation certificate." },
    ],
  }),
  // Global URL: resolves to the currently active published event (no
  // hardcoded district). District-specific URLs still use /$event/certificate.
  component: () => <CertificateView />,
});
