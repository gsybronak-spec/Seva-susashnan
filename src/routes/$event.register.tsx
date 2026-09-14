import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { RegisterView } from "@/components/pages/register-view";
import type { EventConfigInitialData } from "@/hooks/use-event-config";

const searchSchema = z.object({
  ref: z.string().optional(),
  partner: z.string().optional(),
});

const loadRegistrationData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event: z.string().trim().max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { resolveEvent } = await import("@/lib/event-resolver.server");
      const resolved = await resolveEvent(data.event);
      if (!resolved?.event) {
        return { initialData: null };
      }
      const { stripAdminOnlyFields } = await import("@/lib/event.functions");
      const initialData: EventConfigInitialData = {
        config: stripAdminOnlyFields(resolved.event),
        district_name: resolved.district_name,
        coverage_districts: resolved.coverage_districts,
      } as EventConfigInitialData;
      return { initialData };
    } catch (err) {
      console.warn("[loadRegistrationData] error resolving event:", err);
      return { initialData: null };
    }
  });

export const Route = createFileRoute("/$event/register")({
  head: () => {
    const title = "Register — Event";
    return {
      meta: [
        { title },
        { name: "description", content: "Register for the official Yog ane Dhyan Shibir event." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Register for the official Yog ane Dhyan Shibir event." },
      ],
    };
  },
  validateSearch: (s) => searchSchema.parse(s),
  loader: async ({ params }) => {
    const res = await loadRegistrationData({ data: { event: params.event } });
    return { initialData: res.initialData };
  },
  component: RegisterRoute,
});

function RegisterRoute() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  const { ref, partner } = Route.useSearch();
  const { initialData } = Route.useLoaderData();
  return (
    <RegisterView
      eventSlug={eventSlug}
      refCode={ref}
      partnerSlug={partner}
      initialData={initialData}
    />
  );
}
