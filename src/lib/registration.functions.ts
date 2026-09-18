import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { mergeCoverage } from "@/lib/event-config";


const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(200)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  organization: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  taluka: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  gender: z
    .enum(["Male", "Female"])
    .optional(),
  date_of_birth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  designation: z
    .string()
    .trim()
    .max(80)
    .optional(),
  ref: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  partner_slug: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  district_slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  // Submitted only for zone / state events: the participant's district id,
  // validated server-side against the event's coverage (never trusted as-is).
  district_id: z.string().uuid().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

function computeAge(dobISO: string, referenceISO: string | null): number | null {
  const dob = new Date(dobISO + "T00:00:00");
  if (isNaN(dob.getTime())) return null;
  const ref = referenceISO ? new Date(referenceISO + "T00:00:00") : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}


export const registerParticipant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEvent } = await import("@/lib/event-resolver.server");

    // Resolve the target district + event. Falls back to the default microsite when
    // no slug is provided (backwards compatible with legacy /register).
    const resolved = await resolveEvent(data.district_slug);
    if (!resolved || !resolved.event?.id) {
      return {
        ok: false as const,
        error: "This district is not open for registration yet.",
      };
    }
    const event_id = resolved.event.id as string;
    let district_id = resolved.district_id ?? null;
    // Never substitute a hardcoded district name: the registration row must
    // carry the district of the event it actually belongs to, or nothing.
    let districtName = resolved.district_name ?? resolved.district_slug ?? null;

    const eventGeneral = (resolved.event.general ?? {}) as Record<string, any>;
    const eventLevel = String(eventGeneral.level || resolved.event.type || "").trim().toLowerCase();
    const isDistrictEvent = eventLevel === "district";

    if (isDistrictEvent) {
      const trustedDistrict = (
        resolved.district_name ||
        resolved.event.district_name ||
        resolved.event.district ||
        eventGeneral.district ||
        districtName ||
        ""
      ).trim();
      if (trustedDistrict) {
        districtName = trustedDistrict;
      }
    }

    // Strict coverage-aware district resolution:
    // - Zone: participant MUST submit a district_id present in the event's coverage.district_ids
    // - State: participant MUST submit a district_id present in active districts
    // - Single: district is resolved from the event's owning district
    // The canonical district name is looked up directly from the `districts` table.
    // Under no circumstances may a registration be saved with NULL, empty, "Unspecified", or a event slug as district.
    const coverage = mergeCoverage(
      (resolved.event as { general?: { coverage?: unknown } | null }).general?.coverage,
      district_id,
    );

    if (coverage.type !== "single") {
      let allowed: string[] | null = coverage.district_ids;
      if (coverage.type === "state") {
        const { data: allDistricts } = await supabaseAdmin
          .from("districts")
          .select("id")
          .eq("is_active", true);
        allowed = (allDistricts ?? []).map((d) => d.id as string);
      }
      const submitted = data.district_id;
      if (!submitted || !allowed || allowed.length === 0 || !allowed.includes(submitted)) {
        return {
          ok: false as const,
          error: "Please select a district from the districts allowed for this event.",
        };
      }
      const { data: d } = await supabaseAdmin
        .from("districts")
        .select("id, name")
        .eq("id", submitted)
        .maybeSingle();
      if (!d?.name || !d.name.trim()) {
        return {
          ok: false as const,
          error: "Invalid district selected. Please choose a valid district.",
        };
      }
      district_id = d.id;
      districtName = d.name.trim();
    } else {
      // Single district event
      if (district_id) {
        const { data: d } = await supabaseAdmin
          .from("districts")
          .select("id, name")
          .eq("id", district_id)
          .maybeSingle();
        if (d?.name) {
          districtName = d.name.trim();
          district_id = d.id;
        }
      }
      if (!isDistrictEvent) {
        // Prefer the district the participant actually picked in THIS event's
        // own form (e.g. a "taluka"/"district" dropdown), instead of falling back
        // to the event slug or a generic state name.
        const formFields = ((resolved.event as {
          form?: { fields?: unknown[] } | null;
        }).form?.fields ?? []) as Array<{
          key?: string;
          enabled?: boolean;
          hidden?: boolean;
          options?: Array<{ id?: string; label?: string }>;
        }>;
        const districtField = formFields.find(
          (f) =>
            f &&
            f.enabled !== false &&
            f.hidden !== true &&
            Array.isArray(f.options) &&
            f.options.length > 0 &&
            (f.key === "district" || f.key === "taluka"),
        );
        if (districtField?.key) {
          const submitted = data.custom_fields?.[districtField.key];
          const raw = typeof submitted === "string" ? submitted.trim() : "";
          if (raw) {
            const match = (districtField.options ?? []).find(
              (o) =>
                (o.label ?? "").toLowerCase() === raw.toLowerCase() ||
                (o.id ?? "").toLowerCase() === raw.toLowerCase(),
            );
            if (match?.label) districtName = match.label;
          }
        }
      }

      // Never use a event slug or "Unspecified" as district name
      if (
        !districtName ||
        districtName.toLowerCase() === "unspecified" ||
        /^event[-_0-9]/i.test(districtName) ||
        /-zone$/i.test(districtName)
      ) {
        districtName = resolved.district_name || "Unknown";
      }
    }


    // Strict integrity check: districtName MUST NOT be null, empty, or "Unspecified"
    if (!districtName || districtName.trim() === "" || districtName.toLowerCase() === "unspecified") {
      return {
        ok: false as const,
        error: "A valid district is required for registration.",
      };
    }


    // Registration open? (feature toggle on the district's active event)
    const features = (resolved.event.features ?? {}) as { registration?: boolean };
    const general = (resolved.event.general ?? {}) as { registration_enabled?: boolean; registration_mode?: string };
    if (features.registration === false || general.registration_enabled === false || general.registration_mode === "external") {
      return {
        ok: false as const,
        error: "Registrations are currently closed for this district.",
      };
    }

    // All pre-insert lookups are independent of each other, so they run in
    // parallel. Previously they were awaited one after another (duplicate ->
    // referral -> partner), which stacked 3 sequential round trips on top of
    // the event/district resolution and could push the whole request past
    // the client's 30s timeout whenever the database was under load.
    const [existingRes, refRes, partnerRes] = await Promise.all([
      // Check mobile uniqueness within this event
      supabaseAdmin
        .from("registrations")
        .select("registration_number")
        .eq("mobile", data.mobile)
        .eq("event_id", event_id)
        .maybeSingle(),
      // Optional referral validation (must belong to the SAME event so each
      // event has an isolated referral graph).
      data.ref
        ? supabaseAdmin
            .from("registrations")
            .select("registration_number")
            .eq("registration_number", data.ref)
            .eq("event_id", event_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Optional partner validation.
      data.partner_slug
        ? supabaseAdmin
            .from("partners")
            .select("id, partner_name, status, link_disabled, district_id, event_id")
            .eq("slug", data.partner_slug)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const existing = existingRes.data as { registration_number: string } | null;
    if (existing) {
      return {
        ok: false as const,
        error: "This mobile number is already registered for this event.",
        registration_number: existing.registration_number,
      };
    }

    const refRow = refRes.data as { registration_number: string } | null;
    const referred_by: string | null = refRow ? refRow.registration_number : null;

    // If a partner is provided AND that partner is scoped to a specific
    // district, ensure it matches this district.
    let partner_id: string | null = null;
    let partner_name: string | null = null;
    const p = partnerRes.data as {
      id: string;
      partner_name: string;
      status: string;
      link_disabled: boolean;
      district_id: string | null;
      event_id?: string | null;
    } | null;
    if (p && p.status === "active" && !p.link_disabled) {
      const partnerEventId = p.event_id ?? null;
      if (
        partnerEventId === event_id ||
        (!partnerEventId && (!p.district_id || !district_id || p.district_id === district_id))
      ) {
        partner_id = p.id;
        partner_name = p.partner_name;
      }
    }


    // Compute age from date_of_birth using the resolved event's date (or today).
    let age: number | null = null;
    if (data.date_of_birth) {
      const eventDate =
        (resolved.event.general as { event_date?: string | null } | null)?.event_date ?? null;
      age = computeAge(data.date_of_birth, eventDate);
    }

    // Preserve user-selected district/area if present, otherwise default to districtName
    const cf = { ...(data.custom_fields ?? {}) };
    if (isDistrictEvent && districtName) {
      if (!cf.district || typeof cf.district !== "string" || !cf.district.trim()) {
        cf.district = districtName;
      }
    }
    const isVadodara =
      resolved.event?.slug === "vadodara-yog-shibir" ||
      event_id === "2caae4eb-03b7-47be-98fa-a4a145867bd2";

    if (isVadodara) {
      const submittedDistrict = (cf.district ?? districtName ?? "").toString().trim().toUpperCase();
      const validDistricts = ["VADODARA EAST", "VADODARA WEST", "VADODARA RURAL"];
      let vDistrict = validDistricts.find((d) => d === submittedDistrict);
      if (!vDistrict) {
        if (cf.area_type === "gramya" || cf.rural_taluka) {
          vDistrict = "VADODARA RURAL";
        } else if (cf.municipal_zone === "zone_1" || cf.municipal_zone === "zone_2") {
          vDistrict = "VADODARA EAST";
        } else if (cf.area_type === "municipal") {
          vDistrict = "VADODARA WEST";
        }
      }

      if (!vDistrict) {
        return {
          ok: false as const,
          error: "Please select a valid District (VADODARA EAST, VADODARA WEST, or VADODARA RURAL).",
        };
      }

      districtName = vDistrict;
      cf.district = vDistrict;
      cf.area_type = vDistrict === "VADODARA RURAL" ? "gramya" : "municipal";
      if (vDistrict === "VADODARA RURAL") {
        cf.rural_taluka = "VADODARA RURAL";
        delete cf.municipal_zone;
      } else {
        cf.municipal_zone = vDistrict;
        delete cf.rural_taluka;
      }

      if (cf.reference_name) {
        cf.reference_name = String(cf.reference_name).trim();
      }
      if (cf.referral_code || data.ref) {
        cf.referral_code = String(cf.referral_code || data.ref).trim().toUpperCase();
      }
    } else {
      // Generic multi-event dynamic fields:
      // Clean and preserve custom fields configured by Admin for this event without hardcoded values
      if (cf.reference_name) {
        cf.reference_name = String(cf.reference_name).trim();
      }
      if (cf.referral_code || data.ref) {
        cf.referral_code = String(cf.referral_code || data.ref).trim().toUpperCase();
      }
      if (cf.zone) {
        cf.zone = String(cf.zone).trim();
      }
      if (cf.area) {
        cf.area = String(cf.area).trim();
      }
      if (cf.participant_type) {
        cf.participant_type = String(cf.participant_type).trim();
      }
      if (cf.coach_name) {
        cf.coach_name = String(cf.coach_name).trim();
      }
      if (cf.coordinator_name) {
        cf.coordinator_name = String(cf.coordinator_name).trim();
      }
    }

    // The DB trigger assigns registration_number using this event's own
    // prefix + per-event sequence, so we send a placeholder and read back
    // the authoritative value from the insert.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("registrations")
      .insert({
        registration_number: "pending",
        full_name: data.full_name.trim().toUpperCase(),
        mobile: data.mobile,
        email: data.email ?? null,
        organization: data.organization ?? null,
        taluka: data.taluka ?? null,
        gender: data.gender ?? null,
        date_of_birth: data.date_of_birth ?? null,
        age,
        district: districtName,
        designation:
          (typeof cf.participant_type === "string" && cf.participant_type.trim().length > 0
            ? cf.participant_type.trim()
            : data.designation ?? null),
        referral_code: "pending",
        referred_by,
        partner_id,
        partner_name,
        event_id,
        district_id,
        // Unique per-participant QR token used on the digital ID card for
        // physical check-in at the shibir venue.
        qr_token: crypto.randomUUID().replace(/-/g, ""),
        custom_fields: cf,
      })
      .select("id, registration_number")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return {
          ok: false as const,
          error: "This mobile number is already registered for this event.",
        };
      }
      return { ok: false as const, error: "Registration failed. Please try again." };
    }
    if (!inserted) {
      return { ok: false as const, error: "Registration failed. Please try again." };
    }

    const { randomBytes, createHash } = await import("node:crypto");
    const cardAccess = randomBytes(24).toString("base64url");
    const accessHash = createHash("sha256").update(cardAccess, "utf8").digest("hex");

    await (supabaseAdmin.from("event_id_cards") as any).insert({
      event_id,
      registration_id: inserted.id,
      access_hash: accessHash,
    });

    return {
      ok: true as const,
      registration_number: inserted.registration_number,
      card_access: cardAccess,
      event_id,
    };
    } catch (err) {
      console.error("[registerParticipant] fatal:", err);
      return {
        ok: false as const,
        error: "Registration failed due to a temporary server issue. Please try again.",
      };
    }
  });

export const lookupCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        mobile: z
          .string()
          .trim()
          .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
        district_slug: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // H-2: resolve the current event and scope the lookup by event_id so
    // a mobile number cannot leak PII across events.
    const { resolveEvent } = await import("@/lib/event-resolver.server");
    const resolved = await resolveEvent(data.district_slug);
    if (!resolved?.event?.id) {
      return { ok: false as const, error: "No active event." };
    }
    const event_id = resolved.event.id as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("registrations")
      .select(
        "registration_number, full_name, certificate_available, certificate_url",
      )
      .eq("mobile", data.mobile)
      .eq("event_id", event_id)
      .maybeSingle();

    if (!row) {
      return { ok: false as const, error: "No registration found for this mobile number." };
    }
    return {
      ok: true as const,
      participant_name: row.full_name,
      registration_number: row.registration_number,
      available: row.certificate_available,
      certificate_url: row.certificate_url,
    };
  });

// ---------------- Public Referral Code Lookup ----------------
// Lightweight, non-blocking referral code validator isolated strictly to the
// current event. Never throws, never hangs, and has a strict 5s internal timeout.
export const lookupReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        ref: z.string().trim().min(1).max(40),
        district_slug: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const rawRef = data.ref.trim().toUpperCase();
    if (!rawRef || !/^SYB[A-Z0-9_-]{4,}$/i.test(rawRef)) {
      return {
        ok: true as const,
        valid: false as const,
        message: "Invalid referral code format.",
      };
    }

    const { resolveEvent } = await import("@/lib/event-resolver.server");
    const resolved = await resolveEvent(data.district_slug);
    if (!resolved?.event?.id) {
      return {
        ok: true as const,
        valid: false as const,
        message: "Event not found.",
      };
    }

    const event_id = resolved.event.id as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Strictly timeout after 5 seconds so it can never hang
    const queryPromise = supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name")
      .eq("registration_number", rawRef)
      .eq("event_id", event_id)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("Referral lookup timed out") }), 5000),
    );

    const { data: row, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error || !row) {
      return {
        ok: true as const,
        valid: false as const,
        message: "Referral code is not valid for this event.",
      };
    }

    return {
      ok: true as const,
      valid: true as const,
      registration_number: row.registration_number as string,
      full_name: (row.full_name as string) || "Participant",
    };
  });

// ---------------- Admin ----------------

import {
  getAdminSession,
  requireAdmin,
  requireSuperAdmin,
  hashPassword,
  verifyPassword,
  constantTimeEqualStrings,
  type AdminRole,
} from "@/lib/admin-auth";

// ---- Login throttling (defense-in-depth, schema-free) ----
// In-memory per-instance throttle keyed by username: N failed attempts lock
// the account out for a fixed window. No database table is required and
// nothing sensitive is logged. Not a global lockout across instances, but it
// meaningfully slows brute force without a schema change.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map<
  string,
  { count: number; lockedUntil: number }
>();

function pruneLoginAttempts(now: number) {
  if (loginAttempts.size < 5000) return;
  for (const [k, v] of loginAttempts) {
    if (v.lockedUntil > 0 && v.lockedUntil <= now) loginAttempts.delete(k);
  }
}

function checkLoginLock(username: string): string | null {
  const now = Date.now();
  pruneLoginAttempts(now);
  const rec = loginAttempts.get(username);
  if (rec && rec.lockedUntil > now) {
    const mins = Math.max(1, Math.ceil((rec.lockedUntil - now) / 60000));
    return `Too many failed attempts. Try again in ${mins} min.`;
  }
  return null;
}

function recordLoginFailure(username: string) {
  const now = Date.now();
  const rec = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  if (rec.lockedUntil <= now) {
    rec.count = 0;
    rec.lockedUntil = 0;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOGIN_LOCK_MS;
    rec.count = 0;
  }
  loginAttempts.set(username, rec);
}

function clearLoginAttempts(username: string) {
  loginAttempts.delete(username);
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().trim().min(1).max(60).toLowerCase(),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const locked = checkLoginLock(data.username);
    if (locked) return { ok: false as const, error: locked };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("admin_users")
      .select("id, username, password_hash, role, disabled, must_change_password")
      .eq("username", data.username)
      .maybeSingle();

    if (!user || user.disabled) {
      recordLoginFailure(data.username);
      return { ok: false as const, error: "Invalid credentials." };
    }

    let ok = false;
    // Super admin authentication via server-side ADMIN_PASSWORD environment variable
    if (user.role === "super_admin" && process.env.ADMIN_PASSWORD) {
      ok = await constantTimeEqualStrings(data.password, process.env.ADMIN_PASSWORD);
      if (!ok && user.password_hash) {
        ok = await verifyPassword(data.password, user.password_hash);
      }
    } else if (user.password_hash) {
      ok = await verifyPassword(data.password, user.password_hash);
    } else if (user.role === "super_admin") {
      const bootstrap = process.env.ADMIN_PASSWORD;
      if (!bootstrap) return { ok: false as const, error: "Admin password not configured." };
      ok = await constantTimeEqualStrings(data.password, bootstrap);
    } else {
      return {
        ok: false as const,
        error: "Account is not yet activated. Ask a Super Admin to set a password.",
      };
    }

    if (!ok) {
      recordLoginFailure(data.username);
      return { ok: false as const, error: "Invalid credentials." };
    }
    clearLoginAttempts(data.username);

    await supabaseAdmin
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    const session = await getAdminSession();
    await session.update({
      userId: user.id,
      username: user.username,
      role: user.role as AdminRole,
      mustChangePassword: Boolean(user.must_change_password),
    });
    return {
      ok: true as const,
      role: user.role as AdminRole,
      must_change_password: Boolean(user.must_change_password),
    };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  let can_view_partners = false;
  if (session.data.userId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin
      .from("admin_users")
      .select("can_view_partners, role")
      .eq("id", session.data.userId)
      .maybeSingle();
    can_view_partners = !!u?.can_view_partners || u?.role === "super_admin";
  }
  return {
    authed: !!session.data.userId,
    userId: session.data.userId ?? null,
    username: session.data.username ?? null,
    role: (session.data.role as AdminRole | undefined) ?? null,
    must_change_password: !!session.data.mustChangePassword,
    can_view_partners,
  };
});


// Change own password (any admin)
export const adminChangeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        current_password: z.string().min(1),
        new_password: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const s = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("admin_users")
      .select("id, password_hash, role")
      .eq("id", s.userId!)
      .maybeSingle();
    if (!user) return { ok: false as const, error: "Account not found." };

    let ok = false;
    if (!user.password_hash) {
      const bootstrap = process.env.ADMIN_PASSWORD;
      ok = !!bootstrap && (await constantTimeEqualStrings(data.current_password, bootstrap));
    } else {
      ok = await verifyPassword(data.current_password, user.password_hash);
    }
    if (!ok) return { ok: false as const, error: "Current password is incorrect." };

    const hash = await hashPassword(data.new_password);
    await supabaseAdmin
      .from("admin_users")
      .update({ password_hash: hash, must_change_password: false })
      .eq("id", user.id);

    const session = await getAdminSession();
    await session.update({ ...session.data, mustChangePassword: false });
    return { ok: true as const };
  });

// ---------------- Super Admin Password Reset ----------------
// Secure, server-side recovery mechanism specifically for the Super Admin.
// Requires verification against the server's recovery key (ADMIN_RESET_KEY,
// ADMIN_PASSWORD, or SESSION_SECRET), uses the exact same scrypt algorithm,
// rate-limits failed attempts, preserves super_admin role and permissions,
// and strictly modifies only the Super Admin account.
export const adminResetSuperAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().trim().min(1).max(60).toLowerCase(),
        recovery_key: z.string().min(16).max(200),
        new_password: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const lockKey = `reset:${data.username}`;
    const locked = checkLoginLock(lockKey);
    if (locked) return { ok: false as const, error: locked };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("admin_users")
      .select("id, username, role, disabled")
      .eq("username", data.username)
      .maybeSingle();

    if (!user || user.role !== "super_admin") {
      recordLoginFailure(lockKey);
      return { ok: false as const, error: "Invalid reset request." };
    }

    const validKey =
      process.env.ADMIN_RESET_KEY ||
      process.env.ADMIN_PASSWORD ||
      process.env.SESSION_SECRET;

    if (!validKey || validKey.length < 16) {
      return {
        ok: false as const,
        error: "Server recovery key not configured. Set ADMIN_RESET_KEY or ADMIN_PASSWORD in environment.",
      };
    }

    const match = await constantTimeEqualStrings(data.recovery_key, validKey);
    if (!match) {
      recordLoginFailure(lockKey);
      return { ok: false as const, error: "Invalid recovery key." };
    }

    clearLoginAttempts(lockKey);
    clearLoginAttempts(data.username);

    const hash = await hashPassword(data.new_password);
    const { error: updateErr } = await supabaseAdmin
      .from("admin_users")
      .update({
        password_hash: hash,
        must_change_password: false,
        disabled: false,
      })
      .eq("id", user.id);

    if (updateErr) {
      return { ok: false as const, error: updateErr.message || "Failed to update password." };
    }

    return { ok: true as const, message: "Super Admin password reset successfully." };
  });

// ---------------- Super admin: user management ----------------

export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, username, role, disabled, must_change_password, last_login_at, created_at, password_hash, can_view_partners")
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message, rows: [] };
  return {
    ok: true as const,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      disabled: r.disabled,
      must_change_password: r.must_change_password,
      last_login_at: r.last_login_at,
      created_at: r.created_at,
      has_password: !!r.password_hash,
      can_view_partners: !!r.can_view_partners,
    })),
  };
});

export const adminSetUserCanViewPartners = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), allow: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ can_view_partners: data.allow })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });


export const adminCreateUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(60)
          .regex(/^[a-z0-9_.-]+$/i, "Only letters, numbers, . _ -")
          .toLowerCase(),
        role: z.enum(["super_admin", "view_admin"]),
        password: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashPassword(data.password);
    const { error } = await supabaseAdmin.from("admin_users").insert({
      username: data.username,
      role: data.role,
      password_hash: hash,
      disabled: false,
      must_change_password: false,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().min(8).max(200),
        require_change: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashPassword(data.password);
    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({
        password_hash: hash,
        must_change_password: data.require_change,
        disabled: false,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminSetUserDisabled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await requireSuperAdmin();
    if (me.userId === data.id && data.disabled) {
      return { ok: false as const, error: "You cannot disable your own account." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ disabled: data.disabled })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const me = await requireSuperAdmin();
    if (me.userId === data.id) {
      return { ok: false as const, error: "You cannot delete your own account." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Prevent removing the last super admin
    const { data: supers } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("role", "super_admin")
      .eq("disabled", false);
    const { data: target } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("id", data.id)
      .maybeSingle();
    if (target?.role === "super_admin" && (supers?.length ?? 0) <= 1) {
      return { ok: false as const, error: "Cannot delete the last active Super Admin." };
    }
    const { error } = await supabaseAdmin.from("admin_users").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Registrations list / toggle ----------------

export const adminList = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional().default(""),
        event_id: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Helper to prevent PostgREST ilike injection
    const escapePostgREST = (str: string) => str.replace(/[%_\\]/g, '\\$&');

    // Page through all matching registrations (PostgREST caps a single response at 1000 rows).
    const PAGE = 1000;
    const MAX_ADMIN_LIST_ROWS = 10_000;
    const s = data.search.trim();
    const safeSearch = escapePostgREST(s);
    const rows: Array<Record<string, unknown>> = [];
    if (filter.mode === "many" && filter.ids.length === 0) {
      return { ok: true as const, rows: [], truncated: false, counts: {} };
    }
    let truncated = false;
    for (let from = 0; ; from += PAGE) {
      if (rows.length >= MAX_ADMIN_LIST_ROWS) {
        truncated = true;
        break;
      }
      let query = supabaseAdmin
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (filter.mode === "single") query = query.eq("event_id", filter.id);
      else if (filter.mode === "many") query = query.in("event_id", filter.ids);
      if (s) {
        query = query.or(
          `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%,gender.ilike.%${safeSearch}%`,
        );
      }
      const { data: page, error } = await query;
      if (error) return { ok: false as const, error: error.message, rows: [], truncated: false };
      if (!page || page.length === 0) break;
      rows.push(...(page as Array<Record<string, unknown>>));
      if (page.length < PAGE) break;
    }

    if (truncated) {
      let qCheck = supabaseAdmin
        .from("registrations")
        .select("id")
        .order("created_at", { ascending: false })
        .range(MAX_ADMIN_LIST_ROWS, MAX_ADMIN_LIST_ROWS)
        .limit(1);
      if (filter.mode === "single") qCheck = qCheck.eq("event_id", filter.id);
      else if (filter.mode === "many") qCheck = qCheck.in("event_id", filter.ids);
      if (s) {
        qCheck = qCheck.or(
          `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%,gender.ilike.%${safeSearch}%`,
        );
      }
      const { data: extra } = await qCheck;
      if (!extra || extra.length === 0) {
        truncated = false;
      }
    }

    let refQuery = supabaseAdmin
      .from("registrations")
      .select("referred_by")
      .not("referred_by", "is", null);
    if (filter.mode === "single") refQuery = refQuery.eq("event_id", filter.id);
    else if (filter.mode === "many") refQuery = refQuery.in("event_id", filter.ids);
    const { data: refRows } = await refQuery;
    const counts = new Map<string, number>();
    (refRows ?? []).forEach((r) => {
      const k = r.referred_by as string;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });


    // Reporting-only normalization: dropdown answers are stored as option
    // *values* (e.g. "opt_1"). Resolve them to the labels configured on the
    // owning event's own form so exports read "Mehsana", not "opt_1".
    // Strictly per-event — no global value→label mapping is ever used.
    const { buildOptionLabelMaps, resolveOptionLabel } = await import("@/lib/form-options");
    const eventIds = Array.from(
      new Set(rows.map((r) => r.event_id).filter((v): v is string => typeof v === "string")),
    );
    const labelMaps = new Map<string, ReturnType<typeof buildOptionLabelMaps>>();
    if (eventIds.length) {
      const { data: cfgRows } = await supabaseAdmin
        .from("events")
        .select("id, form")
        .in("id", eventIds);
      for (const c of cfgRows ?? []) {
        labelMaps.set(c.id as string, buildOptionLabelMaps((c as { form: unknown }).form));
      }
    }

    // Attach check-in status so the participant table can filter by
    // attendance (Modules 5 / 12 / 17). Chunked in() respects URL limits.
    const listRegNumbers = Array.from(
      new Set(rows.map((r) => r.registration_number as string).filter(Boolean)),
    );
    const attMap = new Map<
      string,
      { status: string; check_in_time: string | null; check_in_method: string | null }
    >();
    for (let i = 0; i < listRegNumbers.length; i += 500) {
      let aq = supabaseAdmin
        .from("attendance")
        .select("registration_number, status, check_in_time, check_in_method")
        .in("registration_number", listRegNumbers.slice(i, i + 500));
      if (filter.mode === "single") aq = aq.eq("event_id", filter.id);
      else if (filter.mode === "many") aq = aq.in("event_id", filter.ids);
      const { data: attRows } = await aq;
      for (const a of attRows ?? []) {
        const ar = a as { registration_number: string; status: string; check_in_time: string | null; check_in_method: string | null };
        attMap.set(ar.registration_number, {
          status: ar.status,
          check_in_time: ar.check_in_time,
          check_in_method: ar.check_in_method,
        });
      }
    }

    return {
      ok: true as const,
      truncated,
      rows: rows.map((r) => {
        const maps = labelMaps.get(r.event_id as string) ?? null;
        const att = attMap.get(r.registration_number as string) ?? null;
        return {
          ...r,
          taluka_label: resolveOptionLabel(maps, "taluka", r.taluka),
          district_label: resolveOptionLabel(maps, "district", r.district),
          referral_count: counts.get(r.registration_number as string) ?? 0,
          attendance_status: att ? (att.status || "Checked-In") : "Pending",
          check_in_time: att?.check_in_time ?? null,
          check_in_method: att?.check_in_method ?? null,
        };
      }),
    };
  });



// ---------------- Registrations chunked export ----------------

export const adminExportBatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional().default(""),
        event_id: z.string().uuid().optional(),
        offset: z.number().int().min(0),
        limit: z.number().int().min(1).max(10000),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Helper to prevent PostgREST ilike injection
    const escapePostgREST = (str: string) => str.replace(/[%_\\]/g, "\\$&");


    const s = data.search.trim();
    const safeSearch = escapePostgREST(s);
    const rows: Array<Record<string, unknown>> = [];
    if (filter.mode === "many" && filter.ids.length === 0) {
      return { ok: true as const, rows: [] };
    }
    
    // Fetch precisely the chunk requested by the client, respecting PostgREST 1000 limits if needed
    const PAGE = 1000;
    for (let currentOffset = data.offset; currentOffset < data.offset + data.limit; currentOffset += PAGE) {
      const currentLimit = Math.min(PAGE, data.offset + data.limit - currentOffset);
      let query = supabaseAdmin
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(currentOffset, currentOffset + currentLimit - 1);

        
      if (filter.mode === "single") query = query.eq("event_id", filter.id);
      else if (filter.mode === "many") query = query.in("event_id", filter.ids);
      
      if (s) {
        query = query.or(
          `full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%,gender.ilike.%${safeSearch}%`,
        );
      }
      
      const { data: page, error } = await query;
      if (error) return { ok: false as const, error: error.message, rows: [] };
      if (!page || page.length === 0) break;
      rows.push(...(page as Array<Record<string, unknown>>));
      if (page.length < currentLimit) break;
    }

    let refQuery = supabaseAdmin
      .from("registrations")
      .select("referred_by")
      .not("referred_by", "is", null);
    if (filter.mode === "single") refQuery = refQuery.eq("event_id", filter.id);
    else if (filter.mode === "many") refQuery = refQuery.in("event_id", filter.ids);
    const { data: refRows } = await refQuery;
    const counts = new Map<string, number>();
    (refRows ?? []).forEach((r) => {
      const k = r.referred_by as string;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });

    const { buildOptionLabelMaps, resolveOptionLabel } = await import("@/lib/form-options");
    const eventIds = Array.from(
      new Set(rows.map((r) => r.event_id).filter((v): v is string => typeof v === "string")),
    );
    const labelMaps = new Map<string, ReturnType<typeof buildOptionLabelMaps>>();
    if (eventIds.length) {
      const { data: cfgRows } = await supabaseAdmin
        .from("events")
        .select("id, form")
        .in("id", eventIds);
      for (const c of cfgRows ?? []) {
        labelMaps.set(c.id as string, buildOptionLabelMaps((c as { form: unknown }).form));
      }
    }

    // Attach physical check-in / attendance data (Module 16 export fields).
    // Chunked `in()` keeps URLs within PostgREST limits.
    const regNumbers = Array.from(
      new Set(rows.map((r) => r.registration_number as string).filter(Boolean)),
    );
    const attMap = new Map<
      string,
      { status: string; check_in_time: string | null; check_in_method: string | null }
    >();
    for (let i = 0; i < regNumbers.length; i += 500) {
      let aq = supabaseAdmin
        .from("attendance")
        .select("registration_number, status, check_in_time, check_in_method")
        .in("registration_number", regNumbers.slice(i, i + 500));
      if (filter.mode === "single") aq = aq.eq("event_id", filter.id);
      else if (filter.mode === "many") aq = aq.in("event_id", filter.ids);
      const { data: attRows } = await aq;
      for (const a of attRows ?? []) {
        const ar = a as { registration_number: string; status: string; check_in_time: string | null; check_in_method: string | null };
        attMap.set(ar.registration_number, {
          status: ar.status,
          check_in_time: ar.check_in_time,
          check_in_method: ar.check_in_method,
        });
      }
    }

    return {
      ok: true as const,
      rows: rows.map((r) => {
        const maps = labelMaps.get(r.event_id as string) ?? null;
        const att = attMap.get(r.registration_number as string) ?? null;
        return {
          ...r,
          taluka_label: resolveOptionLabel(maps, "taluka", r.taluka),
          district_label: resolveOptionLabel(maps, "district", r.district),
          referral_count: counts.get(r.registration_number as string) ?? 0,
          attendance_status: att ? "Checked-In" : "Pending",
          check_in_time: att?.check_in_time ?? null,
          check_in_method: att?.check_in_method ?? null,
          registration_status: "Registered",
        };
      }),
    };
  });

// ---------------- District-wise registration counts (server-side aggregate) ----------------

export const adminDistrictCounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id);
    // Scope guard: the caller must actually be allowed to read this event.
    const allowed =
      filter.mode === "any" ||
      (filter.mode === "single" && filter.id === data.event_id) ||
      (filter.mode === "many" && filter.ids.includes(data.event_id));
    if (!allowed) return { ok: false as const, error: "Not allowed for this event.", rows: [], total: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Event row: coverage lives in `general` (JSONB, exists in every DB) +
    // owning district for single-district events + title for the dashboard.
    const { data: w } = await supabaseAdmin
      .from("events")
      .select("id, district_id, general")
      .eq("id", data.event_id)
      .maybeSingle();
    if (!w) return { ok: false as const, error: "Event not found.", rows: [], total: 0 };
    const general = (w.general ?? {}) as Record<string, unknown>;
    const eventTitle = (general.title as string | undefined) ?? null;

    // Authoritative total = the event's registration count (cheap head
    // count — no registration rows are shipped to the browser).
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.event_id);
    const total = count ?? 0;

    // RPC aggregation, scoped strictly by event_id (GROUP BY in SQL).
    const { data: rpcRows, error } = await supabaseAdmin.rpc(
      "registration_geo_counts" as never,
      { _event_id: data.event_id } as never,
    );
    if (error) return { ok: false as const, error: error.message, rows: [], total };

    const { data: cfg } = await supabaseAdmin
      .from("events")
      .select("form")
      .eq("id", data.event_id)
      .maybeSingle();
    const { buildOptionLabelMaps, resolveOptionLabel } = await import("@/lib/form-options");
    const maps = buildOptionLabelMaps((cfg as { form?: unknown } | null)?.form);

    type GeoRow = { field: string; value: string; cnt: number | string };
    const all = (rpcRows ?? []) as GeoRow[];

    // Which field holds the district breakdown for THIS event: prefer the
    // configured option-bearing field, never a hardcoded district list.
    const hasOptions = (key: string) => Object.keys(maps.byField[key] ?? {}).length > 0;
    const distinct = (key: string) => new Set(all.filter((r) => r.field === key).map((r) => r.value)).size;
    let sourceField: "taluka" | "district" = "district";
    if (hasOptions("taluka") && (!hasOptions("district") || distinct("district") <= 1)) {
      sourceField = "taluka";
    } else if (!hasOptions("district") && distinct("district") <= 1 && distinct("taluka") > 1) {
      sourceField = "taluka";
    }

    // Per-event label resolution: option values (opt_1, ...) map through
    // THIS event's own form — never a global value -> district mapping.
    const agg = new Map<string, number>();
    for (const r of all) {
      if (r.field !== sourceField) continue;
      const n = Number(r.cnt) || 0;
      const label = r.value === "Unspecified" ? "Unspecified" : resolveOptionLabel(maps, sourceField, r.value);
      agg.set(label, (agg.get(label) ?? 0) + n);
    }

    // Coverage: explicit config on this event drives the applicable list.
    // Legacy events (no coverage) keep the existing data-driven breakdown
    // so pre-coverage multi-district events are NOT regressed to one row.
    const rawCoverage = general.coverage as unknown;
    const coverage = mergeCoverage(rawCoverage, (w.district_id as string | null) ?? null);
    const isExplicit =
      !!rawCoverage &&
      typeof rawCoverage === "object" &&
      ((rawCoverage as { type?: unknown }).type === "single" ||
        (rawCoverage as { type?: unknown }).type === "zone" ||
        (rawCoverage as { type?: unknown }).type === "state");

    if (!isExplicit) {
      // LEGACY mode — every district present in the data, current behavior.
      const rows = Array.from(agg.entries())
        .map(([name, count]) => ({
          name,
          count,
          pct: total ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return {
        ok: true as const,
        rows,
        total,
        source_field: sourceField,
        mode: "data" as const,
        event_title: eventTitle,
        coverage_type: null,
        coverage_names: [] as string[],
      };
    }

    // COVERAGE mode — single → its one district; zone → configured ids;
    // state → all active districts. Zero-count districts appear as 0.
    let districtIds: string[] = [];
    if (coverage.type === "single") {
      if (w.district_id) districtIds = [w.district_id as string];
    } else if (coverage.type === "zone") {
      districtIds = coverage.district_ids ?? [];
    } else {
      const { data: active } = await supabaseAdmin
        .from("districts")
        .select("id")
        .eq("is_active", true);
      districtIds = (active ?? []).map((d) => d.id as string);
    }
    const applicable: Array<{ id: string; name: string }> = [];
    if (districtIds.length > 0) {
      const { data: ds } = await supabaseAdmin
        .from("districts")
        .select("id, name")
        .in("id", districtIds);
      applicable.push(...((ds ?? []) as Array<{ id: string; name: string }>));
    }

    const { mergeDistrictCounts } = await import("@/lib/district-counts");
    const rows = mergeDistrictCounts({ applicable, countsByLabel: agg, total });

    return {
      ok: true as const,
      rows,
      total,
      source_field: sourceField,
      mode: "coverage" as const,
      event_title: eventTitle,
      coverage_type: coverage.type,
      coverage_names: applicable.map((d) => d.name),
    };
  });


export const adminToggleCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        registration_number: z.string().min(6).max(40).regex(/^[A-Z0-9]{2,10}\d{4,}$/),
        available: z.boolean(),
        // Event ID must be provided to ensure we don't accidentally toggle a
        // registration number collision from a different event.
        event_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("registrations")
      .update({ certificate_available: data.available })
      .eq("registration_number", data.registration_number)
      .eq("event_id", data.event_id);
    const { error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Public settings ----------------

export const getPublicSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .eq("key", "certificates_enabled")
      .maybeSingle();
    const enabled =
      data?.value === true || data?.value === "true" || data?.value === 1;
    return { certificates_enabled: !!enabled };
  },
);

export const adminSetCertificatesEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: "certificates_enabled", value: data.enabled, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---------------- Admin stats ----------------

export const adminStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const { resolveEventFilter } = await import("@/lib/admin-scope.server");
    const filter = await resolveEventFilter(session, data.event_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Stats = {
      total?: number;
      today?: number;
      totalReferrals?: number;
      partnerRegistrations?: number;
      byDesignation?: Record<string, number>;
      byGender?: Record<string, number>;
      byAgeGroup?: Record<string, number>;
      leaderboard?: Array<{ registration_number: string; full_name: string; count: number }>;
      partnerLeaderboard?: Array<{ id: string; slug: string; partner_name: string; count: number }>;
    };

    async function statsFor(id?: string): Promise<Stats> {
      const { data: rpcData, error } = await supabaseAdmin.rpc(
        "registration_stats" as never,
        (id ? { _event_id: id } : {}) as never,
      );
      if (error) throw new Error(error.message);
      return (rpcData ?? {}) as Stats;
    }

    let s: Stats;
    if (filter.mode === "any") {
      s = await statsFor(undefined);
    } else if (filter.mode === "single") {
      s = await statsFor(filter.id);
    } else {
      // View admin with a restricted list — aggregate across allowed events.
      if (filter.ids.length === 0) {
        s = {};
      } else {
        const parts = await Promise.all(filter.ids.map((id) => statsFor(id)));
        const sumRec = (key: keyof Stats) => {
          const out: Record<string, number> = {};
          for (const p of parts) {
            const rec = (p[key] ?? {}) as Record<string, number>;
            for (const [k, v] of Object.entries(rec)) out[k] = (out[k] ?? 0) + v;
          }
          return out;
        };
        const sumBoard = (key: "leaderboard" | "partnerLeaderboard") => {
          const merged = new Map<string, { row: Record<string, unknown>; count: number }>();
          for (const p of parts) {
            for (const r of (p[key] ?? []) as Array<Record<string, unknown> & { count: number }>) {
              const k = String(r.registration_number ?? r.id ?? "");
              const cur = merged.get(k);
              if (cur) cur.count += r.count;
              else merged.set(k, { row: r, count: r.count });
            }
          }
          return Array.from(merged.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((x) => ({ ...(x.row as Record<string, unknown>), count: x.count }));
        };
        s = {
          total: parts.reduce((a, p) => a + (p.total ?? 0), 0),
          today: parts.reduce((a, p) => a + (p.today ?? 0), 0),
          totalReferrals: parts.reduce((a, p) => a + (p.totalReferrals ?? 0), 0),
          partnerRegistrations: parts.reduce((a, p) => a + (p.partnerRegistrations ?? 0), 0),
          byDesignation: sumRec("byDesignation"),
          byGender: sumRec("byGender"),
          byAgeGroup: sumRec("byAgeGroup"),
          leaderboard: sumBoard("leaderboard") as Stats["leaderboard"],
          partnerLeaderboard: sumBoard("partnerLeaderboard") as Stats["partnerLeaderboard"],
        };
      }
    }



    const byDesignation: Record<string, number> = {
      "Yoga Coach": 0,
      "Yoga Trainer": 0,
      "Yoga Sadhak": 0,
      Other: 0,
      ...(s.byDesignation ?? {}),
    };
    const byGender: Record<string, number> = {
      Male: 0,
      Female: 0,
      Other: 0,
      Unspecified: 0,
      ...(s.byGender ?? {}),
    };
    const byAgeGroup: Record<string, number> = {
      "Below 18": 0,
      "18-35": 0,
      "36-50": 0,
      "Above 50": 0,
      Unspecified: 0,
      ...(s.byAgeGroup ?? {}),
    };

    return {
      ok: true as const,
      total: s.total ?? 0,
      today: s.today ?? 0,
      totalReferrals: s.totalReferrals ?? 0,
      partnerRegistrations: s.partnerRegistrations ?? 0,
      byDesignation,
      byGender,
      byAgeGroup,
      leaderboard: s.leaderboard ?? [],
      partnerLeaderboard: s.partnerLeaderboard ?? [],
    };
  });

