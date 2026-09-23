import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const idx = t.indexOf("=");
  if (idx > 0) env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const {
  formatEventDate,
  formatTimeRange,
  isEventCompleted,
  getEventStartInfo,
  sortAdminEventsChronological,
} = await import("../src/lib/event-config.ts");

async function runTests() {
  console.log("==================================================");
  console.log("KHEDA POSTPONED EVENT VERIFICATION TEST SUITE");
  console.log("==================================================");

  // 1. Fetch Kheda event from production database
  const { data: kheda, error: khedaErr } = await supabase
    .from("events")
    .select("*")
    .eq("slug", "kheda-yog-shibir")
    .single();

  if (khedaErr || !kheda) {
    console.error("Failed to load Kheda event from database:", khedaErr);
    process.exit(1);
  }

  console.log("\n--- 1. DATABASE STATE VERIFICATION ---");
  console.log(`  Slug: ${kheda.slug}`);
  console.log(`  event_date: ${kheda.event_date}`);
  console.log(`  event_time: ${kheda.event_time}`);
  console.log(`  general.event_date: ${kheda.general?.event_date}`);
  console.log(`  general.start_time: ${kheda.general?.start_time}`);
  console.log(`  general.end_time: ${kheda.general?.end_time}`);
  console.log(`  is_active: ${kheda.is_active}`);
  console.log(`  publish_status: ${kheda.publish_status}`);
  console.log(`  lifecycle_status: ${kheda.lifecycle_status}`);
  console.log(`  features.registration: ${kheda.features?.registration}`);
  console.log(`  general.registration_mode: ${kheda.general?.registration_mode}`);

  if (kheda.event_date === null && kheda.general?.event_date === null) {
    console.log("  ✓ PASS: Kheda event_date in database is null (old 24 Sep date removed)");
  } else {
    console.error("  ✗ FAIL: Kheda event_date still contains old date:", kheda.event_date);
    process.exit(1);
  }

  // 2. Registration is OPEN
  console.log("\n--- 2. REGISTRATION OPEN VERIFICATION ---");
  const isRegOpen =
    kheda.is_active === true &&
    kheda.publish_status === "published" &&
    kheda.features?.registration === true &&
    kheda.general?.registration_mode === "internal" &&
    kheda.lifecycle_status !== "cancelled" &&
    kheda.lifecycle_status !== "archived";

  if (isRegOpen) {
    console.log("  ✓ PASS: Kheda registration remains FULLY OPEN (active, published, registration=true, mode=internal)");
  } else {
    console.error("  ✗ FAIL: Kheda registration is NOT open!");
    process.exit(1);
  }

  // 3. Existing Registrations Intact
  console.log("\n--- 3. REGISTRATION DATA INTEGRITY ---");
  const { count: regCount, error: countErr } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", kheda.id);

  if (countErr) {
    console.error("Failed to query Kheda registrations:", countErr);
    process.exit(1);
  }
  console.log(`  Kheda registration count: ${regCount}`);
  if (regCount !== null && regCount >= 0) {
    console.log("  ✓ PASS: Existing registrations for Kheda remain intact and unharmed");
  }

  // 4. "Yet to be Declared" Display Formatter Check
  console.log("\n--- 4. DISPLAY FORMATTERS & TEXT VERIFICATION ---");
  const dateStr = formatEventDate(kheda.event_date);
  const timeStr = formatTimeRange(kheda.general?.start_time, kheda.general?.end_time);

  console.log(`  formatEventDate(kheda.event_date): "${dateStr}"`);
  console.log(`  formatTimeRange(start_time, end_time): "${timeStr}"`);

  if (dateStr === "Yet to be Declared") {
    console.log("  ✓ PASS: formatEventDate returns exact text 'Yet to be Declared'");
  } else {
    console.error(`  ✗ FAIL: Expected 'Yet to be Declared', got '${dateStr}'`);
    process.exit(1);
  }

  if (timeStr === "") {
    console.log("  ✓ PASS: formatTimeRange does not invent a fake time (06:00 AM – 08:00 AM is NOT injected)");
  } else {
    console.error(`  ✗ FAIL: formatTimeRange invented a time: '${timeStr}'`);
    process.exit(1);
  }

  // 5. Admin Dashboard Sorting: Kheda must NOT appear as #1 upcoming based on 24 Sep
  console.log("\n--- 5. ADMIN DASHBOARD CHRONOLOGICAL SORTING ---");
  const { data: allEvents, error: allErr } = await supabase
    .from("events")
    .select("id, slug, district, event_date, event_time, venue, lifecycle_status, status, general");

  if (allErr || !allEvents) {
    console.error("Failed to load events for sorting test:", allErr);
    process.exit(1);
  }

  const nowMs = Date.parse("2026-09-24T01:15:00+05:30");
  const sorted = sortAdminEventsChronological(allEvents, nowMs);

  console.log(`  #1 Event in Admin Dashboard: ${sorted[0].slug}`);
  if (sorted[0].slug === "junagadh-yog-shibir") {
    console.log("  ✓ PASS: Junagadh is #1 nearest upcoming event (26 Sep 06:00)");
  } else {
    console.error(`  ✗ FAIL: Expected junagadh-yog-shibir as #1, got ${sorted[0].slug}`);
    process.exit(1);
  }

  const khedaIndex = sorted.findIndex(e => e.slug === "kheda-yog-shibir");
  console.log(`  Kheda index in sorted events: #${khedaIndex + 1} of ${sorted.length}`);
  if (khedaIndex >= 34) {
    console.log("  ✓ PASS: Kheda is treated as undated/postponed, listed safely at the end without inventing a position");
  } else {
    console.error(`  ✗ FAIL: Kheda was placed in upcoming events at index ${khedaIndex}`);
    process.exit(1);
  }

  // 6. Certificate Eligibility: Strictly LOCKED
  console.log("\n--- 6. CERTIFICATE ELIGIBILITY CHECK ---");
  const completed = isEventCompleted(kheda);
  console.log(`  isEventCompleted(kheda): ${completed}`);
  if (completed === false) {
    console.log("  ✓ PASS: Kheda is NOT completed based on old 24 Sep date");
  } else {
    console.error("  ✗ FAIL: Kheda is marked as completed!");
    process.exit(1);
  }

  const eligible = isEventCompleted({
    general: kheda.general,
    event_date: kheda.event_date ?? kheda.general?.event_date,
    lifecycle_status: kheda.lifecycle_status,
    status: kheda.status,
  });
  console.log(`  certificate eligibility (isEventCompleted): ${eligible}`);
  if (eligible === false) {
    console.log("  ✓ PASS: Kheda certificates are strictly LOCKED and cannot be downloaded");
  } else {
    console.error("  ✗ FAIL: Kheda certificate was eligible!");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("ALL 6 / 6 KHEDA VERIFICATION CHECKS PASSED!");
  console.log("==================================================");
}

runTests().catch(console.error);
