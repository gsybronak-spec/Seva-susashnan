import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { RegisterView } from "@/components/pages/register-view";
import type { EventConfigInitialData } from "@/hooks/use-event-config";

const loadDefaultRegistrationData = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { resolveEvent } = await import("@/lib/event-resolver.server");
    const resolved = await resolveEvent(BRAND.defaultMicrositeSlug);
    if (!resolved?.event) {
      return { initialData: null };
    }
    const { stripAdminOnlyFields } = await import("@/lib/event.functions");
    const initialData: EventConfigInitialData = {
      config: stripAdminOnlyFields(resolved.event),
      district_name: resolved.district_name,
      coverage_districts: resolved.coverage_districts,
    };
    return { initialData };
  } catch (err) {
    console.warn("[loadDefaultRegistrationData] error:", err);
    return { initialData: null };
  }
});

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { ref?: string; partner?: string } => ({
    ...(typeof search.ref === "string" ? { ref: search.ref } : {}),
    ...(typeof search.partner === "string" ? { partner: search.partner } : {}),
  }),
  head: () => ({
    meta: [
      { title: `Register — ${BRAND.name}` },
      { name: "description", content: `Register for events conducted by the ${BRAND.name}.` },
    ],
  }),
  loader: async () => {
    const res = await loadDefaultRegistrationData();
    return { initialData: res.initialData };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const { ref, partner } = Route.useSearch();
  const { initialData } = Route.useLoaderData();
  return (
    <RegisterView
      eventSlug={BRAND.defaultMicrositeSlug}
      refCode={ref}
      partnerSlug={partner}
      initialData={initialData}
    />
  );
}
