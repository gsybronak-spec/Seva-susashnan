import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, HeartPulse, Users, MapPin } from "lucide-react";
import { useEventConfig, type EventConfigInitialData } from "@/hooks/use-event-config";
import { EventInfoCard } from "@/components/event-info-card";
import { BRAND } from "@/lib/brand";
import { getEventRegistrationStatus } from "@/lib/event-config";

const loadEventHomeData = createServerFn({ method: "POST" })
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
      console.warn("[loadEventHomeData] error resolving event:", err);
      return { initialData: null };
    }
  });

export const Route = createFileRoute("/$event/")({
  loader: async ({ params }) => {
    return await loadEventHomeData({ data: { event: params.event } });
  },
  component: EventHome,
});

function EventHome() {
  const { event: eventSlug } = Route.useParams() as { event: string };
  const loaderData = Route.useLoaderData();
  const { config, districtName } = useEventConfig(eventSlug, loaderData?.initialData);
  const { features, general } = config;
  const regStatus = getEventRegistrationStatus(config);

  const displayName = districtName ?? general.title ?? eventSlug;

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-brand-primary">
              <MapPin className="h-3.5 w-3.5" />
              {BRAND.name}
            </div>
            <h1 className="text-3xl font-bold text-brand-primary sm:text-5xl">
              {general.title}
            </h1>
            <p className="mt-3 text-lg font-medium text-brand-accent sm:text-xl">
              {general.theme}
            </p>
            {general.description && (
              <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {general.description}
              </p>
            )}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {regStatus.isOpen && features.registration && (
                <Button asChild size="lg" className="h-12 px-8 text-base">
                  <Link to="/$event/register" params={{ event: eventSlug }}>
                    Register Now <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              {regStatus.status === "in_progress" && (
                <div className="inline-flex h-12 items-center rounded-xl bg-amber-500/10 border border-amber-500/20 px-6 text-sm font-semibold text-amber-700">
                  યોગ શિબિર હાલમાં શરૂ છે (Registration Closed)
                </div>
              )}
              {regStatus.status === "completed" && features.certificate && (
                <Button asChild size="lg" className="h-12 px-8 text-base bg-brand-primary text-white">
                  <Link to="/$event/certificate" params={{ event: eventSlug }}>
                    <Award className="mr-2 h-5 w-5" /> Download Certificate
                  </Link>
                </Button>
              )}
              {!regStatus.isOpen && regStatus.status !== "completed" && regStatus.status !== "in_progress" && (
                <div className="inline-flex h-12 items-center rounded-xl bg-muted px-6 text-sm font-semibold text-muted-foreground">
                  નોંધણી બંધ થયેલ છે (Registration Closed)
                </div>
              )}
              {features.certificate && regStatus.status !== "completed" && (
                <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                  <Link to="/$event/certificate" params={{ event: eventSlug }}>Download Certificate</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>


      <EventInfoCard config={config} />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: HeartPulse, title: "Holistic Wellbeing", text: "Simple, guided yoga and meditation practices for a healthier body and calmer mind." },
            { icon: Users, title: "Open to All", text: `Every citizen participating in the ${displayName} shibir is welcome.` },
            { icon: Award, title: "Participation Certificate", text: "Get an official certificate after attending the event." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
