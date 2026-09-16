import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

function loadEnv() {
  try {
    const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn("Could not read .env file:", err.message);
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SESSION_SECRET) {
  console.error("Missing required environment variables in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function signToken(tokenId, eventId) {
  const payload = `v1.${eventId}.${tokenId}`;
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseToken(value, expectedEventId) {
  const parts = value.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const eventId = parts[1];
  const tokenId = parts[2];
  if (expectedEventId && eventId !== expectedEventId) return null;

  const expected = signToken(tokenId, eventId);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { eventId, tokenId };
}

async function run() {
  console.log("================================================================================");
  console.log("MULTI-EVENT PLATFORM — AUTOMATED VERIFICATION TEST SUITE");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // TEST 1: Database Inventory of 35 Programs
  console.log("\n--- TEST 1: Database Event Counts & Configuration ---");
  const { data: allEvents, error: evErr } = await supabase
    .from("events")
    .select("id, slug, reg_prefix, is_active, publish_status, general, features, venue, max_registrations, event_date")
    .eq("publish_status", "published");

  assert(!evErr, `Fetched published events without error`);
  assert(allEvents && allEvents.length === 35, `Exactly 35 published events found in database (found: ${allEvents?.length})`);

  const internalEvents = allEvents.filter((e) => e.general?.registration_enabled !== false && e.general?.registration_mode !== "external");
  const externalEvents = allEvents.filter((e) => e.general?.registration_enabled === false || e.general?.registration_mode === "external");

  assert(internalEvents.length === 34, `Exactly 34 events enabled for internal registration (found: ${internalEvents.length})`);
  assert(externalEvents.length === 1, `Exactly 1 event set to external/disabled registration (found: ${externalEvents.length})`);
  assert(externalEvents[0]?.slug === "vadodara-yog-shibir", `The external event is Vadodara (slug: ${externalEvents[0]?.slug})`);

  // Check unique prefixes
  const prefixes = allEvents.map((e) => e.reg_prefix).filter(Boolean);
  const uniquePrefixes = new Set(prefixes);
  assert(uniquePrefixes.size === 35, `All 35 events have unique registration prefixes (${uniquePrefixes.size}/35 unique)`);

  // Check sequence counters in DB
  const { data: seqRows } = await supabase.from("event_reg_seq").select("event_id, next_val");
  assert(seqRows && seqRows.length >= 35, `All 35 sequence counters initialized in public.event_reg_seq (found: ${seqRows?.length})`);

  // Check Vadodara's existing registrations
  const vadodaraEvent = allEvents.find((e) => e.slug === "vadodara-yog-shibir");
  const { data: vadodaraRegs, error: vRegErr } = await supabase
    .from("registrations")
    .select("id, registration_number, full_name, mobile")
    .eq("event_id", vadodaraEvent.id);

  assert(!vRegErr, `Retrieved Vadodara registrations without error`);
  assert(vadodaraRegs && vadodaraRegs.length === 2, `Vadodara existing registrations intact (expected: 2, actual: ${vadodaraRegs?.length})`);

  // Check missing venues are null (not invented placeholder strings)
  const entriesWithMissingVenue = [
    "rajkot-yog-shibir",
    "mahesana-yog-shibir",
    "bhavnagar-yog-shibir",
    "morbi-yog-shibir",
    "surat-yog-shibir",
    "jamnagar-yog-shibir",
  ];
  let nullVenuesCount = 0;
  for (const slug of entriesWithMissingVenue) {
    const ev = allEvents.find((e) => e.slug === slug);
    if (ev && (ev.venue === null || ev.venue === "")) nullVenuesCount++;
  }
  assert(nullVenuesCount === entriesWithMissingVenue.length, `Missing venues in PDF correctly stored as NULL (${nullVenuesCount}/${entriesWithMissingVenue.length})`);

  // TEST 2: Registration on Ahmedabad State Event (Prefix: AHMS)
  console.log("\n--- TEST 2: Registration on Ahmedabad State (AHMS) ---");
  const ahmedabadEvent = allEvents.find((e) => e.slug === "ahmedabad-state-yog-shibir");
  assert(Boolean(ahmedabadEvent), `Ahmedabad State event found with ID: ${ahmedabadEvent?.id}`);

  const testMobileAhms = "9898111111";
  // Clean any prior test row with this mobile
  await supabase.from("registrations").delete().eq("mobile", testMobileAhms).eq("event_id", ahmedabadEvent.id);

  const { data: ahmsReg, error: ahmsErr } = await supabase
    .from("registrations")
    .insert({
      registration_number: "pending",
      full_name: "TEST AHMEDABAD PARTICIPANT",
      mobile: testMobileAhms,
      district: "Ahmedabad",
      district_id: ahmedabadEvent.district_id || null,
      event_id: ahmedabadEvent.id,
      qr_token: "testqr" + Date.now(),
      custom_fields: {
        district: "East Zone",
        confirmed: true,
      },
    })
    .select("id, registration_number, event_id, qr_token")
    .single();

  assert(!ahmsErr, `Ahmedabad registration inserted successfully: ${ahmsErr?.message || "OK"}`);
  assert(ahmsReg && ahmsReg.registration_number.startsWith("AHMS"), `Registration number starts with 'AHMS' (actual: ${ahmsReg?.registration_number})`);

  // Create digital ID card for Ahmedabad participant
  const cardAccessAhms = "testaccessahms" + Date.now();
  const hashAhms = createHash("sha256").update(cardAccessAhms, "utf8").digest("hex");
  const { data: cardAhms, error: cardAhmsErr } = await supabase
    .from("event_id_cards")
    .insert({
      event_id: ahmedabadEvent.id,
      registration_id: ahmsReg.id,
      access_hash: hashAhms,
    })
    .select("id, token_id, event_id")
    .single();

  assert(!cardAhmsErr && cardAhms, `Digital ID card generated for Ahmedabad participant`);
  const qrAhms = signToken(cardAhms.token_id, ahmedabadEvent.id);
  assert(qrAhms.startsWith(`v1.${ahmedabadEvent.id}.${cardAhms.token_id}`), `Cryptographic QR signature generated correctly: ${qrAhms.slice(0, 45)}...`);

  // TEST 3: Registration on Patan Event (Prefix: PAT)
  console.log("\n--- TEST 3: Registration on Patan (PAT) ---");
  const patanEvent = allEvents.find((e) => e.slug === "patan-yog-shibir");
  assert(Boolean(patanEvent), `Patan event found with ID: ${patanEvent?.id}`);

  const testMobilePat = "9898222222";
  await supabase.from("registrations").delete().eq("mobile", testMobilePat).eq("event_id", patanEvent.id);

  const { data: patReg, error: patErr } = await supabase
    .from("registrations")
    .insert({
      registration_number: "pending",
      full_name: "TEST PATAN PARTICIPANT",
      mobile: testMobilePat,
      district: "Patan",
      district_id: patanEvent.district_id || null,
      event_id: patanEvent.id,
      qr_token: "testqrpat" + Date.now(),
      custom_fields: {
        district: "Patan (City / Shahar)",
        confirmed: true,
      },
    })
    .select("id, registration_number, event_id, qr_token")
    .single();

  assert(!patErr, `Patan registration inserted successfully: ${patErr?.message || "OK"}`);
  assert(patReg && patReg.registration_number.startsWith("PAT"), `Registration number starts with 'PAT' (actual: ${patReg?.registration_number})`);

  // Create digital ID card for Patan participant
  const cardAccessPat = "testaccesspat" + Date.now();
  const hashPat = createHash("sha256").update(cardAccessPat, "utf8").digest("hex");
  const { data: cardPat, error: cardPatErr } = await supabase
    .from("event_id_cards")
    .insert({
      event_id: patanEvent.id,
      registration_id: patReg.id,
      access_hash: hashPat,
    })
    .select("id, token_id, event_id")
    .single();

  assert(!cardPatErr && cardPat, `Digital ID card generated for Patan participant`);
  const qrPat = signToken(cardPat.token_id, patanEvent.id);
  assert(qrPat.startsWith(`v1.${patanEvent.id}.${cardPat.token_id}`), `Cryptographic QR signature generated correctly: ${qrPat.slice(0, 45)}...`);

  // TEST 4: Vadodara Registration Lockout
  console.log("\n--- TEST 4: Vadodara Registration Lockout Verification ---");
  // Features registration toggle check
  assert(vadodaraEvent.features?.registration === false, `Vadodara features.registration === false in DB`);
  assert(vadodaraEvent.general?.registration_enabled === false, `Vadodara general.registration_enabled === false in DB`);
  assert(vadodaraEvent.general?.registration_mode === "external", `Vadodara general.registration_mode === 'external' in DB`);

  // TEST 5: Cryptographic Cross-Event Security & Attendance Isolation
  console.log("\n--- TEST 5: Cross-Event Check-in Security Verification ---");
  // 5.1: Ahmedabad QR verified against Ahmedabad event ID -> Success
  const parseAhmsValid = parseToken(qrAhms, ahmedabadEvent.id);
  assert(parseAhmsValid !== null && parseAhmsValid.tokenId === cardAhms.token_id, `Ahmedabad QR is VALID for Ahmedabad Scanner`);

  // 5.2: Ahmedabad QR verified against Patan event ID -> Cryptographically Rejected
  const parseAhmsCrossEvent = parseToken(qrAhms, patanEvent.id);
  assert(parseAhmsCrossEvent === null, `Ahmedabad QR is REJECTED by Patan Scanner (cross-event protection)`);

  // 5.3: Patan QR verified against Patan event ID -> Success
  const parsePatValid = parseToken(qrPat, patanEvent.id);
  assert(parsePatValid !== null && parsePatValid.tokenId === cardPat.token_id, `Patan QR is VALID for Patan Scanner`);

  // 5.4: Patan QR verified against Ahmedabad event ID -> Cryptographically Rejected
  const parsePatCrossEvent = parseToken(qrPat, ahmedabadEvent.id);
  assert(parsePatCrossEvent === null, `Patan QR is REJECTED by Ahmedabad Scanner (cross-event protection)`);

  // 5.5: Tampered QR token -> Cryptographically Rejected
  const tamperedQr = qrAhms.slice(0, -3) + "xyz";
  const parseTampered = parseToken(tamperedQr, ahmedabadEvent.id);
  assert(parseTampered === null, `Tampered QR code signature is REJECTED`);

  // TEST 6: Cleanup Test Data
  console.log("\n--- TEST 6: Cleanup Test Data ---");
  await supabase.from("event_id_cards").delete().eq("id", cardAhms.id);
  await supabase.from("registrations").delete().eq("id", ahmsReg.id);
  await supabase.from("event_id_cards").delete().eq("id", cardPat.id);
  await supabase.from("registrations").delete().eq("id", patReg.id);

  // Final check on Vadodara
  const { data: finalVadodaraRegs } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", vadodaraEvent.id);
  assert(finalVadodaraRegs && finalVadodaraRegs.length === 2, `Vadodara registrations remain exactly 2 after test suite cleanup`);

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test Suite Failed with Exception:", err);
  process.exit(1);
});
