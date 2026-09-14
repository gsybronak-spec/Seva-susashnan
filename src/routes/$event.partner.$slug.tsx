import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/$event/partner/$slug")({
  head: () => {
    const title = "Partner Registration — Gujarat State Yog Board Event";
    return {
      meta: [
        { title },
        { name: "description", content: "Register through an official partner for a Gujarat State Yog Board event." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Register through an official partner for a Gujarat State Yog Board event." },
      ],
    };
  },
  component: PartnerRedirect,
});

function PartnerRedirect() {
  const { event: eventSlug, slug } = Route.useParams() as { event: string; slug?: string };
  return (
    <Navigate
      to="/$event/register"
      params={{ event: eventSlug }}
      search={{ partner: (slug ?? "").toUpperCase() }}
      replace
    />
  );
}
