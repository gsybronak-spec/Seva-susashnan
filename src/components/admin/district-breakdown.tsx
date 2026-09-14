import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { adminDistrictCounts } from "@/lib/registration.functions";

type CountRow = { name: string; count: number; pct: number };

type CountsData = {
  ok: boolean;
  error?: string;
  rows: CountRow[];
  total: number;
  source_field?: string;
  mode?: "data" | "coverage";
  event_title?: string | null;
  coverage_type?: "single" | "zone" | "state" | null;
  coverage_names?: string[];
};

const TYPE_LABEL: Record<string, string> = {
  single: "Single District",
  zone: "Zone",
  state: "State-wide",
};

/**
 * District-wise registration counts for the currently selected event.
 * Counts come from a server-side grouped query (no registration rows are
 * shipped to the browser) and are strictly scoped to `eventId`.
 *
 * Coverage-aware: explicit-coverage events show exactly their applicable
 * districts (single → one, zone → configured set, state → all active), with
 * zero-registration districts displayed as 0. Legacy events without a
 * coverage config fall back to a data-driven breakdown of every district
 * found in their registrations.
 */
export function DistrictBreakdown({ eventId }: { eventId: string }) {
  const fetchCounts = useServerFn(adminDistrictCounts);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-district-counts", eventId],
    queryFn: () => fetchCounts({ data: { event_id: eventId } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const d = data as CountsData | undefined;
  const rows = useMemo(() => (d?.ok ? d.rows : []), [d]);
  const total = d?.ok ? d.total : 0;
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const isCoverage = d?.mode === "coverage";
  const coverageLabel =
    d?.coverage_type === "state"
      ? `All Districts (${rows.length} active districts)`
      : (d?.coverage_names ?? []).join(", ");

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 p-4">
        <MapPin className="h-5 w-5 text-brand-primary" />
        <div className="flex-1">
          <h2 className="font-semibold text-brand-primary">District-wise Registrations</h2>
          {d?.event_title && (
            <div className="text-xs text-muted-foreground">
              {d.event_title}
              {d.coverage_type && (
                <>
                  {" "}
                  · <span className="font-medium uppercase text-brand-primary">{TYPE_LABEL[d.coverage_type]}</span>
                </>
              )}
              {isCoverage && coverageLabel && <span> · {coverageLabel}</span>}
            </div>
          )}
        </div>
        {isFetching && <span className="text-xs text-muted-foreground">refreshing…</span>}
      </div>

      {!d || (d.ok && rows.length === 0) ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {d && !d.ok ? d.error : "No registrations yet."}
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">District</th>
                <th className="p-3 text-right">Registrations</th>
                <th className="p-3 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.name} className="align-middle">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{r.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-primary"
                          style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums text-brand-primary">
                    {r.count.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {r.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border bg-muted/30 p-3 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums text-brand-primary">{total.toLocaleString("en-IN")}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default DistrictBreakdown;
