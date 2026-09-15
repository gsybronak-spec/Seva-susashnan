import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SuccessView } from "@/components/pages/success-view";

const searchSchema = z.object({
  reg: z.string().optional(),
  key: z.string().optional(),
  access: z.string().optional(),
});

export const Route = createFileRoute("/$event/success")({
  head: () => {
    const title = "Registration Successful";
    return {
      meta: [
        { title },
        { name: "description", content: "Your event registration is confirmed." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Your event registration is confirmed." },
      ],
    };
  },
  validateSearch: (s) => searchSchema.parse(s),
  component: EventSuccessRoute,
});

function EventSuccessRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  const { reg, key, access } = Route.useSearch();
  return <SuccessView reg={reg ?? ""} eventSlug={eventSlug} cardAccess={key || access} />;
}