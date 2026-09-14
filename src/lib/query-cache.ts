import type { QueryClient } from "@tanstack/react-query";

// Every query key that can hold event-scoped data. Admin writes must clear
// all of them so no panel (or public page in the same tab) keeps serving the
// previous event's configuration.
const EVENT_SCOPED_KEYS = [
  "admin-event-config",
  "admin-events",
  "admin-events-select",
  "admin-events-for-access",
  "admin-event-overview",
  "admin-list",
  "admin-stats",
  "admin-district-counts",

  "admin-certificates",
  "admin-live-dashboard",
  "admin-districts",
  "event-config",
  "event-config-partnerform",
  "event-by-token",
  "partner-form-def",
  "partner-form-used-keys",
  "partner-list",
  "partner-list-lite",
  "partner-stats",
  "partner-regs",
  "organisations",
  "public-open-districts",
  "public-settings",
  // Public homepage event cards — must refresh whenever publish/activation
  // changes whether a event appears on the landing page.
  "public-events",
] as const;

function isEventScoped(key: readonly unknown[]): boolean {
  return typeof key[0] === "string" && (EVENT_SCOPED_KEYS as readonly string[]).includes(key[0]);
}

/**
 * Invalidate every cached query that could contain data for `eventId`.
 * Called after any admin write. `eventId` is accepted for call-site clarity
 * and future narrowing; correctness requires clearing the whole scoped set
 * because several keys (overview, lists, public config by slug) mix events.
 */
export function invalidateEventQueries(qc: QueryClient, _eventId?: string): void {
  qc.invalidateQueries({ predicate: (q) => isEventScoped(q.queryKey) });
}

/**
 * Hard-drop event-scoped cache entries. Used when the admin switches the
 * selected event so no previous event's data can ever be rendered while a
 * refetch is in flight.
 */
export function clearEventQueries(qc: QueryClient): void {
  qc.removeQueries({
    predicate: (q) =>
      isEventScoped(q.queryKey) && q.queryKey[0] !== "admin-events-select",
  });
}
