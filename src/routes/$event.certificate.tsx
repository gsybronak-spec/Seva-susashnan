import { createFileRoute } from "@tanstack/react-router";
import { CertificateView } from "@/components/pages/certificate-view";

export const Route = createFileRoute("/$event/certificate")({
  head: () => {
    const title = "Certificate — Event by Gujarat State Yog Board";
    return {
      meta: [
        { title },
        { name: "description", content: "Download your event participation certificate." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Download your event participation certificate." },
      ],
    };
  },
  component: CertificateRoute,
});

function CertificateRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  return <CertificateView eventSlug={eventSlug} />;
}
