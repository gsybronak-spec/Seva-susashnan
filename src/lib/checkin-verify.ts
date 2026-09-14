import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: verify a registration before showing the success page / ID card.
// Read-only — no attendance side effects.
export const verifyRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
        event_slug: z.string().trim().max(80).optional(),
        qr_token: z.string().trim().min(6).max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEvent } = await import("@/lib/event-resolver.server");

    const resolved = await resolveEvent(data.event_slug ?? null);
    if (!resolved || !resolved.event?.id) {
      return { ok: false as const, error: "Event not found." };
    }

    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, qr_token")
      .eq("mobile", data.mobile)
      .eq("event_id", resolved.event.id as string)
      .maybeSingle();
    if (!reg) {
      return { ok: false as const, error: "No registration found for this mobile number." };
    }

    const row = reg as unknown as {
      registration_number: string;
      full_name: string;
      mobile: string;
      qr_token: string | null;
    };

    return {
      ok: true as const,
      registration_number: row.registration_number,
      full_name: row.full_name,
      mobile: row.mobile,
      qr_token: row.qr_token,
      event_title:
        (resolved.event.general as { title?: string } | null)?.title ??
        resolved.district_name ??
        "Event",
    };
  });
