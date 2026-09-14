// Pure helpers for the admin district-wise registration breakdown.
// Client-safe (no server imports) so the merge logic is unit-testable.
//
// Counts arrive as a per-event label -> count map (labels resolved against
// that event's own form options server-side). This module merges them with
// the event's *applicable* districts (from its coverage configuration) so
// that districts with zero registrations still appear as 0, and computes the
// percentage of the event total for each row.

export type DistrictCountRow = {
  name: string;
  count: number;
  /** Percentage of the event total, 1 decimal place (0–100). */
  pct: number;
};

function pctOf(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/**
 * Merge aggregated counts against the event's applicable district list.
 *
 * - Every applicable district appears, even with count 0.
 * - Residual counts whose resolved label is NOT one of the applicable
 *   districts (legacy/odd values) are appended at the end, so the displayed
 *   rows always reconcile with the event's authoritative total.
 * - Rows are sorted by count descending, then name ascending.
 */
export function mergeDistrictCounts(opts: {
  applicable: Array<{ id: string; name: string }>;
  countsByLabel: Map<string, number>;
  total: number;
}): DistrictCountRow[] {
  const covered = new Set(opts.applicable.map((d) => d.name));

  const rows: DistrictCountRow[] = opts.applicable.map((d) => {
    const count = opts.countsByLabel.get(d.name) ?? 0;
    return { name: d.name, count, pct: pctOf(count, opts.total) };
  });

  const residuals: DistrictCountRow[] = Array.from(opts.countsByLabel.entries())
    .filter(([name]) => !covered.has(name))
    .map(([name, count]) => ({ name, count, pct: pctOf(count, opts.total) }));

  const sorted = [...rows, ...residuals].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  return sorted;
}
