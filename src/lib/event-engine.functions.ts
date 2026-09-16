import { createServerFn } from "@tanstack/react-start";
import { getRequest, useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";

export const VADODARA_EVENT_ID = "2caae4eb-03b7-47be-98fa-a4a145867bd2";
export const VADODARA_EVENT_SLUG = "vadodara-yog-shibir";

export const scannerSessionConfig = () => {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET is not configured or too short (min 32 chars)");
  }
  return {
    password,
    name: "gsyb-event-scanner",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
};

export type ScannerSession = {
  scannerId?: string;
  eventId?: string;
  scannerName?: string;
  operatorName?: string;
};

export async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function signToken(tokenId: string, eventId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("QR signing is unavailable: SESSION_SECRET missing");
  const { createHmac } = await import("node:crypto");
  const payload = `v1.${eventId}.${tokenId}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function parseToken(
  value: string,
  expectedEventId?: string,
): Promise<{ eventId: string; tokenId: string } | null> {
  const parts = value.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const eventId = parts[1];
  const tokenId = parts[2];
  if (expectedEventId && eventId !== expectedEventId) return null;

  const expected = await signToken(tokenId, eventId);
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { eventId, tokenId };
}

function requestMeta() {
  const request = getRequest();
  return {
    ip:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}

async function logAttempt(input: {
  eventId: string;
  result:
    | "invalid_qr"
    | "not_registered"
    | "scanner_inactive"
    | "scanner_revoked"
    | "unauthorized"
    | "cross_event";
  scannerId?: string | null;
  registrationId?: string | null;
  payloadHash?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = requestMeta();
    await (supabaseAdmin.from("event_checkin_attempts") as any).insert({
      event_id: input.eventId,
      registration_id: input.registrationId ?? null,
      scanner_id: input.scannerId ?? null,
      method: "qr",
      result: input.result,
      payload_hash: input.payloadHash ?? null,
      ip: meta.ip,
      user_agent: meta.userAgent,
    });
  } catch (err) {
    console.error("[logAttempt] error:", err);
  }
}

// -------------------------------------------------------------------------
// ID CARD LOOKUP & DOWNLOAD TRACKING
// -------------------------------------------------------------------------

export const getEventIdCard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        registration_number: z.string().trim().min(3).max(60),
        access_key: z.string().min(10).max(100).optional(),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("registrations")
      .select("id, registration_number, full_name, mobile, district, taluka, designation, referred_by, custom_fields, event_id")
      .eq("registration_number", data.registration_number);

    if (data.event_id) {
      query = query.eq("event_id", data.event_id);
    }

    const { data: registration, error: regError } = await query.maybeSingle();
    if (regError || !registration) {
      return { ok: false as const, error: "Participant registration not found." };
    }

    const eventId = registration.event_id;
    if (!eventId) {
      return { ok: false as const, error: "Registration is not associated with an event." };
    }

    // Get event details
    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("id, event_date, event_time, venue, general")
      .eq("id", eventId)
      .maybeSingle();

    // Ensure event_id_cards record exists
    let { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
      .select("id, token_id, issued_at, download_count, access_hash")
      .eq("event_id", eventId)
      .eq("registration_id", registration.id)
      .maybeSingle();

    if (!card) {
      // Create card record if not already created
      const accessKey = data.access_key || `acc_${crypto.randomUUID().replace(/-/g, "")}`;
      const accessHash = await sha256(accessKey);
      const { data: newCard, error: cardCreateErr } = await (supabaseAdmin.from("event_id_cards") as any)
        .insert({
          event_id: eventId,
          registration_id: registration.id,
          access_hash: accessHash,
        })
        .select("id, token_id, issued_at, download_count, access_hash")
        .single();

      if (cardCreateErr || !newCard) {
        return { ok: false as const, error: "Unable to issue digital ID card." };
      }
      card = newCard;
    } else if (data.access_key && card.access_hash) {
      const providedHash = await sha256(data.access_key);
      if (providedHash !== card.access_hash) {
        // Fallback check: allow if admin session is active
        try {
          await requireAdmin();
        } catch {
          return { ok: false as const, error: "This digital ID card link has an invalid access key." };
        }
      }
    }

    const cf = ((registration.custom_fields ?? {}) as Record<string, unknown>);
    const general = ((eventRow?.general ?? {}) as Record<string, unknown>);

    const signedQr = await signToken(card.token_id as string, eventId);

    const eventTitle = (general.title as string) || "ગુજરાત રાજ્ય યોગ બોર્ડ યોગ શિબિર";
    const rawDate = eventRow?.event_date || (general.event_date as string);
    const eventDate = rawDate
      ? new Date(rawDate + (rawDate.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    const eventTime =
      (general.start_time && general.end_time
        ? `${general.start_time} – ${general.end_time}`
        : null) ||
      eventRow?.event_time ||
      (general.event_time as string) ||
      "";
    const venue = eventRow?.venue || (general.venue as string) || (general.venue_address as string) || "";

    const participantType = String(cf.participant_type || registration.designation || "").trim();
    const zone = String(cf.zone || cf.municipal_zone || "").trim();
    const taluka = String(cf.taluka || cf.rural_taluka || registration.taluka || "").trim();
    const district = String(registration.district || cf.district || "").trim();
    const coachName = String(cf.coach_name || "").trim();
    const coordinatorName = String(cf.coordinator_name || "").trim();
    const referenceName = String(registration.referred_by || cf.reference_name || "").trim();
    const referralCode = String(cf.referral_code || "").trim();

    return {
      ok: true as const,
      card_id: card.id as string,
      participant_id: registration.registration_number,
      participant_name: registration.full_name,
      mobile: registration.mobile,
      event_id: eventId,
      event_title: eventTitle,
      event_date: eventDate,
      event_time: eventTime,
      venue,
      district,
      taluka,
      zone,
      participant_type: participantType,
      coach_name: coachName,
      coordinator_name: coordinatorName,
      reference_name: referenceName,
      referral_code: referralCode,
      issued_at: card.issued_at as string,
      qr_token: signedQr,
    };
  });

export const recordIdCardDownload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        card_id: z.string().uuid(),
        registration_number: z.string().min(3).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
        .select("id, download_count")
        .eq("id", data.card_id)
        .maybeSingle();

      if (!card) return { ok: false as const };
      const now = new Date().toISOString();
      await (supabaseAdmin.from("event_id_cards") as any)
        .update({
          download_count: Number(card.download_count || 0) + 1,
          first_downloaded_at: card.download_count ? undefined : now,
          last_downloaded_at: now,
        })
        .eq("id", card.id);

      return { ok: true as const };
    } catch (err) {
      console.error("[recordIdCardDownload] error:", err);
      return { ok: true as const };
    }
  });

// -------------------------------------------------------------------------
// SCANNER AUTHENTICATION & CHECK-IN
// -------------------------------------------------------------------------

export const scannerSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_key: z.string().min(10).max(300),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const split = data.access_key.indexOf(".");
    if (split < 1) return { ok: false as const, error: "Invalid scanner access key format." };
    const code = data.access_key.slice(0, split).trim();
    const secret = data.access_key.slice(split + 1).trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: scanner, error } = await (supabaseAdmin.from("event_scanners") as any)
      .select("id, event_id, secret_hash, is_active, revoked_at, scanner_name, operator_name")
      .eq("scanner_code", code)
      .maybeSingle();

    if (error || !scanner) {
      return { ok: false as const, error: "Scanner record not found." };
    }

    if (data.event_id && scanner.event_id !== data.event_id) {
      return { ok: false as const, error: "This scanner is registered for a different event." };
    }

    const secretHash = await sha256(secret);
    if (secretHash !== scanner.secret_hash) {
      return { ok: false as const, error: "Invalid scanner credentials." };
    }

    if (scanner.revoked_at) {
      return { ok: false as const, error: "This scanner authorization has been revoked." };
    }
    if (!scanner.is_active) {
      return { ok: false as const, error: "This scanner authorization is currently inactive." };
    }

    // Get event title
    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("general")
      .eq("id", scanner.event_id)
      .maybeSingle();

    const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;

    const session = await useSession<ScannerSession>(scannerSessionConfig());
    await session.update({
      scannerId: scanner.id,
      eventId: scanner.event_id,
      scannerName: scanner.scanner_name,
      operatorName: scanner.operator_name,
    });

    return {
      ok: true as const,
      scanner_name: scanner.scanner_name as string,
      operator_name: scanner.operator_name as string,
      event_id: scanner.event_id as string,
      event_title: (eventGeneral.title as string) || "Gujarat State Yog Board Event",
    };
  });

export const scannerCheck = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<ScannerSession>(scannerSessionConfig());
  if (!session.data.scannerId || !session.data.eventId) {
    return { authed: false as const };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: scanner } = await (supabaseAdmin.from("event_scanners") as any)
    .select("id, scanner_name, operator_name, is_active, revoked_at, event_id")
    .eq("id", session.data.scannerId)
    .eq("event_id", session.data.eventId)
    .maybeSingle();

  if (!scanner || !scanner.is_active || scanner.revoked_at) {
    return { authed: false as const };
  }

  const { data: eventRow } = await supabaseAdmin
    .from("events")
    .select("general")
    .eq("id", scanner.event_id)
    .maybeSingle();

  const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;

  return {
    authed: true as const,
    scanner_name: scanner.scanner_name as string,
    operator_name: scanner.operator_name as string,
    event_id: scanner.event_id as string,
    event_title: (eventGeneral.title as string) || "Gujarat State Yog Board Event",
  };
});

export const scannerSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<ScannerSession>(scannerSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const scannerCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        qr_token: z.string().min(10).max(500),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    const scannerId = session.data.scannerId;
    const scannerEventId = session.data.eventId;
    const payloadHash = await sha256(data.qr_token);

    if (!scannerId || !scannerEventId) {
      if (data.event_id) {
        await logAttempt({ eventId: data.event_id, result: "unauthorized", payloadHash });
      }
      return { ok: false as const, state: "unauthorized" as const, error: "Scanner sign-in is required." };
    }

    if (data.event_id && data.event_id !== scannerEventId) {
      await logAttempt({ eventId: data.event_id, result: "cross_event", scannerId, payloadHash });
      return { ok: false as const, state: "invalid" as const, error: "Scanner is bound to a different event." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: scanner } = await (supabaseAdmin.from("event_scanners") as any)
      .select("is_active, revoked_at")
      .eq("id", scannerId)
      .eq("event_id", scannerEventId)
      .maybeSingle();

    if (!scanner || scanner.revoked_at || !scanner.is_active) {
      await logAttempt({
        eventId: scannerEventId,
        result: scanner?.revoked_at ? "scanner_revoked" : scanner ? "scanner_inactive" : "unauthorized",
        scannerId,
        payloadHash,
      });
      return {
        ok: false as const,
        state: "unauthorized" as const,
        error: scanner?.revoked_at ? "Scanner authorization has been revoked." : "Scanner authorization is inactive.",
      };
    }

    // Verify cryptographic token signature
    const parsed = await parseToken(data.qr_token, scannerEventId);
    if (!parsed) {
      await logAttempt({ eventId: scannerEventId, result: "invalid_qr", scannerId, payloadHash });
      return { ok: false as const, state: "invalid" as const, error: "Invalid, expired, or tampered QR code." };
    }

    // Lookup ID card and linked registration
    const { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
      .select("registration_id, registrations!inner(id, full_name, registration_number, event_id)")
      .eq("token_id", parsed.tokenId)
      .eq("event_id", scannerEventId)
      .maybeSingle();

    const reg = card?.registrations as unknown as
      | { id: string; full_name: string; registration_number: string; event_id: string }
      | undefined;

    if (!card || !reg || reg.event_id !== scannerEventId) {
      await logAttempt({ eventId: scannerEventId, result: "cross_event", scannerId, payloadHash });
      return { ok: false as const, state: "invalid" as const, error: "QR code does not belong to this event." };
    }

    const meta = requestMeta();
    const { data: rows, error: rpcErr } = await (supabaseAdmin.rpc as any)("record_event_checkin", {
      _event_id: scannerEventId,
      _registration_id: card.registration_id,
      _method: "qr",
      _scanner_id: scannerId,
      _checked_in_by: null,
      _payload_hash: payloadHash,
      _ip: meta.ip,
      _user_agent: meta.userAgent,
    });

    if (rpcErr || !rows?.[0]) {
      console.error("[scannerCheckIn] RPC error:", rpcErr);
      return { ok: false as const, state: "error" as const, error: "Attendance recording failed." };
    }

    const result = rows[0] as { result: string; original_check_in: string };
    return {
      ok: true as const,
      state: result.result === "duplicate" ? ("duplicate" as const) : ("success" as const),
      participant_name: reg.full_name,
      participant_id: reg.registration_number,
      check_in_time: result.original_check_in,
    };
  });

// -------------------------------------------------------------------------
// ADMIN EVENT OPERATIONS & DASHBOARD
// -------------------------------------------------------------------------

export const adminEventOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [summaryRes, regsRes, attendanceRes, scannersRes] = await Promise.all([
      (supabaseAdmin.rpc as any)("event_overview_stats", { _event_id: data.event_id }),
      supabaseAdmin
        .from("registrations")
        .select("id, registration_number, full_name, mobile, district, custom_fields, created_at")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("attendance")
        .select("id, registration_id, registration_number, full_name, mobile, check_in_method, scanner_id, check_in_time")
        .eq("event_id", data.event_id)
        .in("check_in_method", ["qr", "manual"])
        .order("check_in_time", { ascending: false })
        .limit(50),
      (supabaseAdmin.from("event_scanners") as any)
        .select("id, scanner_name, scanner_code, operator_name, is_active, revoked_at, last_activity_at, total_scans, duplicate_attempts, created_at")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: false }),
    ]);

    if (summaryRes.error) {
      console.error("[adminEventOverview] summary error:", summaryRes.error);
      return { ok: false as const, error: "Failed to load event statistics." };
    }

    const stats = summaryRes.data as {
      registered: number;
      id_cards: number;
      checked_in: number;
      pending: number;
      attendance_pct: number;
      qr: number;
      manual: number;
      duplicate_attempts: number;
      certificate_eligible: number;
      certificate_downloads: number;
      by_type: Array<{ type: string; registered: number; attended: number }>;
      by_zone: Array<{ zone: string; registered: number; attended: number }>;
    };

    return {
      ok: true as const,
      stats,
      registrations: regsRes.data ?? [],
      latest: attendanceRes.data ?? [],
      scanners: scannersRes.data ?? [],
    };
  });

export const adminSearchParticipants = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        query: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.query.replace(/[%_\\]/g, "\\$&");

    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select("id, registration_number, full_name, mobile, district, custom_fields")
      .eq("event_id", data.event_id)
      .or(`full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,registration_number.ilike.%${safe}%`)
      .limit(30);

    return error
      ? { ok: false as const, error: error.message, rows: [] }
      : { ok: true as const, rows: rows ?? [] };
  });

export const adminManualCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        registration_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = requestMeta();

    const { data: rows, error } = await (supabaseAdmin.rpc as any)("record_event_checkin", {
      _event_id: data.event_id,
      _registration_id: data.registration_id,
      _method: "manual",
      _scanner_id: null,
      _checked_in_by: admin.userId || "admin",
      _payload_hash: null,
      _ip: meta.ip,
      _user_agent: meta.userAgent,
    });

    if (error || !rows?.[0]) {
      console.error("[adminManualCheckIn] error:", error);
      return { ok: false as const, error: "Manual check-in failed." };
    }

    return {
      ok: true as const,
      state: rows[0].result as "success" | "duplicate",
      check_in_time: rows[0].original_check_in as string,
    };
  });

export const adminCreateScanner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        scanner_name: z.string().trim().min(2).max(80),
        operator_name: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await requireSuperAdmin();
    const { randomBytes } = await import("node:crypto");
    const secret = randomBytes(24).toString("base64url");
    const scannerCode = `SCN-${randomBytes(5).toString("hex").toUpperCase()}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("event_scanners") as any).insert({
      event_id: data.event_id,
      scanner_code: scannerCode,
      scanner_name: data.scanner_name,
      operator_name: data.operator_name,
      secret_hash: await sha256(secret),
      created_by: admin.userId,
    });

    if (error) {
      console.error("[adminCreateScanner] error:", error);
      return { ok: false as const, error: "Failed to create scanner operator credentials." };
    }

    return { ok: true as const, access_key: `${scannerCode}.${secret}` };
  });

export const adminSetScannerStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        scanner_id: z.string().uuid(),
        event_id: z.string().uuid(),
        action: z.enum(["activate", "deactivate", "revoke"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.action === "activate"
        ? { is_active: true, revoked_at: null }
        : data.action === "deactivate"
        ? { is_active: false }
        : { is_active: false, revoked_at: new Date().toISOString() };

    const { error } = await (supabaseAdmin.from("event_scanners") as any)
      .update(patch)
      .eq("id", data.scanner_id)
      .eq("event_id", data.event_id);

    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  });

export const adminExportEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const output: any[] = [];

    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("registrations")
        .select("id, registration_number, full_name, mobile, district, taluka, designation, custom_fields, created_at")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + 999);

      if (error) return { ok: false as const, error: error.message, rows: [] };
      if (!page?.length) break;
      output.push(...page);
      if (page.length < 1000) break;
    }

    const attendanceMap = new Map<string, { check_in_method: string; check_in_time: string }>();
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabaseAdmin
        .from("attendance")
        .select("registration_id, check_in_method, check_in_time")
        .eq("event_id", data.event_id)
        .in("check_in_method", ["qr", "manual"])
        .range(from, from + 999);

      if (!page?.length) break;
      page.forEach((r: any) => {
        if (r.registration_id) {
          attendanceMap.set(r.registration_id, {
            check_in_method: r.check_in_method,
            check_in_time: r.check_in_time,
          });
        }
      });
      if (page.length < 1000) break;
    }

    return {
      ok: true as const,
      rows: output.map((r) => {
        const checkIn = attendanceMap.get(r.id);
        return {
          ...r,
          attended: !!checkIn,
          check_in_method: checkIn?.check_in_method ?? "",
          check_in_time: checkIn?.check_in_time ?? "",
        };
      }),
    };
  });
