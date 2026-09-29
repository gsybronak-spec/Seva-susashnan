import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  approveCertificateIssue,
  bulkIssueCertificates,
  getCertificateRenderPayload,
  getScopedCertificateRows,
  loadCertificateEvent,
  loadEventById,
  nextCertNumber,
  regenerateCertificateIssue,
  rejectCertificateIssue,
  type ActiveEvent,
} from "@/lib/certificate.server";
import { isEventCompleted } from "@/lib/event-config";

export function normalizeCertificateMobile(raw: string): string {
  const digits = String(raw || "")
    .replace(/[\s\-().+]/g, "")
    .replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

export type CertificateEventChoice = {
  registration_id: string;
  registration_number: string;
  full_name: string;
  event_id: string;
  event_slug: string | null;
  event_title: string;
  district: string;
  event_date: string | null;
  event_completed: boolean;
};

// ---------------- Public: participant status + auto-issue ----------------
// Universal Eligibility Rule:
// Certificate eligibility = REGISTERED PARTICIPANT + THAT PARTICIPANT'S EVENT COMPLETED.
// Physical attendance / check-in is NOT required.
// Certificate lookup is strictly bound to (registration_id, event_id).
export const certificateStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        mobile: z.preprocess(
          (v) => (typeof v === "string" ? normalizeCertificateMobile(v) : v),
          z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
        ),
        district_slug: z.string().trim().max(80).optional(),
        registration_id: z.string().uuid().optional(),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let event: ActiveEvent | null = null;
    let reg: {
      id: string;
      registration_number: string;
      full_name: string;
      mobile: string;
      district?: string | null;
      event_id: string;
    } | null = null;

    // CASE 1: Event-specific route (e.g. /amreli-yog-shibir/certificate or /rajkot-yog-shibir/certificate)
    if (data.district_slug) {
      event = await loadCertificateEvent(data.district_slug);
      if (!event) {
        return { ok: false as const, error: "આ શિબિર મળી નથી. (Event not found.)" };
      }

      let query = supabaseAdmin
        .from("registrations")
        .select("id, registration_number, full_name, mobile, district, event_id, created_at")
        .eq("mobile", data.mobile)
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data.registration_id) {
        query = supabaseAdmin
          .from("registrations")
          .select("id, registration_number, full_name, mobile, district, event_id, created_at")
          .eq("id", data.registration_id)
          .eq("mobile", data.mobile)
          .eq("event_id", event.id)
          .limit(1);
      }

      const { data: regRows } = await query;
      const regRow = regRows?.[0] ?? null;

      if (!regRow || regRow.event_id !== event.id) {
        return {
          ok: false as const,
          code: "WRONG_EVENT_OR_NOT_FOUND" as const,
          error: "આ નોંધણી આ શિબિર માટે નથી. (No registration found for this mobile number in this event.)",
        };
      }
      reg = regRow;
    }
    // CASE 2: Explicit (registration_id + event_id) selection on global /certificate route
    else if (data.registration_id && data.event_id) {
      event = await loadEventById(data.event_id);
      if (!event) {
        return { ok: false as const, error: "આ શિબિર મળી નથી. (Event not found.)" };
      }

      const { data: regRow } = await supabaseAdmin
        .from("registrations")
        .select("id, registration_number, full_name, mobile, district, event_id")
        .eq("id", data.registration_id)
        .eq("event_id", data.event_id)
        .eq("mobile", data.mobile)
        .maybeSingle();

      if (!regRow || regRow.event_id !== event.id) {
        return {
          ok: false as const,
          code: "WRONG_EVENT_OR_NOT_FOUND" as const,
          error: "આ નોંધણી આ શિબિર માટે નથી. (This registration does not belong to this event.)",
        };
      }
      reg = regRow;
    }
    // CASE 3: Global /certificate route without district_slug or explicit selection
    else {
      const { data: regRows } = await supabaseAdmin
        .from("registrations")
        .select("id, registration_number, full_name, mobile, district, event_id, created_at")
        .eq("mobile", data.mobile)
        .order("created_at", { ascending: false });

      if (!regRows || regRows.length === 0) {
        return {
          ok: false as const,
          error: "આ મોબાઈલ નંબર પર કોઈ રજીસ્ટ્રેશન મળ્યું નથી. (No registration found for this mobile number.)",
        };
      }

      // Deduplicate by event_id (keep the latest registration per distinct event_id)
      const byEvent = new Map<string, typeof regRows[0]>();
      for (const r of regRows) {
        if (!r.event_id) continue;
        if (!byEvent.has(r.event_id)) {
          byEvent.set(r.event_id, r);
        }
      }

      const eventIds = Array.from(byEvent.keys());
      const { data: eventRows } =
        eventIds.length > 0
          ? await supabaseAdmin.from("events").select("*").in("id", eventIds)
          : { data: [] };

      const { mergeConfig } = await import("@/lib/event-config");
      const eventMap = new Map<string, ActiveEvent>();
      for (const w of eventRows ?? []) {
        const raw = w as any;
        const cfg = mergeConfig(raw);
        eventMap.set(raw.id, {
          id: raw.id,
          slug: raw.slug ?? null,
          district: raw.district ?? raw.district_name ?? null,
          district_id: raw.district_id ?? null,
          event_date: raw.event_date ?? null,
          lifecycle_status: raw.lifecycle_status ?? null,
          status: raw.status ?? null,
          config: { ...cfg, id: raw.id },
        });
      }

      const validChoices: Array<{ reg: typeof regRows[0]; event: ActiveEvent }> = [];
      for (const [evId, r] of byEvent.entries()) {
        const ev = eventMap.get(evId);
        if (ev) {
          validChoices.push({ reg: r, event: ev });
        }
      }

      if (validChoices.length === 0) {
        return {
          ok: false as const,
          error: "આ મોબાઈલ નંબર પર કોઈ સક્રિય શિબિર રજીસ્ટ્રેશન મળ્યું નથી.",
        };
      }

      // CRITICAL: If the mobile number is registered in MULTIPLE events (e.g. both Amreli and Rajkot),
      // NEVER guess or auto-pick! Return the event selection list so the participant explicitly chooses.
      if (validChoices.length > 1) {
        const choices: CertificateEventChoice[] = validChoices.map(({ reg: r, event: ev }) => {
          const isComp = isEventCompleted({
            id: ev.id,
            slug: ev.slug,
            general: ev.config.general,
            event_date: ev.event_date ?? ev.config.general.event_date,
            lifecycle_status: ev.lifecycle_status,
            status: ev.status,
          });
          return {
            registration_id: r.id,
            registration_number: r.registration_number,
            full_name: r.full_name,
            event_id: ev.id,
            event_slug: ev.slug ?? null,
            event_title: ev.config.general.title,
            district: (r.district && r.district.trim()) || ev.district || "",
            event_date: ev.event_date ?? ev.config.general.event_date ?? null,
            event_completed: isComp,
          };
        });

        return {
          ok: true as const,
          requires_selection: true as const,
          choices,
        };
      }

      // Exactly 1 event registration exists for this mobile number -> resolve that exact (reg, event)
      reg = validChoices[0].reg;
      event = validChoices[0].event;
    }

    if (!event || !reg || !reg.id || reg.event_id !== event.id) {
      return {
        ok: false as const,
        code: "WRONG_EVENT_OR_NOT_FOUND" as const,
        error: "આ નોંધણી આ શિબિર માટે નથી. (Registration or event mismatch.)",
      };
    }

    const cert = event.config.certificate;

    const { data: existing } = await supabaseAdmin
      .from("certificate_issues")
      .select("*")
      .eq("registration_number", reg.registration_number)
      .eq("event_id", event.id)
      .maybeSingle();

    // Validate existing issue strictly matches registration.event_id + event.id
    if (
      existing &&
      (((existing as any).event_id && (existing as any).event_id !== event.id) ||
        (existing as any).registration_number !== reg.registration_number)
    ) {
      return {
        ok: false as const,
        code: "WRONG_EVENT_OR_NOT_FOUND" as const,
        error: "આ નોંધણી આ શિબિર માટે નથી. (Certificate event mismatch.)",
      };
    }

    // Universal Eligibility: REGISTERED PARTICIPANT + THAT PARTICIPANT'S EVENT IS COMPLETED
    // Physical attendance / check-in is NOT required.
    const completed = isEventCompleted({
      id: event.id,
      slug: event.slug,
      general: event.config.general,
      event_date: event.event_date ?? event.config.general.event_date,
      lifecycle_status: event.lifecycle_status,
      status: event.status,
    });

    const eligible = completed;
    let issue = existing;

    // Auto-issue on first eligible lookup for this exact (registration_number, event.id).
    if (!issue && eligible) {
      const number = await nextCertNumber(cert.number_format);
      const { data: created } = await supabaseAdmin
        .from("certificate_issues")
        .insert({
          event_id: event.id,
          district_id: event.district_id,
          registration_number: reg.registration_number,
          full_name: reg.full_name,
          mobile: reg.mobile,
          certificate_number: number,
          template_id: cert.active_template_id,
          status: "issued",
          issued_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();
      issue = created ?? null;
    }

    let render_payload: {
      ok: true;
      registration_id: string;
      event_id: string;
      participant_name: string;
      registration_number: string;
      certificate_number: string;
      issued_at: string | null;
      general: typeof event.config.general;
      certificate: typeof event.config.certificate;
      template: typeof event.config.certificate.templates[number];
    } | null = null;

    if (eligible && issue && ((issue as { status: string }).status === "issued" || (issue as { status: string }).status === "approved")) {
      const template =
        cert.templates.find((t) => t.id === ((issue as { template_id?: string | null }).template_id ?? cert.active_template_id)) ??
        cert.templates[0];
      render_payload = {
        ok: true as const,
        registration_id: reg.id,
        event_id: event.id,
        participant_name: reg.full_name,
        registration_number: reg.registration_number,
        certificate_number: (issue as { certificate_number: string }).certificate_number,
        issued_at: (issue as { issued_at: string | null }).issued_at,
        general: event.config.general,
        certificate: event.config.certificate,
        template,
      };
    }

    return {
      ok: true as const,
      requires_selection: false as const,
      registration_id: reg.id,
      event_id: event.id,
      event_slug: event.slug ?? null,
      district: (reg.district && reg.district.trim()) || event.district || "",
      participant_name: reg.full_name,
      registration_number: reg.registration_number,
      event_title: event.config.general.title,
      event_completed: completed,
      joined: true,
      eligible,
      certificate_enabled: true,
      issue: issue
        ? {
            certificate_number: (issue as { certificate_number: string }).certificate_number,
            status: (issue as { status: string }).status,
            issued_at: (issue as { issued_at: string | null }).issued_at,
          }
        : null,
      render_payload,
    };
  });


// ---------------- Public: verify by cert number ----------------
export const verifyCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ certificate_number: z.string().min(3).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("certificate_issues")
      .select("certificate_number, status, full_name, registration_number, issued_at, event_id")
      .eq("certificate_number", data.certificate_number)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "Certificate not found." };
    const r = row as {
      certificate_number: string; status: string; full_name: string;
      registration_number: string; issued_at: string | null; event_id: string | null;
    };
    let eventTitle = "";
    let verificationText = "";
    if (r.event_id) {
      const { data: w } = await supabaseAdmin
        .from("events").select("general, certificate").eq("id", r.event_id).maybeSingle();
      const g = (w?.general ?? {}) as { title?: string };
      const c = (w?.certificate ?? {}) as { verification_text?: string };
      eventTitle = g.title ?? "";
      verificationText = c.verification_text ?? "";
    }
    const valid = r.status === "approved" || r.status === "issued";
    return {
      ok: true as const,
      valid,
      status: r.status,
      participant_name: r.full_name,
      registration_number: r.registration_number,
      certificate_number: r.certificate_number,
      issued_at: r.issued_at,
      event_title: eventTitle,
      verification_text: verificationText,
    };
  });

// ---------------- Admin ----------------

export const adminListCertificates = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "issued", "rejected"]).optional().default("all"),
        search: z.string().max(120).optional().default(""),
        event_id: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    return getScopedCertificateRows(data);
  });

export const adminApproveCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    return approveCertificateIssue(data.id);
  });

export const adminRejectCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    return rejectCertificateIssue(data.id, data.reason);
  });

export const adminRegenerateCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    return regenerateCertificateIssue(data.id);
  });

// Bulk issue certificates for all eligible participants of a specific event
// (defaults to the currently active event for backward compatibility).
export const adminBulkIssueCertificates = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    return bulkIssueCertificates(data.event_id);
  });

// Public: fetch the active event's certificate render data (template + org + verify text)
// used by the download page to render the actual certificate.
export const getCertificateRenderData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ certificate_number: z.string().min(3).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    return getCertificateRenderPayload(data.certificate_number);
  });
