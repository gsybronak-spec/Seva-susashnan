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
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let eventId = data.event_id;
    if (!eventId) {
      const { resolveEvent } = await import("@/lib/event-resolver.server");
      const resolved = await resolveEvent(data.event_slug ?? null);
      eventId = resolved?.event?.id;
    }
    if (!eventId) return { ok: false as const, error: "Event not found." };

    const safe = data.q.replace(/[%_\\]/g, "\\$&");
    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, district, taluka, custom_fields")
      .or(
        `full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,registration_number.ilike.%${safe}%`,
      )
      .eq("event_id", eventId)
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
          taluka: string | null;
          custom_fields: Record<string, unknown> | null;
        };
        const cf = row.custom_fields ?? {};
        const rawPt = (cf.participant_type as string) ?? null;
        const participantType =
          rawPt === "Yoga Coach" || rawPt === "Yog Coach"
            ? "Yog Coach"
            : rawPt === "Yoga Trainer" || rawPt === "Yog Trainer"
            ? "Yog Trainer"
            : rawPt === "Yoga Sadhak" || rawPt === "Yog Sadhak"
            ? "Yog Sadhak"
            : rawPt;

        return {
          registration_number: row.registration_number,
          full_name: row.full_name,
          mobile: row.mobile,
          district: row.district,
          taluka: row.taluka,
          zone: (cf.zone as string) ?? null,
          participant_type: participantType,
          coach_name: participantType === "Yog Trainer" ? ((cf.coach_name as string) ?? null) : null,
          coordinator_name: (cf.coordinator_name as string) ?? null,
        };
      }),
    };
  });
