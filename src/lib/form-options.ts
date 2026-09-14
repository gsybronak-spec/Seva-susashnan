// Event-scoped option value -> human label resolution for reporting/exports.
//
// Registrations store the *value* of a dropdown/radio option (e.g. "opt_1").
// The human label ("Mehsana") only exists in that event's form definition.
// Because option values are generated per event, a value like "opt_1" can
// mean completely different things in two events — the maps built here are
// therefore always derived from a SINGLE event's `events.form`.

export type OptionLabelMaps = {
  byField: Record<string, Record<string, string>>;
  any: Record<string, string>;
};

type LooseField = {
  key?: unknown;
  options?: unknown;
};

function collectFieldArrays(form: unknown): LooseField[][] {
  if (!form || typeof form !== "object") return [];
  const f = form as Record<string, unknown>;
  const out: LooseField[][] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) out.push(v as LooseField[]);
  };
  // Priority order: currently published fields first, then draft, then any
  // stored templates / history revisions (older option sets live there and are
  // what historical registrations were captured with).
  push(f.fields);
  push(f.draft);
  for (const bucket of ["templates", "history"] as const) {
    const arr = f[bucket];
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t && typeof t === "object") push((t as Record<string, unknown>).fields);
      }
    }
  }
  return out;
}

export function buildOptionLabelMaps(form: unknown): OptionLabelMaps {
  const byField: Record<string, Record<string, string>> = {};
  const any: Record<string, string> = {};
  for (const fields of collectFieldArrays(form)) {
    for (const field of fields) {
      const key = typeof field?.key === "string" ? field.key : null;
      if (!key || !Array.isArray(field.options)) continue;
      for (const raw of field.options as Array<unknown>) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as { value?: unknown; label?: unknown };
        const value = o.value == null ? "" : String(o.value);
        const label = o.label == null ? "" : String(o.label);
        if (!value || !label) continue;
        byField[key] ??= {};
        // First writer wins → published definition beats older revisions.
        byField[key][value] ??= label;
        any[value] ??= label;
      }
    }
  }
  return { byField, any };
}

/** Resolve a stored value to its configured label. Unknown values pass through. */
export function resolveOptionLabel(
  maps: OptionLabelMaps | null | undefined,
  fieldKey: string,
  value: unknown,
): string {
  const raw = value == null ? "" : String(value);
  if (!raw || !maps) return raw;
  return maps.byField[fieldKey]?.[raw] ?? maps.any[raw] ?? raw;
}
