// Neutral error reporting hook. Swap this for Sentry or any other
// error-tracking service by importing your SDK here — every error
// boundary in the app funnels through this single function.
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.error("[app-error]", context, error);
  }
}
