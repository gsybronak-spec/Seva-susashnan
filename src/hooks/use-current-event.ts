import { useRouterState } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

// Legacy top-level paths that render the default microsite for backward
// compatibility with links shared publicly before the multi-event refactor.
const LEGACY_DEFAULT_PATHS = new Set([
  "/register",
  "/certificate",
  "/success",
]);

/**
 * Returns the current microsite/district slug based on URL:
 *   /{slug}/...                    → slug
 *   /register, /live, /certificate → default microsite (legacy aliases)
 *   otherwise                      → null (platform / global pages)
 */
export function useCurrentEvent(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!pathname || pathname === "/") return null;

  // Legacy top-level routes and their partner sub-route.
  for (const p of LEGACY_DEFAULT_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) return BRAND.defaultMicrositeSlug;
  }

  // Explicit /{district}/... — first segment. Skip global routes.
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first) return null;
  const GLOBAL = new Set(["admin", "privacy", "terms", "contact", "verify", "auth"]);
  if (GLOBAL.has(first)) return null;
  return first.toLowerCase();
}
