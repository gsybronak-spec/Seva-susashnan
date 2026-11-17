import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SuccessView } from "@/components/pages/success-view";
import { isYogSnehMilanCampaign } from "@/lib/campaign-branding";

const searchSchema = z.object({
  reg: z.string().optional(),
  key: z.string().optional(),
  access: z.string().optional(),
  auto: z.string().optional(),
  ref: z.string().optional(),
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
  beforeLoad: ({ params, search }) => {
    const eventSlug = params.event;
    const isSnehMilan = isYogSnehMilanCampaign({
      eventSlug,
      registrationNumber: search.reg || search.ref,
    });

    if (isSnehMilan) {
      // 1. If 'ref' is present, visitor followed a referral link that had /success in it
      if (search.ref && !search.reg) {
        throw redirect({
          to: "/campaigns/$slug/register",
          params: { slug: "snehmilan" },
          search: { ref: search.ref },
        });
      }
      // 2. If 'reg' is present, but NO private access key was provided in the URL:
      // An existing participant shared their success page URL without realizing it.
      // Redirect the new visitor directly to the registration form with that referrer number!
      if (search.reg && !search.key && !search.access) {
        throw redirect({
          to: "/campaigns/$slug/register",
          params: { slug: "snehmilan" },
          search: { ref: search.reg },
        });
      }
    }
  },
  component: EventSuccessRoute,
});

function EventSuccessRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  const { reg, key, access, auto } = Route.useSearch();
  return (
    <SuccessView
      reg={reg ?? ""}
      eventSlug={eventSlug}
      cardAccess={key || access}
      autoDownload={auto === "1"}
    />
  );
}