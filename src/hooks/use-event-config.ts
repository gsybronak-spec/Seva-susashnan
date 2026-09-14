import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEventConfig } from "@/lib/event.functions";
import { mergeConfig, type EventConfig } from "@/lib/event-config";

export type EventConfigInitialData = {
  config?: Partial<EventConfig> | null;
  district_name?: string | null;
  coverage_districts?: { id: string; slug: string; name: string }[] | null;
};

export function useEventConfig(
  districtSlug?: string | null,
  initialData?: EventConfigInitialData | null,
): {
  config: EventConfig;
  isLoading: boolean;
  districtName: string | null;
  coverageDistricts: { id: string; slug: string; name: string }[] | null;
} {
  const load = useServerFn(getEventConfig);
  const slug = (districtSlug ?? "").trim().toLowerCase() || null;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["event-config", slug],
    queryFn: async () => {
      const call = slug
        ? load({ data: { district_slug: slug } })
        : load({ data: undefined });
      // Guard against hanging network calls with a strict 6-second timeout
      const fallbackTimeout = new Promise<{
        config: null;
        district_id: null;
        district_slug: null;
        district_name: null;
        coverage: null;
        coverage_districts: null;
      }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              config: null,
              district_id: null,
              district_slug: null,
              district_name: null,
              coverage: null,
              coverage_districts: null,
            }),
          6_000,
        ),
      );
      try {
        return await Promise.race([call, fallbackTimeout]);
      } catch (err) {
        console.warn("[useEventConfig] load error, using fallback:", err);
        return {
          config: null,
          district_id: null,
          district_slug: null,
          district_name: null,
          coverage: null,
          coverage_districts: null,
        };
      }
    },
    initialData: initialData
      ? {
          config: initialData.config ?? null,
          district_id: null,
          district_slug: slug,
          district_name: initialData.district_name ?? null,
          coverage: null,
          coverage_districts: initialData.coverage_districts ?? null,
        }
      : undefined,
    retry: 1,
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const raw = ((data?.config ?? initialData?.config) ?? null) as Partial<EventConfig> | null;
  const districtName = (data?.district_name ?? initialData?.district_name ?? null) as string | null;
  const coverageDistricts = (data?.coverage_districts ?? initialData?.coverage_districts ?? null) as {
    id: string;
    slug: string;
    name: string;
  }[] | null;

  // Loading is only true if we have no config data (neither loaded nor initial) and not in error state
  const effectiveLoading = isLoading && !raw && !isError;

  return { config: mergeConfig(raw), isLoading: effectiveLoading, districtName, coverageDistricts };
}
