import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

// ============================================================
// PHYSICAL CHECK-IN (QR + manual) — Yog ane Dhyan Shibir
// ============================================================
// Duplicate check-in is impossible:
//   1. attendance has UNIQUE (event_id, registration_number)
//   2. the insert error code 23505 maps to "already recorded"
// The resolved registration is always scoped to one event, and the
// inserted attendance row carries the same event_id.
// ============================================================

export type CheckinParticipant = {
  registration_number: string;
  full_name: string;
  mobile: string;
  gender: string | null;
  district: string | null;
  organization: string | null;
  qr_token: string | null;
};

export type CheckinResult =
  | {
      ok: true;
      action: "checked_in";
      participant: {
        registration_number: string;
        full_name: string;
        district: string | null;
        organization: string | null;
      };
      check_in_time: string;
      method: "qr" | "manual";
    }
  | {
      ok: true;
      action: "already";
      participant: {
        registration_number: string;
        full_name: string;
        district: string | null;
        organization: string | null;
      };
      previous_check_in_time: string;
      method: "qr" | "manual";
    }
  | { ok: false; error: string };

export type QrResolution =
  | {
      ok: true;
      participant: CheckinParticipant;
      attendance:
        | { checked_in: true; check_in_time: string; check_in_method: "qr" | "manual" }
        | { checked_in: false };
    }
  | { ok: false; error: string };

const SCOPED_COLUMNS =
  "registration_number, full_name, mobile, gender, district, organization, qr_token";

async function loadEventId(eventSlug: string | null | undefined): Promise<string | null> {
  const { resolveEvent } = await import("@/lib/event-resolver.server");
  const resolved = await resolveEvent(eventSlug ?? null);
  return resolved?.event?.id ?? null;
}

// ---------------- Resolve a scanned QR token ----------------
// Public-safe: returns only the fields needed for the check-in UI, and only
// for participants of the event resolved from the admin's context.
export const resolveQrToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(6).max(64),
        event_slug: z.string().trim().max(80).optional(),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<QrResolution> => {
    // Server-side authz: only signed-in event staff may resolve QR tokens,
    // even though the scanning UI itself is behind the admin layout.
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expectedEventId = data.event_id ?? (await loadEventId(data.event_slug));

    // Look up participant across registrations by unique qr_token
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, gender, district, organization, qr_token, event_id")
      .eq("qr_token", data.token)
      .maybeSingle();

    if (!reg) return { ok: false, error: "Invalid or unknown QR code." };

    const regData = reg as unknown as {
      registration_number: string;
      full_name: string;
      mobile: string;
      gender: string | null;
      district: string | null;
      organization: string | null;
      qr_token: string | null;
      event_id: string;
    };

    if (expectedEventId && regData.event_id !== expectedEventId) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("general")
        .eq("id", regData.event_id)
        .maybeSingle();
      const g = (ev?.general ?? {}) as { title?: string };
      const eventTitle = g.title ? `"${g.title}"` : "another event";
      return {
        ok: false,
        error: `Participant is registered for ${eventTitle}, not this event.`,
      };
    }

    const eventId = regData.event_id;

    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("check_in_time, check_in_method")
      .eq("event_id", eventId)
      .eq("registration_number", regData.registration_number)
      .maybeSingle();

    const participant: CheckinParticipant = {
      registration_number: regData.registration_number,
      full_name: regData.full_name,
      mobile: regData.mobile,
      gender: regData.gender,
      district: regData.district,
      organization: regData.organization,
      qr_token: regData.qr_token,
    };

    if (att) {
      const a = att as { check_in_time: string; check_in_method: string };
      return {
        ok: true,
        participant,
        attendance: {
          checked_in: true,
          check_in_time: a.check_in_time,
          check_in_method: a.check_in_method as "qr" | "manual",
        },
      };
    }
    return { ok: true, participant, attendance: { checked_in: false } };
  });

// ---------------- Perform check-in (QR or manual) ----------------
export const performCheckin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        registration_number: z.string().trim().min(1).max(40),
        event_slug: z.string().trim().max(80).optional(),
        event_id: z.string().uuid().optional(),
        method: z.enum(["qr", "manual"]).default("qr"),
        checked_in_by: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CheckinResult> => {
    // Server-side authz: attendance writes are staff-only. The UI check is
    // never trusted — this is the Module 21 requirement enforcement point.
    const staff = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expectedEventId = data.event_id ?? (await loadEventId(data.event_slug));

    // Locate the participant by registration_number
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, gender, district, organization, qr_token, event_id")
      .eq("registration_number", data.registration_number)
      .maybeSingle();

    if (!reg) return { ok: false, error: "Participant not found." };

    const regData = reg as unknown as {
      registration_number: string;
      full_name: string;
      mobile: string;
      gender: string | null;
      district: string | null;
      organization: string | null;
      qr_token: string | null;
      event_id: string;
    };

    if (expectedEventId && regData.event_id !== expectedEventId) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("general")
        .eq("id", regData.event_id)
        .maybeSingle();
      const g = (ev?.general ?? {}) as { title?: string };
      const eventTitle = g.title ? `"${g.title}"` : "another event";
      return {
        ok: false,
        error: `Participant is registered for ${eventTitle}, not this event.`,
      };
    }

    const eventId = regData.event_id;
    const participant: CheckinParticipant = {
      registration_number: regData.registration_number,
      full_name: regData.full_name,
      mobile: regData.mobile,
      gender: regData.gender,
      district: regData.district,
      organization: regData.organization,
      qr_token: regData.qr_token,
    };

    // Insert with ON CONFLICT-free behavior: rely on the UNIQUE constraint.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("attendance")
      .insert({
        event_id: eventId,
        registration_number: participant.registration_number,
        full_name: participant.full_name,
        mobile: participant.mobile,
        status: "checked_in",
        check_in_method: data.method,
        checked_in_by: data.checked_in_by ?? staff.username ?? null,
      })
      .select("check_in_time")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Duplicate check-in: report the previous check-in instead.
        const { data: existing } = await supabaseAdmin
          .from("attendance")
          .select("check_in_time, check_in_method")
          .eq("event_id", eventId)
          .eq("registration_number", participant.registration_number)
          .maybeSingle();
        return {
          ok: true,
          action: "already",
          participant: {
            registration_number: participant.registration_number,
            full_name: participant.full_name,
            district: participant.district,
            organization: participant.organization,
          },
          previous_check_in_time:
            (existing as { check_in_time: string } | null)?.check_in_time ??
            new Date().toISOString(),
          method: ((existing as { check_in_method: string } | null)?.check_in_method ??
            data.method) as "qr" | "manual",
        };
      }
      return { ok: false, error: "Check-in failed. Please try again." };
    }

    return {
      ok: true,
      action: "checked_in",
      participant: {
        registration_number: participant.registration_number,
        full_name: participant.full_name,
        district: participant.district,
        organization: participant.organization,
      },
      check_in_time: (inserted as { check_in_time: string }).check_in_time,
      method: data.method,
    };
  });

// ---------------- Admin: attendance summary ----------------
export const adminAttendanceSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("registrations")
      .select("registration_number", { count: "exact", head: true });
    let a = supabaseAdmin.from("attendance").select("registration_number", { count: "exact", head: true });
    if (filter.mode === "single") {
      q = q.eq("event_id", filter.id);
      a = a.eq("event_id", filter.id);
    } else if (filter.mode === "many") {
      q = q.in("event_id", filter.ids);
      a = a.in("event_id", filter.ids);
    }
    const [{ count: regCount }, { count: attCount }] = await Promise.all([q, a]);
    return {
      ok: true as const,
      registered: regCount ?? 0,
      checked_in: attCount ?? 0,
      pending: Math.max(0, (regCount ?? 0) - (attCount ?? 0)),
    };
  });

// ---------------- Admin: attendance list (paginated) ----------------
export const adminAttendanceList = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid().optional(),
        status: z.enum(["all", "checked_in", "pending"]).default("all"),
        search: z.string().trim().max(120).optional().default(""),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (filter.mode === "many" && filter.ids.length === 0) {
      return { ok: true as const, rows: [] };
    }

    // Registered base (with attendance LEFT JOIN via two queries + merge).
    let q = supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, district, organization")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    let aQuery = supabaseAdmin.from("attendance").select("registration_number, check_in_time, check_in_method");
    if (filter.mode === "single") {
      q = q.eq("event_id", filter.id);
      aQuery = aQuery.eq("event_id", filter.id);
    } else if (filter.mode === "many") {
      q = q.in("event_id", filter.ids);
      aQuery = aQuery.in("event_id", filter.ids);
    }

    const s = data.search.trim();
    if (s) {
      const safe = s.replace(/[%_\\]/g, "\\$&");
      q = q.or(
        `full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,registration_number.ilike.%${safe}%`,
      );
    }

    const [{ data: regs }, { data: atts }] = await Promise.all([q, aQuery]);
    const attMap = new Map<string, { check_in_time: string; check_in_method: string }>();
    for (const a of atts ?? []) {
      const r = a as unknown as { registration_number: string; check_in_time: string; check_in_method: string };
      attMap.set(r.registration_number, { check_in_time: r.check_in_time, check_in_method: r.check_in_method });
    }

    let rows = (regs ?? []).map((r) => {
      const reg = r as unknown as {
        registration_number: string;
        full_name: string;
        mobile: string;
        district: string | null;
        organization: string | null;
      };
      const att = attMap.get(reg.registration_number);
      return {
        ...reg,
        checked_in: !!att,
        check_in_time: att?.check_in_time ?? null,
        check_in_method: (att?.check_in_method as "qr" | "manual" | undefined) ?? null,
      };
    });
    if (data.status === "checked_in") rows = rows.filter((r) => r.checked_in);
    if (data.status === "pending") rows = rows.filter((r) => !r.checked_in);

    return { ok: true as const, rows };
  });
