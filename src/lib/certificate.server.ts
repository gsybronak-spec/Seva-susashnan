import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";
import {
  formatCertificateNumber,
  isEventCompleted,
  mergeConfig,
  type CertificateNumberFormat,
  type EventCertificate,
  type EventConfig,
  type EventStatus,
} from "@/lib/event-config";

export type ActiveEvent = {
  id: string;
  district_id: string | null;
  config: EventConfig;
  event_date?: string | null;
  lifecycle_status?: string | null;
  status?: Partial<EventStatus> | null;
};

// Resolve the CURRENT ACTIVE published event (used only by the global,
// district-less certificate URL: /certificate). No hardcoded district — the
// active flag in the admin panel decides which event this URL serves.
async function resolveActiveCertificateEvent(): Promise<ActiveEvent | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const base = () =>
    supabaseAdmin
      .from("events")
      .select("*")
      .eq("is_active", true)
      .eq("publish_status", "published")
      .eq("is_template", false)
      .neq("lifecycle_status", "archived");

  // Several events can be flagged active at once, so prefer the one whose
  // event_date is today; otherwise fall back to the most recently updated.
  const today = new Date().toISOString().slice(0, 10);
  const { data: todays } = await base()
    .eq("event_date", today)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let data = todays;
  if (!data) {
    const { data: latest } = await base()
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = latest;
  }
  if (!data) return null;
  const raw = data as unknown as Partial<EventConfig> & {
    id: string;
    district_id?: string | null;
    event_date?: string | null;
    lifecycle_status?: string | null;
    status?: Partial<EventStatus> | null;
  };
  const cfg = mergeConfig(raw);
  return {
    id: raw.id,
    district_id: raw.district_id ?? null,
    event_date: raw.event_date ?? null,
    lifecycle_status: raw.lifecycle_status ?? null,
    status: raw.status ?? null,
    config: { ...cfg, id: raw.id },
  };
}

export async function loadCertificateEvent(districtSlug?: string | null): Promise<ActiveEvent | null> {
  const slug = (districtSlug ?? "").trim().toLowerCase();
  if (!slug) return resolveActiveCertificateEvent();
  const { resolveEvent } = await import("@/lib/event-resolver.server");
  const resolved = await resolveEvent(slug);
  if (!resolved || !resolved.event?.id) return null;
  const raw = resolved.event as Partial<EventConfig> & {
    id: string;
    event_date?: string | null;
    lifecycle_status?: string | null;
    status?: Partial<EventStatus> | null;
  };
  const cfg = mergeConfig(raw);
  return {
    id: raw.id,
    district_id: resolved.district_id,
    event_date: raw.event_date ?? null,
    lifecycle_status: raw.lifecycle_status ?? null,
    status: raw.status ?? null,
    config: { ...cfg, id: raw.id },
  };
}

export async function loadEventById(eventId: string): Promise<ActiveEvent | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: w } = await supabaseAdmin
    .from("events").select("*").eq("id", eventId).maybeSingle();
  if (!w) return null;
  const raw = w as unknown as Partial<EventConfig> & {
    id: string;
    district_id?: string | null;
    event_date?: string | null;
    lifecycle_status?: string | null;
    status?: Partial<EventStatus> | null;
  };
  const cfg = mergeConfig(raw);
  return {
    id: raw.id,
    district_id: raw.district_id ?? null,
    event_date: raw.event_date ?? null,
    lifecycle_status: raw.lifecycle_status ?? null,
    status: raw.status ?? null,
    config: { ...cfg, id: raw.id },
  };
}

export async function hasCheckedIn(regNo: string, eventId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("attendance")
    .select("id")
    .eq("registration_number", regNo)
    .eq("event_id", eventId)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function nextCertNumber(fmt: CertificateNumberFormat): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("certificate_issues")
    .select("*", { count: "exact", head: true });
  const base = (count ?? 0) + 1;
  for (let i = 0; i < 5; i++) {
    const candidate = formatCertificateNumber(fmt, base + i);
    const { data: exists } = await supabaseAdmin
      .from("certificate_issues")
      .select("id")
      .eq("certificate_number", candidate)
      .maybeSingle();
    if (!exists) return candidate;
  }
  return `${formatCertificateNumber(fmt, base)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function isEligibleForCertificate(event: ActiveEvent): boolean {
  return isEventCompleted({
    general: event.config.general,
    event_date: event.event_date ?? event.config.general.event_date,
    lifecycle_status: event.lifecycle_status,
    status: event.status,
  });
}

export async function getScopedCertificateRows(input: {
  status: "all" | "pending" | "approved" | "issued" | "rejected";
  search: string;
  event_id?: string;
}) {
  const session = await requireAdmin();
  const { resolveEventFilter } = await import("@/lib/admin-scope.server");
  const filter = await resolveEventFilter(session, input.event_id ?? null);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("certificate_issues")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (filter.mode === "single") q = q.eq("event_id", filter.id);
  else if (filter.mode === "many") {
    if (filter.ids.length === 0) return { ok: true as const, rows: [] };
    q = q.in("event_id", filter.ids);
  }
  if (input.status !== "all") q = q.eq("status", input.status);
  if (input.search) {
    const escapePostgREST = (str: string) => str.replace(/[%_\\]/g, '\\$&');
    const safeSearch = escapePostgREST(input.search);
    q = q.or(
      `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%,certificate_number.ilike.%${safeSearch}%`,
    );
  }
  const { data: rows, error } = await q;
  if (error) return { ok: false as const, error: error.message, rows: [] };
  return { ok: true as const, rows: rows ?? [] };
}

export async function approveCertificateIssue(id: string) {
  await requireSuperAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("certificate_issues")
    .update({
      status: "issued",
      approved_at: now,
      issued_at: now,
      approved_by: "admin",
      rejected_reason: null,
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function rejectCertificateIssue(id: string, reason?: string) {
  await requireSuperAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("certificate_issues")
    .update({ status: "rejected", rejected_reason: reason ?? null })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function regenerateCertificateIssue(id: string) {
  await requireSuperAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("certificate_issues").select("id, event_id").eq("id", id).maybeSingle();
  if (!row) return { ok: false as const, error: "Certificate not found." };
  const eventId = (row as { event_id: string | null }).event_id;
  let cfg: EventConfig | null = null;
  if (eventId) {
    const { data: w } = await supabaseAdmin
      .from("events").select("*").eq("id", eventId).maybeSingle();
    if (w) cfg = mergeConfig(w as unknown as Partial<EventConfig>);
  }
  if (!cfg) {
    const event = await loadCertificateEvent();
    if (!event) return { ok: false as const, error: "No active event." };
    cfg = event.config;
  }
  const number = await nextCertNumber(cfg.certificate.number_format);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("certificate_issues")
    .update({
      certificate_number: number,
      template_id: cfg.certificate.active_template_id,
      status: "issued",
      issued_at: now,
      approved_at: now,
      approved_by: "admin",
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, certificate_number: number };
}

export async function bulkIssueCertificates(eventId?: string) {
  const session = await requireSuperAdmin();
  if (eventId) {
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    await resolveEventFilter(session, eventId);
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let event: ActiveEvent | null = null;
  if (eventId) {
    event = await loadEventById(eventId);
  } else {
    event = await loadCertificateEvent();
  }
  if (!event) return { ok: false as const, error: "Event not found." };
  const cert = event.config.certificate;
  if (!cert.enabled) return { ok: false as const, error: "Certificates are disabled in settings." };

  // Rule: Registered participant + event completed. Attendance is NOT required.
  const eligible = isEligibleForCertificate(event);
  if (!eligible) {
    return {
      ok: false as const,
      error: "Event has not completed yet. Certificates can only be issued after the Yog Shibir is completed.",
    };
  }

  const fetchAllPaginated = async <T,>(table: string, select: string, extraFilter?: (q: any) => any) => {
    const PAGE = 1000;
    const all: T[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabaseAdmin
        .from(table as any)
        .select(select)
        .eq("event_id", event!.id)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (extraFilter) q = extraFilter(q);
      const { data, error } = await q;
      if (error) throw new Error(`Bulk issue failed fetching ${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      all.push(...(data as unknown as T[]));
      if (data.length < PAGE) break;
    }
    return all;
  };

  const regs = await fetchAllPaginated<{ registration_number: string; full_name: string; mobile: string }>(
    "registrations",
    "id, registration_number, full_name, mobile",
  );

  const existing = await fetchAllPaginated<{ registration_number: string }>(
    "certificate_issues",
    "id, registration_number",
  );
  const existingSet = new Set(existing.map((r) => r.registration_number));

  let issued = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  
  // Issue certificates to ALL registered participants without filtering by attendance
  for (const r of regs) {
    if (existingSet.has(r.registration_number)) { skipped += 1; continue; }
    
    const number = await nextCertNumber(cert.number_format);
    const { error } = await supabaseAdmin.from("certificate_issues").insert({
      event_id: event.id,
      district_id: event.district_id,
      registration_number: r.registration_number,
      full_name: r.full_name,
      mobile: r.mobile,
      certificate_number: number,
      template_id: cert.active_template_id,
      status: "issued",
      issued_at: now,
      approved_at: now,
      approved_by: "admin-bulk",
    });
    if (!error) issued += 1;
    else skipped += 1;
  }

  return { ok: true as const, issued, skipped };
}

export async function getCertificateRenderPayload(certificateNumber: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("certificate_issues")
    .select("*")
    .eq("certificate_number", certificateNumber)
    .in("status", ["issued", "approved"])
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Certificate not available." };
  const r = row as {
    certificate_number: string;
    registration_number: string;
    full_name: string;
    issued_at: string | null;
    template_id: string | null;
    event_id: string | null;
  };

  const { data: w } = await supabaseAdmin
    .from("events")
    .select("general, certificate")
    .eq("id", r.event_id ?? "")
    .maybeSingle();
  if (!w) return { ok: false as const, error: "Event not found." };

  const cfg = mergeConfig({
    general: (w.general ?? {}) as unknown as EventConfig["general"],
    certificate: (w.certificate ?? {}) as unknown as EventConfig["certificate"],
  } as Partial<EventConfig>);
  const template =
    cfg.certificate.templates.find((t) => t.id === (r.template_id ?? cfg.certificate.active_template_id)) ??
    cfg.certificate.templates[0];

  return {
    ok: true as const,
    participant_name: r.full_name,
    registration_number: r.registration_number,
    certificate_number: r.certificate_number,
    issued_at: r.issued_at,
    general: cfg.general,
    certificate: cfg.certificate,
    template,
  };
}