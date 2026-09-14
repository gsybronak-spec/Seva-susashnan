import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[start] unhandled error:", error);

    const url = (() => { try { return new URL(request.url); } catch { return null; } })();
    const isServerFn = !!url && url.pathname.startsWith("/_serverFn/");
    if (isServerFn) {
      const message =
        error instanceof Error ? error.message : "Server error. Please try again.";
      return new Response(
        JSON.stringify({ error: { message } }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
