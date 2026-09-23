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

// ---------------- Public: participant status + auto-issue ----------------
// Universal Eligibility Rule:
// Certificate eligibility = REGISTERED PARTICIPANT + EVENT COMPLETED.
// Physical attendance / check-in is NOT required.
// Certificate is auto-issued immediately once the event is completed.
export const certificateStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
        district_slug: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let event: ActiveEvent | null = null;
    let reg: { registration_number: string; full_name: string; mobile: string; event_id: string } | null = null;

    if (data.district_slug) {
      event = await loadCertificateEvent(data.district_slug);
      if (!event) return { ok: false as const, error: "Event not found." };

      const { data: regRow } = await supabaseAdmin
        .from("registrations")
        .select("registration_number, full_name, mobile, event_id")
        .eq("mobile", data.mobile)
        .eq("event_id", event.id)
        .maybeSingle();

      if (!regRow) {
        return { ok: false as const, error: "No registration found for this mobile number in this event." };
      }
      reg = regRow;
    } else {
      // Global /certificate route without district slug:
      // Find all registrations for this mobile number.
      const { data: regRows } = await supabaseAdmin
        .from("registrations")
        .select("registration_number, full_name, mobile, event_id, created_at")
        .eq("mobile", data.mobile)
        .order("created_at", { ascending: false });

      if (!regRows || regRows.length === 0) {
        return { ok: false as const, error: "No registration found for this mobile number." };
      }

      // If user registered for multiple events, prioritize completed events (e.g. Patan)
      let resolvedPair: { event: ActiveEvent; reg: typeof regRows[0] } | null = null;
      for (const r of regRows) {
        if (!r.event_id) continue;
        const ev = await loadEventById(r.event_id);
        if (ev) {
          const isComp = isEventCompleted({
            general: ev.config.general,
            event_date: ev.event_date ?? ev.config.general.event_date,
            lifecycle_status: ev.lifecycle_status,
            status: ev.status,
          });
          if (isComp) {
            resolvedPair = { event: ev, reg: r };
            break;
          }
          if (!resolvedPair) {
            resolvedPair = { event: ev, reg: r };
          }
        }
      }

      if (!resolvedPair) {
        // Fall back to active event
        event = await loadCertificateEvent();
        if (!event) return { ok: false as const, error: "No active event found." };
        const match = regRows.find((r) => r.event_id === event?.id);
        if (!match) {
          return { ok: false as const, error: "No registration found for this active event." };
        }
        reg = match;
      } else {
        event = resolvedPair.event;
        reg = resolvedPair.reg;
      }
    }

    if (!event || !reg) {
      return { ok: false as const, error: "Registration or event not found." };
    }

    const cert = event.config.certificate;

    const { data: existing } = await supabaseAdmin
      .from("certificate_issues")
      .select("*")
      .eq("registration_number", reg.registration_number)
      .eq("event_id", event.id)
      .maybeSingle();

    // Universal Eligibility: REGISTERED PARTICIPANT + EVENT COMPLETED
    // Attendance / check-in is NOT required.
    const completed = isEventCompleted({
      general: event.config.general,
      event_date: event.event_date ?? event.config.general.event_date,
      lifecycle_status: event.lifecycle_status,
      status: event.status,
    });

    const eligible = completed;
    let issue = existing;

    // Auto-issue on first eligible lookup.
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
