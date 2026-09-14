import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  approveCertificateIssue,
  bulkIssueCertificates,
  getCertificateRenderPayload,
  getScopedCertificateRows,
  loadCertificateEvent,
  nextCertNumber,
  regenerateCertificateIssue,
  rejectCertificateIssue,
} from "@/lib/certificate.server";

// ---------------- Public: participant status + auto-issue ----------------
// Eligibility = attendance (physical check-in) per the event's rules.
// Certificate is auto-issued immediately when eligible.
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

    const event = await loadCertificateEvent(data.district_slug);
    if (!event) return { ok: false as const, error: "No active event." };
    const cert = event.config.certificate;

    // Strict per-event scope (H-1): reject legacy rows with NULL event_id.
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, mobile, event_id")
      .eq("mobile", data.mobile)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!reg) {
      return { ok: false as const, error: "No registration found for this mobile number." };
    }

    const { data: existing } = await supabaseAdmin
      .from("certificate_issues")
      .select("*")
      .eq("registration_number", reg.registration_number)
      .eq("event_id", event.id)
      .maybeSingle();

    // Certificate eligibility = attendance (physical check-in), per event
    // rules. A participant who registered but never checked in is NOT
    // eligible. When attendance enforcement is on, require the configured
    // minimum check-in count (default 1 for single-day shibirs).
    const { count } = await supabaseAdmin
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("registration_number", reg.registration_number)
      .eq("event_id", event.id);
    const checkIns = count ?? 0;
    const attCfg = (event.config.attendance ?? {}) as {
      enable_tracking?: boolean;
      min_percent?: number;
    };
    const attendanceRequired = attCfg.enable_tracking !== false && cert.attendance_required !== false;
    const minCheckIns = Math.max(1, attCfg.min_percent && attCfg.min_percent <= 10 ? attCfg.min_percent : 1);
    const joined = checkIns > 0;
    const eligible = cert.enabled && (!attendanceRequired || checkIns >= minCheckIns);

    let issue = existing;

    // Auto-issue on first eligible lookup.
    if (!issue && cert.enabled && eligible) {
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

    return {
      ok: true as const,
      participant_name: reg.full_name,
      registration_number: reg.registration_number,
      event_title: event.config.general.title,
      joined,
      eligible,
      certificate_enabled: cert.enabled,
      issue: issue
        ? {
            certificate_number: (issue as { certificate_number: string }).certificate_number,
            status: (issue as { status: string }).status,
            issued_at: (issue as { issued_at: string | null }).issued_at,
          }
        : null,
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
