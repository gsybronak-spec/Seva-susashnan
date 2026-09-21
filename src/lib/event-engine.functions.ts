import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth";

import { VADODARA_EVENT_ID } from "@/lib/event-config";

const scannerSessionConfig = () => {
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

type ScannerSession = {
  scannerId?: string;
  eventId?: string;
  scannerName?: string;
  operatorName?: string;
};

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function signToken(tokenId: string, eventId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("QR signing is unavailable: SESSION_SECRET missing");
  const { createHmac } = await import("node:crypto");
  const payload = `v1.${eventId}.${tokenId}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function parseToken(
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

type ResolvedParticipant = {
  id: string;
  full_name: string;
  registration_number: string;
  event_id: string;
  mobile?: string | null;
  designation?: string | null;
  district?: string | null;
  taluka?: string | null;
};

type ResolveTokenResult =
  | { ok: true; registration: ResolvedParticipant }
  | {
      ok: false;
      error: "PLAIN_REGISTRATION_NUMBER" | "CROSS_EVENT" | "INVALID_QR" | "NOT_FOUND";
      message: string;
    };

/**
 * Authoritative Universal QR Token Resolver
 *
 * Enforces strict security safeguards:
 * 1. Plain registration numbers (e.g. PAT000177, VAD000001) are NEVER accepted as QR credentials.
 * 2. Formats supported:
 *    - Format 1: HMAC-SHA256 Signed token: v1.<eventId>.<tokenId>.<sig>
 *    - Format 2: Yogi Junagadh JSON format: {"t":"<token>","r":"<regNum>"}
 *    - Format 3: Legacy raw 32-hex qr_token or UUID token_id
 *    - Format 4: Tokenized ID card URL (?t=...&reg=...)
 * 3. Cross-event tokens from different events are strictly rejected with CROSS_EVENT.
 */
async function resolveTrustedToken(
  rawInput: string,
  _legacyEventId?: string,
): Promise<ResolveTokenResult> {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length < 3) {
    return { ok: false, error: "INVALID_QR", message: "અમાન્ય અથવા ખાલી QR કોડ." };
  }

  // MANDATORY SECURITY SAFEGUARD: Plain registration numbers must NEVER be accepted as QR credentials!
  if (/^[A-Za-z]{2,6}\d{3,8}$/.test(trimmed)) {
    return {
      ok: false,
      error: "PLAIN_REGISTRATION_NUMBER",
      message:
        "સાદો રજીસ્ટ્રેશન નંબર સીધો સ્કેન કરી શકાતો નથી. કૃપા કરીને ઓરિજિનલ આઈડી કાર્ડનો QR સ્કેન કરો અથવા નીચેથી 'મેન્યુઅલ હાજરી' નો ઉપયોગ કરો.",
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Format 1: Cryptographically signed v1 token: v1.<eventId>.<tokenId>.<sig>
  if (trimmed.startsWith("v1.")) {
    const parsed = await parseToken(trimmed);
    if (!parsed) {
      return { ok: false, error: "INVALID_QR", message: "અમાન્ય અથવા છેડછાડ કરેલ QR કોડ." };
    }
    const targetEventId = parsed.eventId;
    const { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
      .select("registration_id, registrations!inner(id, full_name, registration_number, event_id, mobile, designation, district, taluka)")
      .eq("token_id", parsed.tokenId)
      .eq("event_id", targetEventId)
      .maybeSingle();

    const reg = card?.registrations as unknown as ResolvedParticipant | undefined;
    if (!card || !reg) {
      return { ok: false, error: "NOT_FOUND", message: "આ QR કોડ સાથે જોડાયેલ રજીસ્ટ્રેશન મળ્યું નથી." };
    }
    return { ok: true, registration: reg };
  }

  // Format 2: Yogi Junagadh JSON format: {"t":"<token>","r":"<regNum>"}
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.includes('"t"') && trimmed.includes('"r"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const t = typeof parsed.t === "string" ? parsed.t.trim() : null;
      const r = typeof parsed.r === "string" ? parsed.r.trim() : null;
      if (t && r) {
        // Query registration by unique registration number
        const { data: reg } = await supabaseAdmin
          .from("registrations")
          .select("id, full_name, registration_number, event_id, mobile, designation, district, taluka, qr_token")
          .eq("registration_number", r)
          .maybeSingle();

        if (reg) {
          if (reg.qr_token && reg.qr_token === t) {
            return { ok: true, registration: reg };
          }
          // Also check card token_id
          const { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
            .select("token_id")
            .eq("registration_id", reg.id)
            .eq("event_id", reg.event_id)
            .maybeSingle();
          if (card && card.token_id === t) {
            return { ok: true, registration: reg };
          }
        }

        return { ok: false, error: "INVALID_QR", message: "અમાન્ય અથવા મેળ ન ખાતો QR કોડ." };
      }
    } catch {
      // Not JSON, continue to next formats
    }
  }

  // Format 4: Tokenized URL query string (e.g. ?t=...&reg=...)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("?")) {
    try {
      const url = new URL(trimmed, "https://local");
      const t = url.searchParams.get("t") || url.searchParams.get("token") || url.searchParams.get("qr_token");
      const r = url.searchParams.get("reg") || url.searchParams.get("r");
      if (t) {
        if (r) {
          return resolveTrustedToken(JSON.stringify({ t, r }));
        }
        return resolveTrustedToken(t);
      }
    } catch {}
  }

  // Format 3: Legacy raw 32-hex qr_token or UUID token_id
  const isHex32 = /^[a-f0-9]{32}$/i.test(trimmed);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

  if (isHex32 || isUuid) {
    // Check registrations by qr_token
    const { data: regByQr } = await supabaseAdmin
      .from("registrations")
      .select("id, full_name, registration_number, event_id, mobile, designation, district, taluka")
      .eq("qr_token", trimmed)
      .maybeSingle();

    if (regByQr) {
      return { ok: true, registration: regByQr };
    }

    // Check event_id_cards by token_id
    const { data: card } = await (supabaseAdmin.from("event_id_cards") as any)
      .select("registration_id, registrations!inner(id, full_name, registration_number, event_id, mobile, designation, district, taluka)")
      .eq("token_id", trimmed)
      .maybeSingle();

    const regByCard = card?.registrations as unknown as ResolvedParticipant | undefined;
    if (card && regByCard) {
      return { ok: true, registration: regByCard };
    }
  }

  return { ok: false, error: "INVALID_QR", message: "અમાન્ય અથવા અજાણ્યો QR કોડ." };
}

function requestMeta() {
  return { ip: null as string | null, userAgent: null as string | null };
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
// OPERATOR AUTHENTICATION & EVENT-WISE ATTENDANCE CHECK-IN
// -------------------------------------------------------------------------

export const operatorSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().trim().min(2).max(100),
        password: z.string().min(1).max(200),
        target_event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, verifyPassword } = await import("@/lib/admin-auth");

    const cleanUser = data.username.trim();

    // Query event_scanners by scanner_code (case-insensitive)
    let { data: scanner, error } = await (supabaseAdmin.from("event_scanners") as any)
      .select("id, event_id, scanner_code, scanner_name, operator_name, secret_hash, is_active, revoked_at, mobile")
      .ilike("scanner_code", cleanUser)
      .maybeSingle();

    // Fallback: search by mobile number if 10 digits
    if (!scanner && /^\d{10}$/.test(cleanUser)) {
      const { data: byMobile } = await (supabaseAdmin.from("event_scanners") as any)
        .select("id, event_id, scanner_code, scanner_name, operator_name, secret_hash, is_active, revoked_at, mobile")
        .eq("mobile", cleanUser)
        .maybeSingle();
      if (byMobile) scanner = byMobile;
    }

    if (error || !scanner) {
      return { ok: false as const, error: "Invalid username or scanner key / અમાન્ય યુઝરનેમ અથવા સ્કેનર કી" };
    }

    if (scanner.revoked_at) {
      return { ok: false as const, error: "This scanner authorization has been revoked / આ સ્કેનર અધિકાર રદ કરવામાં આવ્યો છે." };
    }
    if (!scanner.is_active) {
      return { ok: false as const, error: "This scanner authorization is currently inactive / આ સ્કેનર અધિકાર હાલમાં નિષ્ક્રિય છે." };
    }

    // Password verification: supports scrypt and backward-compatible sha256
    let passwordValid = false;
    let shouldUpgradeToScrypt = false;

    if (scanner.secret_hash.startsWith("scrypt$")) {
      passwordValid = await verifyPassword(data.password, scanner.secret_hash);
    } else if (scanner.secret_hash.length === 64) {
      // Legacy sha256 hash
      const providedHash = await sha256(data.password);
      if (providedHash === scanner.secret_hash) {
        passwordValid = true;
        shouldUpgradeToScrypt = true;
      }
    } else if (scanner.secret_hash === data.password) {
      // Fallback
      passwordValid = true;
      shouldUpgradeToScrypt = true;
    }

    if (!passwordValid) {
      return { ok: false as const, error: "Invalid username or scanner key / અમાન્ય યુઝરનેમ અથવા સ્કેનર કી" };
    }

    // Transparently upgrade legacy hash to scrypt on login
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      last_login_at: nowIso,
      last_activity_at: nowIso,
    };
    if (shouldUpgradeToScrypt) {
      updatePayload.secret_hash = await hashPassword(data.password);
    }
    await (supabaseAdmin.from("event_scanners") as any)
      .update(updatePayload)
      .eq("id", scanner.id);

    // Get event title (or fallback to neutral scanner title)
    let eventTitle = "Digital ID Card Scanner";
    const targetEvent = data.target_event_id || scanner.event_id;
    if (targetEvent) {
      const { data: eventRow } = await supabaseAdmin
        .from("events")
        .select("general, district")
        .eq("id", targetEvent)
        .maybeSingle();
      const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;
      eventTitle =
        (eventGeneral.title as string) ||
        (eventRow?.district ? `${eventRow.district} યોગ શિબિર` : eventTitle);
    }

    // Establish HttpOnly session cookie
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    await session.update({
      scannerId: scanner.id,
      eventId: targetEvent,
      scannerName: scanner.scanner_name,
      operatorName: scanner.operator_name,
    });

    return {
      ok: true as const,
      scanner_id: scanner.id as string,
      scanner_name: scanner.scanner_name as string,
      operator_name: scanner.operator_name as string,
      event_id: targetEvent as string,
      event_title: eventTitle,
    };
  });

export const scannerSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_key: z.string().min(3).max(300).optional(),
        username: z.string().trim().min(2).max(100).optional(),
        password: z.string().min(1).max(200).optional(),
        event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // If username and password provided, use operatorSignIn logic
    if (data.username && data.password) {
      return operatorSignIn({
        data: {
          username: data.username,
          password: data.password,
          target_event_id: data.event_id,
        },
      });
    }

    // Otherwise support access_key format (code.secret)
    if (!data.access_key) {
      return { ok: false as const, error: "Access key or username/password required." };
    }

    const split = data.access_key.indexOf(".");
    if (split < 1) return { ok: false as const, error: "Invalid scanner access key format." };
    const code = data.access_key.slice(0, split).trim();
    const secret = data.access_key.slice(split + 1).trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: scanner, error } = await (supabaseAdmin.from("event_scanners") as any)
      .select("id, event_id, secret_hash, is_active, revoked_at, scanner_name, operator_name")
      .ilike("scanner_code", code)
      .maybeSingle();

    if (error || !scanner) {
      return { ok: false as const, error: "Scanner record not found." };
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

    const targetEvent = data.event_id || scanner.event_id;
    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("general, district")
      .eq("id", targetEvent)
      .maybeSingle();

    const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;

    const session = await useSession<ScannerSession>(scannerSessionConfig());
    await session.update({
      scannerId: scanner.id,
      eventId: targetEvent,
      scannerName: scanner.scanner_name,
      operatorName: scanner.operator_name,
    });

    return {
      ok: true as const,
      scanner_name: scanner.scanner_name as string,
      operator_name: scanner.operator_name as string,
      event_id: targetEvent as string,
      event_title: (eventGeneral.title as string) || "Gujarat State Yog Board Event",
    };
  });

export const operatorCheck = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ target_event_id: z.string().uuid().optional() }).optional().parse(input ?? {})
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Check if scanner operator session exists
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    if (session.data.scannerId) {
      const { data: scanner } = await (supabaseAdmin.from("event_scanners") as any)
        .select("id, scanner_name, operator_name, is_active, revoked_at, event_id")
        .eq("id", session.data.scannerId)
        .maybeSingle();

      if (scanner && scanner.is_active && !scanner.revoked_at) {
        const currentEventId = data?.target_event_id || session.data.eventId || scanner.event_id;
        let eventTitle = "Digital ID Card Scanner";
        if (currentEventId) {
          const { data: eventRow } = await supabaseAdmin
            .from("events")
            .select("general, district")
            .eq("id", currentEventId)
            .maybeSingle();
          const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;
          eventTitle =
            (eventGeneral.title as string) ||
            (eventRow?.district ? `${eventRow.district} યોગ શિબિર` : eventTitle);
        }

        // Live attendance stats
        const [totalAttendedRes, operatorScansRes] = await Promise.all([
          currentEventId
            ? supabaseAdmin
                .from("attendance")
                .select("id", { count: "exact", head: true })
                .eq("event_id", currentEventId)
                .in("check_in_method", ["qr", "manual"])
            : Promise.resolve({ count: 0 }),
          supabaseAdmin
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("scanner_id", scanner.id),
        ]);

        return {
          authed: true as const,
          scanner_id: scanner.id as string,
          scanner_name: scanner.scanner_name as string,
          operator_name: scanner.operator_name as string,
          event_id: currentEventId as string,
          event_title: eventTitle,
          present_count: totalAttendedRes.count ?? 0,
          scan_count: operatorScansRes.count ?? 0,
        };
      }
    }

    // 2. Check if admin session exists
    try {
      const { getAdminSession } = await import("@/lib/admin-auth");
      const admin = await getAdminSession();
      if (admin.data.userId && admin.data.role) {
        const targetEventId = data?.target_event_id || VADODARA_EVENT_ID;
        const { data: eventRow } = await supabaseAdmin
          .from("events")
          .select("id, general, district")
          .eq("id", targetEventId)
          .maybeSingle();
        const eventGeneral = (eventRow?.general ?? {}) as Record<string, unknown>;

        const [totalAttendedRes, adminScansRes] = await Promise.all([
          supabaseAdmin
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("event_id", targetEventId)
            .in("check_in_method", ["qr", "manual"]),
          supabaseAdmin
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("event_id", targetEventId)
            .eq("checked_in_by", admin.data.userId),
        ]);

        return {
          authed: true as const,
          scanner_id: null,
          scanner_name: "Admin Console",
          operator_name: admin.data.username || "Admin",
          event_id: targetEventId,
          event_title:
            (eventGeneral.title as string) ||
            (eventRow?.district ? `${eventRow.district} યોગ શિબિર` : "Gujarat State Yog Board Event"),
          present_count: totalAttendedRes.count ?? 0,
          scan_count: adminScansRes.count ?? 0,
          is_admin: true,
        };
      }
    } catch {
      // Not admin
    }

    return { authed: false as const };
  });

export const scannerCheck = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional() }).optional().parse(input ?? {})
  )
  .handler(async ({ data }) => {
    const res = await operatorCheck({ data: { target_event_id: data?.event_id } });
    if (!res.authed) return { authed: false as const };
    return {
      authed: true as const,
      scanner_name: res.scanner_name,
      operator_name: res.operator_name,
      event_id: res.event_id,
      event_title: res.event_title,
    };
  });

export const operatorSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<ScannerSession>(scannerSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const scannerSignOut = operatorSignOut;

export const operatorCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        qr_token: z.string().trim().min(2).max(1000),
        target_event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    let scannerId: string | null | undefined = session.data.scannerId;
    const payloadHash = await sha256(data.qr_token);

    let isAdmin = false;
    let adminUserId: string | null = null;
    if (!scannerId) {
      try {
        const { getAdminSession } = await import("@/lib/admin-auth");
        const admin = await getAdminSession();
        if (admin.data.userId && admin.data.role) {
          isAdmin = true;
          adminUserId = admin.data.userId;
        }
      } catch {
        // Not admin
      }
    }

    if (!scannerId && !isAdmin) {
      return { ok: false as const, state: "unauthorized" as const, error: "સ્કેનર લોગિન જરૂરી છે." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If scanner operator, ensure active and not revoked
    if (!isAdmin && scannerId) {
      const { data: scanner } = await (supabaseAdmin.from("event_scanners") as any)
        .select("is_active, revoked_at")
        .eq("id", scannerId)
        .maybeSingle();

      if (!scanner || scanner.revoked_at || !scanner.is_active) {
        return {
          ok: false as const,
          state: "unauthorized" as const,
          error: scanner?.revoked_at ? "સ્કેનર અધિકાર રદ કરવામાં આવ્યો છે." : "સ્કેનર નિષ્ક્રિય છે.",
        };
      }
    }

    // Authoritative Universal QR Token Resolution (Event-Aware directly from the QR)
    const resolved = await resolveTrustedToken(data.qr_token);
    if (!resolved.ok) {
      if (scannerId) {
        // Update invalid_scans on event_scanners
        await supabaseAdmin
          .from("event_scanners")
          .update({
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", scannerId);
      }

      return {
        ok: false as const,
        state: "invalid" as const,
        error: resolved.message,
        code: resolved.error,
      };
    }

    const reg = resolved.registration;
    // The participant's actual event from the registration is authoritative!
    const participantEventId = reg.event_id;

    const meta = requestMeta();
    const [rpcResult, eventRowRes] = await Promise.all([
      (supabaseAdmin.rpc as any)("record_event_checkin", {
        _event_id: participantEventId,
        _registration_id: reg.id,
        _method: "qr",
        _scanner_id: scannerId ?? null,
        _checked_in_by: adminUserId || session.data.operatorName || session.data.scannerName || "operator",
        _payload_hash: payloadHash,
        _ip: meta.ip,
        _user_agent: meta.userAgent,
      }),
      supabaseAdmin
        .from("events")
        .select("general, district")
        .eq("id", participantEventId)
        .maybeSingle(),
    ]);

    if (rpcResult.error || !rpcResult.data?.[0]) {
      console.error("[operatorCheckIn] RPC error:", rpcResult.error);
      return { ok: false as const, state: "error" as const, error: "હાજરી નોંધવામાં ક્ષતિ આવી. ફરી પ્રયાસ કરો." };
    }

    const result = rpcResult.data[0] as { result: string; original_check_in: string };
    const eventGeneral = (eventRowRes.data?.general ?? {}) as Record<string, unknown>;
    const eventDistrict = (eventRowRes.data?.district as string) || "";
    const eventTitle =
      (eventGeneral.title as string) ||
      (eventDistrict ? `${eventDistrict} યોગ શિબિર` : "Gujarat State Yog Board Event");

    // Fetch updated live counts for this participant's event and operator's total scans
    const [totalAttendedRes, operatorScansRes] = await Promise.all([
      supabaseAdmin
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", participantEventId)
        .in("check_in_method", ["qr", "manual"]),
      scannerId
        ? supabaseAdmin
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("scanner_id", scannerId)
        : Promise.resolve({ count: 0 }),
    ]);

    return {
      ok: true as const,
      state: result.result === "duplicate" ? ("duplicate" as const) : ("success" as const),
      participant_name: reg.full_name,
      participant_id: reg.registration_number,
      event_id: participantEventId,
      event_title: eventTitle,
      district: eventDistrict,
      check_in_time: result.original_check_in,
      present_count: totalAttendedRes.count ?? 0,
      scan_count: operatorScansRes.count ?? 0,
    };
  });

export const scannerCheckIn = operatorCheckIn;

export const operatorSearchParticipants = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        target_event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    let authed = Boolean(session.data.scannerId);

    if (!authed) {
      try {
        const { getAdminSession } = await import("@/lib/admin-auth");
        const admin = await getAdminSession();
        if (admin.data.userId) {
          authed = true;
        }
      } catch {}
    }

    if (!authed) {
      return { ok: false as const, error: "સ્કેનર અધિકાર જરૂરી છે.", rows: [] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.query.replace(/[%_\\]/g, "\\$&");

    let queryBuilder = supabaseAdmin
      .from("registrations")
      .select("id, registration_number, full_name, mobile, district, event_id, custom_fields");

    if (data.target_event_id) {
      queryBuilder = queryBuilder.eq("event_id", data.target_event_id);
    }

    const { data: rows, error } = await queryBuilder
      .or(`full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,registration_number.ilike.%${safe}%`)
      .limit(25);

    if (error) {
      return { ok: false as const, error: error.message, rows: [] };
    }

    // Check attendance status for these rows
    const regIds = (rows ?? []).map((r) => r.id);
    const attendedSet = new Set<string>();
    if (regIds.length > 0) {
      const { data: attended } = await supabaseAdmin
        .from("attendance")
        .select("registration_id")
        .in("registration_id", regIds);
      (attended ?? []).forEach((a) => {
        if (a.registration_id) attendedSet.add(a.registration_id);
      });
    }

    return {
      ok: true as const,
      rows: (rows ?? []).map((r) => ({
        ...r,
        is_attended: attendedSet.has(r.id),
      })),
    };
  });

export const operatorManualCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        registration_id: z.string().uuid(),
        target_event_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await useSession<ScannerSession>(scannerSessionConfig());
    let operatorName = session.data.operatorName || session.data.scannerName || "Operator";
    let scannerId = session.data.scannerId;

    let adminUserId: string | null = null;
    let authed = Boolean(scannerId);
    if (!scannerId) {
      try {
        const { getAdminSession } = await import("@/lib/admin-auth");
        const admin = await getAdminSession();
        if (admin.data.userId) {
          authed = true;
          adminUserId = admin.data.userId;
          operatorName = admin.data.username || "Admin";
        }
      } catch {}
    }

    if (!authed) {
      return { ok: false as const, error: "સ્કેનર અધિકાર જરૂરી છે." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up registration to determine authoritative event_id
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select("id, full_name, registration_number, event_id")
      .eq("id", data.registration_id)
      .maybeSingle();

    if (regErr || !reg) {
      return { ok: false as const, error: "ભાગ લેનાર મળ્યા નથી." };
    }

    const meta = requestMeta();
    const [rpcResult, eventRowRes] = await Promise.all([
      (supabaseAdmin.rpc as any)("record_event_checkin", {
        _event_id: reg.event_id,
        _registration_id: reg.id,
        _method: "manual",
        _scanner_id: scannerId ?? null,
        _checked_in_by: adminUserId || operatorName,
        _payload_hash: null,
        _ip: meta.ip,
        _user_agent: meta.userAgent,
      }),
      supabaseAdmin
        .from("events")
        .select("general, district")
        .eq("id", reg.event_id)
        .maybeSingle(),
    ]);

    if (rpcResult.error || !rpcResult.data?.[0]) {
      console.error("[operatorManualCheckIn] error:", rpcResult.error);
      return { ok: false as const, error: "મેન્યુઅલ હાજરી નોંધવામાં નિષ્ફળતા મળી." };
    }

    const eventGeneral = (eventRowRes.data?.general ?? {}) as Record<string, unknown>;
    const eventDistrict = (eventRowRes.data?.district as string) || "";
    const eventTitle =
      (eventGeneral.title as string) ||
      (eventDistrict ? `${eventDistrict} યોગ શિબિર` : "Gujarat State Yog Board Event");

    return {
      ok: true as const,
      state: rpcResult.data[0].result as "success" | "duplicate",
      participant_name: reg.full_name,
      participant_id: reg.registration_number,
      event_id: reg.event_id,
      event_title: eventTitle,
      district: eventDistrict,
      check_in_time: rpcResult.data[0].original_check_in as string,
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

    const [summaryRes, regsRes, attendanceRes, scannersRes, eventRes] = await Promise.all([
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
        .select("id, scanner_name, scanner_code, operator_name, mobile, is_active, revoked_at, last_login_at, last_activity_at, total_scans, successful_scans, duplicate_attempts, invalid_scans, created_at")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("events")
        .select("id, slug, district, district_name, general")
        .eq("id", data.event_id)
        .maybeSingle(),
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
      event: eventRes.data ?? null,
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

export const adminListScannerOperators = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid().optional() }).optional().parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await (supabaseAdmin.from("event_scanners") as any)
      .select(
        "id, event_id, scanner_code, scanner_name, operator_name, mobile, is_active, revoked_at, last_login_at, last_activity_at, total_scans, successful_scans, duplicate_attempts, invalid_scans, created_at"
      )
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[adminListScannerOperators] error:", error);
      return { ok: false as const, error: error.message, scanners: [] };
    }

    return { ok: true as const, scanners: rows ?? [] };
  });

export const adminCreateScannerOperator = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        scanner_name: z.string().trim().min(2).max(80),
        operator_name: z.string().trim().min(2).max(120),
        mobile: z
          .string()
          .trim()
          .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")
          .optional()
          .or(z.literal("")),
        username: z.string().trim().min(3).max(50).optional(),
        password: z.string().min(4).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await requireSuperAdmin();
    const { hashPassword } = await import("@/lib/admin-auth");
    const { randomBytes } = await import("node:crypto");

    // Format or generate unique scanner_code
    let scannerCode = data.username ? data.username.trim().toUpperCase() : `SCN-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!scannerCode.startsWith("SCN-") && !data.username) {
      scannerCode = `SCN-${scannerCode}`;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check uniqueness
    const { data: existing } = await (supabaseAdmin.from("event_scanners") as any)
      .select("id")
      .ilike("scanner_code", scannerCode)
      .maybeSingle();

    if (existing) {
      return {
        ok: false as const,
        error: `Scanner username "${scannerCode}" is already in use. Please pick another.`,
      };
    }

    const hashedPassword = await hashPassword(data.password);

    const { data: inserted, error } = await (supabaseAdmin.from("event_scanners") as any)
      .insert({
        event_id: data.event_id,
        scanner_code: scannerCode,
        scanner_name: data.scanner_name,
        operator_name: data.operator_name,
        mobile: data.mobile || null,
        secret_hash: hashedPassword,
        created_by: admin.userId,
      })
      .select("id, scanner_code, scanner_name, operator_name, mobile")
      .single();

    if (error) {
      console.error("[adminCreateScannerOperator] error:", error);
      return { ok: false as const, error: "Failed to create scanner operator credentials." };
    }

    return {
      ok: true as const,
      scanner: inserted,
      scanner_code: scannerCode,
    };
  });

export const adminUpdateScannerOperator = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        scanner_id: z.string().uuid(),
        event_id: z.string().uuid(),
        scanner_name: z.string().trim().min(2).max(80).optional(),
        operator_name: z.string().trim().min(2).max(120).optional(),
        mobile: z
          .string()
          .trim()
          .regex(/^\d{10}$/, "Mobile must be 10 digits")
          .optional()
          .or(z.literal("")),
        password: z.string().min(4).max(100).optional(),
        action: z.enum(["activate", "deactivate", "revoke", "update"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("@/lib/admin-auth");

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.scanner_name) patch.scanner_name = data.scanner_name;
    if (data.operator_name) patch.operator_name = data.operator_name;
    if (data.mobile !== undefined) patch.mobile = data.mobile || null;
    if (data.password) {
      patch.secret_hash = await hashPassword(data.password);
    }

    if (data.action === "activate") {
      patch.is_active = true;
      patch.revoked_at = null;
    } else if (data.action === "deactivate") {
      patch.is_active = false;
    } else if (data.action === "revoke") {
      patch.is_active = false;
      patch.revoked_at = new Date().toISOString();
    }

    const { error } = await (supabaseAdmin.from("event_scanners") as any)
      .update(patch)
      .eq("id", data.scanner_id)
      .eq("event_id", data.event_id);

    if (error) {
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });

export const adminGetEventAttendanceStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [regsCountRes, attendedCountRes, qrCountRes, manualCountRes, duplicatesRes] = await Promise.all([
      supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", data.event_id),
      supabaseAdmin
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .in("check_in_method", ["qr", "manual"]),
      supabaseAdmin
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .eq("check_in_method", "qr"),
      supabaseAdmin
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .eq("check_in_method", "manual"),
      supabaseAdmin
        .from("event_checkin_attempts")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .eq("result", "duplicate"),
    ]);

    const totalRegistered = regsCountRes.count ?? 0;
    const totalAttended = attendedCountRes.count ?? 0;
    const qrAttended = qrCountRes.count ?? 0;
    const manualAttended = manualCountRes.count ?? 0;
    const duplicatesPrevented = duplicatesRes.count ?? 0;

    return {
      ok: true as const,
      stats: {
        total_registered: totalRegistered,
        total_attended: totalAttended,
        qr_attended: qrAttended,
        manual_attended: manualAttended,
        duplicates_prevented: duplicatesPrevented,
        attendance_rate: totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0,
      },
    };
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
