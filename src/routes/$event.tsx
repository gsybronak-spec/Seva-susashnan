import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BRAND } from "@/lib/brand";

// Validate a public event slug AND require that it has a Published event.
// Draft or Archived events must never render as a public microsite.
const resolveEventPublic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80).toLowerCase() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bySlug } = await supabaseAdmin
      .from("events")
      .select("id, slug, district_id, district_name, district, general")
      .eq("slug", data.slug)
      .eq("publish_status", "published")
      .eq("is_template", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bySlug) {
      const title =
        (bySlug.general as { title?: string } | null)?.title?.trim() || null;
      return {
        ok: true as const,
        title,
        event: {
          id: bySlug.district_id ?? bySlug.id,
          slug: bySlug.slug,
          name: bySlug.district_name ?? bySlug.district ?? bySlug.slug,
          is_active: true,
        },
      };
    }

    // Fallback: URL based on a district slug — resolve the district's
    // currently published event (e.g. /junagadh → Junagadh's shibir).
    const { data: d } = await supabaseAdmin
      .from("districts")
      .select("id, slug, name, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!d || !d.is_active) return { ok: false as const };
    const { data: w } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("district_id", d.id)
      .eq("publish_status", "published")
      .eq("is_template", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!w) return { ok: false as const };
    return { ok: true as const, title: null, event: d };
  });

export const Route = createFileRoute("/$event")({
  loader: async ({ params }) => {
    const res = await resolveEventPublic({ data: { slug: params.event.toLowerCase() } });
    if (!res.ok || !res.event) throw notFound();
    return { event: res.event, title: res.title ?? null };
  },
  head: ({ loaderData }) => {
    // Each event microsite must carry its own metadata; without this every
    // event inherits the root title, which is cross-event leakage.
    const name = loaderData?.title || loaderData?.event?.name;
    if (!name) {
      return { meta: [{ title: `Event not available — ${BRAND.name}` }, { name: "robots", content: "noindex" }] };
    }
    const title = `${name} — ${BRAND.name}`;
    const description = `${name} — an event by ${BRAND.name}. Register, get your ID card and download your participation certificate.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-primary">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Unexpected error"}
      </p>
    </div>
  ),
  notFoundComponent: () => {
    const { event: eventSlug } = Route.useParams() as { event: string };
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Event not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No published event was found for &quot;{eventSlug}&quot;. It may be a draft or archived.
        </p>
        <a href="/" className="mt-4 inline-block text-sm text-brand-primary underline">
          Back to home
        </a>
      </div>
    );
  },
  component: () => <Outlet />,
});
