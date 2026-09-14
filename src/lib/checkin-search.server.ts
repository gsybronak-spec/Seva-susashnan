import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

// Manual check-in search: staff searches by name / mobile / participant ID.
// Returns minimal identifying fields only — never full PII dumps.
export const checkinSearch = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        q: z.string().trim().min(1).max(120),
        event_slug: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEvent } = await import("@/lib/event-resolver.server");
    const resolved = await resolveEvent(data.event_slug ?? null);
    if (!resolved?.event?.id) return { ok: false as const, error: "Event not found." };

    const safe = data.q.replace(/[%_\\]/g, "\\$&");
    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, district")
      .or(
        `full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,registration_number.ilike.%${safe}%`,
      )
      .eq("event_id", resolved.event.id)
      .limit(8);
    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      participants: (rows ?? []).map((r) => {
        const row = r as unknown as {
          registration_number: string;
          full_name: string;
          mobile: string;
          district: string | null;
        };
        return {
          registration_number: row.registration_number,
          full_name: row.full_name,
          mobile: row.mobile,
          district: row.district,
        };
      }),
    };
  });
