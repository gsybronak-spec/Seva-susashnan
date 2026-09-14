// Server-only helpers that resolve which events an admin user may see and
// enforce that scope on a requested event_id. Super admins see everything.
// View admins are restricted to events in their assigned districts (via
// admin_district_access).

import type { AdminSessionData } from "@/lib/admin-auth";

export type EventScope =
  | { kind: "all" } // super_admin, unrestricted
  | { kind: "list"; ids: string[] }; // view_admin, restricted list (may be empty)

export async function getEventScope(
  session: AdminSessionData,
): Promise<EventScope> {
  if (session.role === "super_admin") return { kind: "all" };
  if (!session.userId) return { kind: "list", ids: [] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc(
    "admin_allowed_event_ids" as never,
    { _admin_user_id: session.userId } as never,
  );
  const ids = ((data ?? []) as Array<{ admin_allowed_event_ids?: string } | string>).map(
    (r) => (typeof r === "string" ? r : (r.admin_allowed_event_ids ?? "")),
  ).filter(Boolean) as string[];
  return { kind: "list", ids };
}

// Resolve a requested event_id (or "all") against the caller's scope.
// Returns:
//   { mode: "single", id }  — filter to this event
//   { mode: "many",   ids } — filter to any of these events (viewer's allowed list)
//   { mode: "any" }         — no filter (super admin, "all")
// Throws "Forbidden" if the requested event is outside the caller's scope.
export async function resolveEventFilter(
  session: AdminSessionData,
  requestedEventId?: string | null,
): Promise<
  | { mode: "single"; id: string }
  | { mode: "many"; ids: string[] }
  | { mode: "any" }
> {
  const scope = await getEventScope(session);
  if (requestedEventId) {
    if (scope.kind === "all") return { mode: "single", id: requestedEventId };
    if (!scope.ids.includes(requestedEventId)) throw new Error("Forbidden");
    return { mode: "single", id: requestedEventId };
  }
  if (scope.kind === "all") return { mode: "any" };
  return { mode: "many", ids: scope.ids };
}
