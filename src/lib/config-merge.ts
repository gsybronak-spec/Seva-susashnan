/**
 * Server-side JSONB merge for config sections. The client saves a full local
 * snapshot of one section; merging it into the CURRENT stored value means a
 * stale snapshot can never erase sibling properties written by another save
 * (e.g. toggling `features.registration` must not clobber `features.live`).
 *
 * Rules: null/arrays/scalars are replaced wholesale (arrays are intentionally
 * replaceable — e.g. form field lists); plain objects merge deeply.
 */
export function mergeSectionObjects(current: unknown, incoming: unknown): unknown {
  if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) {
    return incoming;
  }
  if (current === null || typeof current !== "object" || Array.isArray(current)) {
    return incoming;
  }
  const out: Record<string, unknown> = {
    ...(current as Record<string, unknown>),
  };
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    out[k] = mergeSectionObjects(out[k], v);
  }
  return out;
}
