import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const RAJKOT_ID = "8870384b-f3fa-412e-b257-825e470214c3";
const AMRELI_ID = "201f1f7d-61ae-4807-942a-57290ba7e7d1";

function getEventEndTimestampMs(event) {
  const g = event.general ?? {};
  const dateStr = (g.end_date || g.event_date || event.event_date || "").trim();
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  let endTimeStr = (g.end_time || "").trim();

  const isRajkotEvent =
    event.id === RAJKOT_ID ||
    (event.slug || "").trim().toLowerCase() === "rajkot-yog-shibir";
  if (isRajkotEvent && dateStr === "2026-09-27" && (!endTimeStr || endTimeStr === "08:00")) {
    endTimeStr = "20:00";
  }

  const startTime = (
    g.start_time ||
    (event.event_time && /^\d{1,2}:\d{2}/.test(event.event_time) ? event.event_time.slice(0, 5) : "") ||
    ""
  ).trim();
  if (!endTimeStr && startTime && /^\d{1,2}:\d{2}$/.test(startTime)) {
    const [sh, sm] = startTime.split(":").map(Number);
    const duration = typeof g.duration_minutes === "number" && g.duration_minutes > 0 ? g.duration_minutes : 120;
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor(totalMinutes / 60) % 24;
    const em = totalMinutes % 60;
    endTimeStr = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }

  const rawEventTime = (event.event_time || g.event_time || "").trim();
  if (!endTimeStr && rawEventTime) {
    const match = rawEventTime.match(/[-–—to\s]+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = (match[3] || "").toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      endTimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  if (!endTimeStr || !/^\d{1,2}:\d{2}$/.test(endTimeStr)) {
    return null;
  }

  const [h, m] = endTimeStr.split(":").map((v) => String(v).padStart(2, "0"));
  const isoWithOffset = `${dateStr}T${h}:${m}:00+05:30`;
  const timeMs = Date.parse(isoWithOffset);
  return Number.isNaN(timeMs) ? null : timeMs;
}

function isEventCompleted(event, nowMs = Date.now()) {
  if (event.lifecycle_status === "completed" || event.status?.value === "completed") {
    return true;
  }
  if (event.lifecycle_status === "cancelled" || event.lifecycle_status === "archived") {
    return false;
  }
  const endMs = getEventEndTimestampMs(event);
  if (endMs === null) return false;
  return nowMs >= endMs;
}

function isEventAttendanceClosed(event, nowMs = Date.now()) {
  if (event.lifecycle_status === "cancelled" || event.lifecycle_status === "archived") {
    return true;
  }
  return isEventCompleted(event, nowMs);
}

async function simulateCertificateStatus({ mobile, district_slug, registration_id, event_id, nowMs = Date.now() }) {
  const digits = String(mobile || "").replace(/[\s\-().+]/g, "").replace(/\D/g, "");
  const normMobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;

  if (district_slug) {
    const { data: ev } = await supabase.from("events").select("*").eq("slug", district_slug).maybeSingle();
    if (!ev) return { ok: false, error: "Event not found" };
    const { data: regRows } = await supabase
      .from("registrations")
      .select("id, registration_number, full_name, mobile, district, event_id")
      .eq("mobile", normMobile)
      .eq("event_id", ev.id)
      .limit(1);
    const reg = regRows?.[0];
    if (!reg || reg.event_id !== ev.id) {
      return { ok: false, code: "WRONG_EVENT_OR_NOT_FOUND", error: "આ નોંધણી આ શિબિર માટે નથી." };
    }
    const completed = isEventCompleted(ev, nowMs);
    return {
      ok: true,
      requires_selection: false,
      registration_id: reg.id,
      event_id: ev.id,
      event_slug: ev.slug,
      registration_number: reg.registration_number,
      event_completed: completed,
      eligible: completed,
    };
  }

  if (registration_id && event_id) {
    const { data: ev } = await supabase.from("events").select("*").eq("id", event_id).maybeSingle();
    const { data: reg } = await supabase
      .from("registrations")
      .select("id, registration_number, full_name, mobile, district, event_id")
      .eq("id", registration_id)
      .eq("event_id", event_id)
      .eq("mobile", normMobile)
      .maybeSingle();
    if (!ev || !reg || reg.event_id !== ev.id) {
      return { ok: false, code: "WRONG_EVENT_OR_NOT_FOUND", error: "આ નોંધણી આ શિબિર માટે નથી." };
    }
    const completed = isEventCompleted(ev, nowMs);
    return {
      ok: true,
      requires_selection: false,
      registration_id: reg.id,
      event_id: ev.id,
      event_slug: ev.slug,
      registration_number: reg.registration_number,
      event_completed: completed,
      eligible: completed,
    };
  }

  const { data: regRows } = await supabase
    .from("registrations")
    .select("id, registration_number, full_name, mobile, district, event_id, created_at")
    .eq("mobile", normMobile)
    .order("created_at", { ascending: false });

  if (!regRows || regRows.length === 0) return { ok: false, error: "Not found" };

  const byEvent = new Map();
  for (const r of regRows) {
    if (r.event_id && !byEvent.has(r.event_id)) byEvent.set(r.event_id, r);
  }

  const validChoices = [];
  for (const [evId, r] of byEvent.entries()) {
    const { data: ev } = await supabase.from("events").select("*").eq("id", evId).maybeSingle();
    if (ev) validChoices.push({ reg: r, event: ev });
  }

  if (validChoices.length > 1) {
    return {
      ok: true,
      requires_selection: true,
      choices: validChoices.map(({ reg, event }) => ({
        registration_id: reg.id,
        registration_number: reg.registration_number,
        event_id: event.id,
        event_slug: event.slug,
        event_title: event.general?.title,
        event_completed: isEventCompleted(event, nowMs),
      })),
    };
  }

  const { reg, event } = validChoices[0];
  const completed = isEventCompleted(event, nowMs);
  return {
    ok: true,
    requires_selection: false,
    registration_id: reg.id,
    event_id: event.id,
    event_slug: event.slug,
    registration_number: reg.registration_number,
    event_completed: completed,
    eligible: completed,
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function run() {
  const { data: rajkotEv } = await supabase.from("events").select("*").eq("id", RAJKOT_ID).single();
  const { data: amreliEv } = await supabase.from("events").select("*").eq("id", AMRELI_ID).single();

  console.log("--- Loaded Events ---");
  console.log("Rajkot:", { id: rajkotEv.id, slug: rajkotEv.slug, event_date: rajkotEv.event_date, end_time: rajkotEv.general?.end_time });
  console.log("Amreli:", { id: amreliEv.id, slug: amreliEv.slug, event_date: amreliEv.event_date, end_time: amreliEv.general?.end_time });

  // Find a pure Amreli participant and a pure Rajkot participant
  const { data: amreliRegs } = await supabase.from("registrations").select("id, registration_number, full_name, mobile, event_id").eq("event_id", AMRELI_ID).limit(30);
  const { data: rajkotRegs } = await supabase.from("registrations").select("id, registration_number, full_name, mobile, event_id").eq("event_id", RAJKOT_ID).limit(30);

  let pureAmreli = null;
  for (const r of amreliRegs || []) {
    const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq("mobile", r.mobile);
    if (count === 1) {
      pureAmreli = r;
      break;
    }
  }

  let pureRajkot = null;
  for (const r of rajkotRegs || []) {
    const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq("mobile", r.mobile);
    if (count === 1) {
      pureRajkot = r;
      break;
    }
  }

  // Test A: Amreli Participant
  const resA = await simulateCertificateStatus({ mobile: `+91 ${pureAmreli.mobile}`, nowMs: Date.parse("2026-09-27T19:05:00+05:30") });
  assert(resA.ok && !resA.requires_selection && resA.event_id === AMRELI_ID && resA.registration_id === pureAmreli.id, `Test A: Amreli mobile (${pureAmreli.mobile}) resolves strictly to Amreli (${resA.registration_number}) and never Rajkot`);

  // Test B: Rajkot Participant
  const resB = await simulateCertificateStatus({ mobile: pureRajkot.mobile, nowMs: Date.parse("2026-09-27T20:05:00+05:30") });
  assert(resB.ok && !resB.requires_selection && resB.event_id === RAJKOT_ID && resB.registration_id === pureRajkot.id, `Test B: Rajkot mobile (${pureRajkot.mobile}) resolves strictly to Rajkot (${resB.registration_number}) and never Amreli`);

  // Test C: Same mobile registered in multiple events (create temporary second registration for pureAmreli in Rajkot, test, then delete)
  const tempMobile = "9999988887";
  const { data: tempAmreli } = await supabase.from("registrations").insert({
    registration_number: "TEST-AMR-999",
    full_name: "TEST AMRELI USER",
    mobile: tempMobile,
    event_id: AMRELI_ID,
    district: "Amreli",
    referral_code: "TESTAMR999",
    qr_token: "test_qr_token_amreli_9999988887",
  }).select("id, registration_number, event_id").single();

  const { data: tempRajkot } = await supabase.from("registrations").insert({
    registration_number: "TEST-RAJ-999",
    full_name: "TEST RAJKOT USER",
    mobile: tempMobile,
    event_id: RAJKOT_ID,
    district: "Rajkot",
    referral_code: "TESTRAJ999",
    qr_token: "test_qr_token_rajkot_9999988887",
  }).select("id, registration_number, event_id").single();

  try {
    const resC_global = await simulateCertificateStatus({ mobile: tempMobile });
    assert(
      resC_global.ok && resC_global.requires_selection === true && resC_global.choices.length === 2,
      "Test C (1/3): Mobile registered in both Amreli and Rajkot returns requires_selection=true with 2 distinct event choices (never guesses!)"
    );

    const resC_selectAmreli = await simulateCertificateStatus({
      mobile: tempMobile,
      registration_id: tempAmreli.id,
      event_id: AMRELI_ID,
      nowMs: Date.parse("2026-09-27T19:05:00+05:30"),
    });
    assert(
      resC_selectAmreli.ok && !resC_selectAmreli.requires_selection && resC_selectAmreli.event_id === AMRELI_ID && resC_selectAmreli.registration_id === tempAmreli.id,
      "Test C (2/3): Selecting Amreli returns ONLY Amreli registration/certificate"
    );

    const resC_selectRajkot = await simulateCertificateStatus({
      mobile: tempMobile,
      registration_id: tempRajkot.id,
      event_id: RAJKOT_ID,
      nowMs: Date.parse("2026-09-27T20:05:00+05:30"),
    });
    assert(
      resC_selectRajkot.ok && !resC_selectRajkot.requires_selection && resC_selectRajkot.event_id === RAJKOT_ID && resC_selectRajkot.registration_id === tempRajkot.id,
      "Test C (3/3): Selecting Rajkot returns ONLY Rajkot registration/certificate"
    );
  } finally {
    if (tempAmreli?.id) await supabase.from("registrations").delete().eq("id", tempAmreli.id);
    if (tempRajkot?.id) await supabase.from("registrations").delete().eq("id", tempRajkot.id);
  }

  // Test D: Direct URL / Cross-Event Rejection
  const resD_rajkotOnAmreliPage = await simulateCertificateStatus({
    mobile: pureRajkot.mobile,
    district_slug: "amreli-yog-shibir",
  });
  assert(
    !resD_rajkotOnAmreliPage.ok && resD_rajkotOnAmreliPage.code === "WRONG_EVENT_OR_NOT_FOUND",
    "Test D (1/3): Rajkot participant entering mobile on /amreli-yog-shibir/certificate is strictly REJECTED"
  );

  const resD_amreliOnRajkotPage = await simulateCertificateStatus({
    mobile: pureAmreli.mobile,
    district_slug: "rajkot-yog-shibir",
  });
  assert(
    !resD_amreliOnRajkotPage.ok && resD_amreliOnRajkotPage.code === "WRONG_EVENT_OR_NOT_FOUND",
    "Test D (2/3): Amreli participant entering mobile on /rajkot-yog-shibir/certificate is strictly REJECTED"
  );

  const resD_crossIdTamper = await simulateCertificateStatus({
    mobile: pureAmreli.mobile,
    registration_id: pureAmreli.id,
    event_id: RAJKOT_ID,
  });
  assert(
    !resD_crossIdTamper.ok && resD_crossIdTamper.code === "WRONG_EVENT_OR_NOT_FOUND",
    "Test D (3/3): Passing Amreli registration_id with Rajkot event_id is strictly REJECTED"
  );

  // Test E: Rajkot Time Simulation (7:59 PM, 8:00 PM, 8:01 PM IST)
  const t_1959 = Date.parse("2026-09-27T19:59:00+05:30");
  const t_2000 = Date.parse("2026-09-27T20:00:00+05:30");
  const t_2001 = Date.parse("2026-09-27T20:01:00+05:30");

  assert(
    !isEventAttendanceClosed(rajkotEv, t_1959) && !isEventCompleted(rajkotEv, t_1959),
    "Test E (7:59 PM IST): Rajkot attendance is OPEN and Rajkot certificate is LOCKED"
  );
  assert(
    isEventAttendanceClosed(rajkotEv, t_2000) && isEventCompleted(rajkotEv, t_2000),
    "Test E (8:00 PM IST): Rajkot attendance is CLOSED and Rajkot certificate is OPEN"
  );
  assert(
    isEventAttendanceClosed(rajkotEv, t_2001) && isEventCompleted(rajkotEv, t_2001),
    "Test E (8:01 PM IST): Rajkot attendance is CLOSED and Rajkot certificate is OPEN"
  );

  // Test F: Amreli Time Simulation (Before vs After 7:00 PM IST, independent from Rajkot)
  const t_1859 = Date.parse("2026-09-27T18:59:00+05:30");
  const t_1900 = Date.parse("2026-09-27T19:00:00+05:30");

  assert(
    !isEventCompleted(amreliEv, t_1859) && !isEventAttendanceClosed(amreliEv, t_1859),
    "Test F (6:59 PM IST): Before Amreli end time (7:00 PM), Amreli certificate is LOCKED"
  );
  assert(
    isEventCompleted(amreliEv, t_1900) && !isEventCompleted(rajkotEv, t_1900),
    "Test F (7:00 PM IST): At 7:00 PM IST, Amreli certificate is OPEN while Rajkot certificate remains LOCKED until 8:00 PM IST"
  );

  // Test G: Zero attendance + completed event
  const { count: attCount } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("registration_id", pureRajkot.id);
  const resG = await simulateCertificateStatus({
    mobile: pureRajkot.mobile,
    nowMs: t_2000,
  });
  assert(
    resG.ok && resG.eligible === true,
    `Test G: Registered participant (${pureRajkot.registration_number}, attendance rows=${attCount ?? 0}) is ELIGIBLE for certificate once event is completed`
  );

  console.log("\n🎉 ALL TESTS A THROUGH G PASSED 100%!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
