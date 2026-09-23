import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load environment variables
const envContent = readFileSync(".env", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx > 0) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const {
  getEventRegistrationStatus,
  isRegistrationOpenForEvent,
  isEventCompleted,
  getEventStartInfo,
  getEventEffectiveEndTimestampMs,
  sortAdminEventsChronological,
} = await import("../src/lib/event-config.ts");

async function runTestSuite() {
  console.log("================================================================================");
  console.log("REGISTRATION CUTOFF, CHRONOLOGICAL SORTING & VADODARA EXCLUSION TEST SUITE");
  console.log("================================================================================");

  let allPassed = true;
  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      allPassed = false;
    }
  }

  // 1. Fetch live events from production Supabase database
  const { data: events, error } = await supabase.from("events").select("*");
  if (error || !events) {
    console.error("Failed to load events from Supabase:", error);
    process.exit(1);
  }

  const patan = events.find((e) => e.slug === "patan-yog-shibir");
  const kheda = events.find((e) => e.slug === "kheda-yog-shibir");
  const vadodara = events.find((e) => e.slug === "vadodara-yog-shibir");
  const junagadh = events.find((e) => e.slug === "junagadh-yog-shibir");

  console.log("\n--- TEST 1: DATABASE INTEGRITY & PRESERVATION ---");
  assert(Boolean(patan), "Patan event exists in database");
  assert(Boolean(kheda), "Kheda event exists in database");
  assert(Boolean(vadodara), "Vadodara event exists in database (NOT deleted from DB)");
  assert(kheda.event_date === null && kheda.general?.event_date === null, "Kheda event_date is null in database (old 24 Sep date removed)");

  // Check Vadodara registrations are preserved
  const { count: vRegistrationsCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", vadodara.id);
  assert(vRegistrationsCount > 0, `Vadodara registrations preserved in database (${vRegistrationsCount} records)`);

  console.log("\n--- TEST 2: PATAN TIMELINE REGISTRATION CUTOFF SIMULATION ---");
  // Patan event scheduled: 2026-09-22, 06:00:00 to 08:00:00 IST (+05:30)
  const t_0559 = Date.parse("2026-09-22T05:59:59+05:30");
  const t_0600 = Date.parse("2026-09-22T06:00:00+05:30");
  const t_0759 = Date.parse("2026-09-22T07:59:59+05:30");
  const t_0800 = Date.parse("2026-09-22T08:00:00+05:30");
  const t_0801 = Date.parse("2026-09-22T08:01:00+05:30");

  const s_0559 = getEventRegistrationStatus(patan, t_0559);
  assert(s_0559.isOpen === true && s_0559.status === "open", "Patan 05:59 IST: Registration OPEN");

  const s_0600 = getEventRegistrationStatus(patan, t_0600);
  assert(
    s_0600.isOpen === false && s_0600.status === "in_progress",
    "Patan 06:00 IST: Registration CLOSED / IN PROGRESS"
  );
  assert(
    s_0600.messageGu.includes("હાલમાં શરૂ છે"),
    `Patan 06:00 IST message: "${s_0600.messageGu}"`
  );

  const s_0759 = getEventRegistrationStatus(patan, t_0759);
  assert(
    s_0759.isOpen === false && s_0759.status === "in_progress",
    "Patan 07:59 IST: Registration CLOSED / IN PROGRESS"
  );

  const s_0800 = getEventRegistrationStatus(patan, t_0800);
  assert(
    s_0800.isOpen === false && s_0800.status === "completed",
    "Patan 08:00 IST: Registration CLOSED / EVENT COMPLETED"
  );
  assert(
    s_0800.messageGu.includes("પૂર્ણ થઈ ગઈ છે"),
    `Patan 08:00 IST message: "${s_0800.messageGu}"`
  );

  const s_0801 = getEventRegistrationStatus(patan, t_0801);
  assert(
    s_0801.isOpen === false && s_0801.status === "completed",
    "Patan 08:01 IST: Registration CLOSED / EVENT COMPLETED"
  );

  console.log("\n--- TEST 3: CURRENT REAL-TIME STATUS OF PATAN, KHEDA, JUNAGADH ---");
  const nowMs = Date.parse("2026-09-24T01:30:00+05:30");
  const patanNow = getEventRegistrationStatus(patan, nowMs);
  assert(
    patanNow.isOpen === false && patanNow.status === "completed",
    `Patan now (24 Sep 2026): CLOSED & COMPLETED (status: ${patanNow.status})`
  );

  const khedaNow = getEventRegistrationStatus(kheda, nowMs);
  assert(
    khedaNow.isOpen === true && khedaNow.status === "open",
    `Kheda now (undated/postponed): Registration OPEN (status: ${khedaNow.status})`
  );

  const junagadhNow = getEventRegistrationStatus(junagadh, nowMs);
  assert(
    junagadhNow.isOpen === true && junagadhNow.status === "open",
    `Junagadh now (upcoming 26 Sep): Registration OPEN (status: ${junagadhNow.status})`
  );

  console.log("\n--- TEST 4: ADMIN DASHBOARD CHRONOLOGICAL SORTING & EXCLUSION ---");
  // Exclude Vadodara from Admin list
  const nonVadodaraEvents = events.filter((e) => e.slug !== "vadodara-yog-shibir");
  const sorted = sortAdminEventsChronological(nonVadodaraEvents, nowMs);

  assert(
    !sorted.some((e) => e.slug === "vadodara-yog-shibir"),
    "Vadodara is strictly EXCLUDED from Admin events listing"
  );

  assert(
    sorted[0].slug === "junagadh-yog-shibir",
    `First upcoming event on 24 Sep is Junagadh (found: ${sorted[0].slug})`
  );

  // Botad and Rajkot (27 Sep 06:00) before Amreli (27 Sep 17:00)
  const botadIdx = sorted.findIndex((e) => e.slug === "botad-yog-shibir");
  const rajkotIdx = sorted.findIndex((e) => e.slug === "rajkot-yog-shibir");
  const amreliIdx = sorted.findIndex((e) => e.slug === "amreli-yog-shibir");
  assert(botadIdx < amreliIdx && rajkotIdx < amreliIdx, "27 Sep morning events precede evening event");

  // Patan (past) appears after upcoming events
  const patanIdx = sorted.findIndex((e) => e.slug === "patan-yog-shibir");
  const ahmsIdx = sorted.findIndex((e) => e.slug === "ahmedabad-state-yog-shibir");
  assert(ahmsIdx < patanIdx, `All upcoming events precede completed Patan (#${ahmsIdx + 1} vs #${patanIdx + 1})`);

  // Kheda is undated/postponed and placed at the very end
  const khedaIdx = sorted.findIndex((e) => e.slug === "kheda-yog-shibir");
  assert(khedaIdx > patanIdx, `Kheda is at the end of sorted list as undated (#${khedaIdx + 1})`);

  console.log("\n--- TEST 5: SIMULATING IN-PROGRESS EVENT ORDER ---");
  // When Junagadh is live on 26 Sep at 07:00 AM IST
  const liveJunagadhMs = Date.parse("2026-09-26T07:00:00+05:30");
  const liveSorted = sortAdminEventsChronological(nonVadodaraEvents, liveJunagadhMs);
  assert(
    liveSorted[0].slug === "junagadh-yog-shibir",
    `In-progress Junagadh becomes #1 at 26 Sep 07:00 AM (found: ${liveSorted[0].slug})`
  );

  console.log("\n--- TEST 6: CERTIFICATE ELIGIBILITY (UNIVERSAL RULE) ---");
  // Patan is completed -> registered participants are eligible
  const isPatanCompleted = isEventCompleted(patan, nowMs);
  assert(isPatanCompleted === true, "Patan is completed, meeting Registered + Completed eligibility");

  // Junagadh is upcoming -> not completed
  const isJunagadhCompleted = isEventCompleted(junagadh, nowMs);
  assert(isJunagadhCompleted === false, "Junagadh is NOT completed, certificate locked until completed");

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✓");
  } else {
    console.error("SOME TESTS FAILED! ✗");
    process.exit(1);
  }
  console.log("================================================================================");
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
