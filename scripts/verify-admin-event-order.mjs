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

// Dynamically import the compiled or direct sort function from built server assets
// Or test directly with the exact same logic implemented in src/lib/event-config.ts
const { getEventStartInfo, getEventEffectiveEndTimestampMs, sortAdminEventsChronological } = await (async () => {
  // We can test the function directly with real database events
  return await import("../src/lib/event-config.ts");
})();

async function runVerification() {
  console.log("==================================================");
  console.log("ADMIN DASHBOARD EVENT ORDER VERIFICATION");
  console.log("==================================================");

  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, district, event_date, event_time, venue, lifecycle_status, status, general");

  if (error || !events) {
    console.error("Failed to load events:", error);
    process.exit(1);
  }

  console.log(`Loaded ${events.length} events from production database.\n`);

  // Current real-world time: 2026-09-24T00:56:14+05:30
  const nowMs = Date.parse("2026-09-24T00:56:14+05:30");
  console.log(`Current Reference Time (Asia/Kolkata): 24 Sep 2026, 00:56:14 IST\n`);

  const sorted = sortAdminEventsChronological(events, nowMs);

  console.log("--- RESULTING EVENT ORDER (REAL DATABASE DATA) ---");
  sorted.forEach((e, idx) => {
    const sInfo = getEventStartInfo(e);
    const endMs = getEventEffectiveEndTimestampMs(e, sInfo);
    const isPast = e.lifecycle_status === "completed" || (endMs !== null && nowMs >= endMs);
    const isLive = e.lifecycle_status === "live" || (sInfo?.hasTime && nowMs >= sInfo.startMs && endMs !== null && nowMs < endMs);
    const tag = isLive ? "[IN-PROGRESS]" : isPast ? "[PAST]" : "[UPCOMING]";
    console.log(
      `${String(idx + 1).padStart(2, " ")}. ${tag.padEnd(14, " ")} ${(e.slug || "unknown").padEnd(34, " ")} Date: ${(sInfo?.dateStr || "none").padEnd(10, " ")} Start: ${sInfo?.startTimeStr || "none"}`,
    );
  });

  // Assertions
  console.log("\n--- VERIFICATION CHECKS ---");

  // 1. #1 must be Kheda (today's event, starts at 06:00)
  const first = sorted[0];
  if (first.slug === "kheda-yog-shibir") {
    console.log("  ✓ PASS: Nearest upcoming event is Kheda (2026-09-24 06:00)");
  } else {
    console.error(`  ✗ FAIL: Expected first event to be kheda-yog-shibir, got ${first.slug}`);
    process.exit(1);
  }

  // 2. #2 must be Junagadh (2026-09-26 06:00)
  const second = sorted[1];
  if (second.slug === "junagadh-yog-shibir") {
    console.log("  ✓ PASS: Second upcoming event is Junagadh (2026-09-26 06:00)");
  } else {
    console.error(`  ✗ FAIL: Expected second event to be junagadh-yog-shibir, got ${second.slug}`);
    process.exit(1);
  }

  // 3. Botad & Rajkot (27 Sep 06:00) must appear before Amreli (27 Sep 17:00)
  const botadIdx = sorted.findIndex(e => e.slug === "botad-yog-shibir");
  const rajkotIdx = sorted.findIndex(e => e.slug === "rajkot-yog-shibir");
  const amreliIdx = sorted.findIndex(e => e.slug === "amreli-yog-shibir");
  if (botadIdx < amreliIdx && rajkotIdx < amreliIdx) {
    console.log(`  ✓ PASS: Morning events (Botad #${botadIdx + 1}, Rajkot #${rajkotIdx + 1}) appear before evening event (Amreli #${amreliIdx + 1}) on 2026-09-27`);
  } else {
    console.error("  ✗ FAIL: 27 Sep time ordering incorrect");
    process.exit(1);
  }

  // 4. Completed events: Patan (22 Sep) must appear before Vadodara (20 Sep)
  const patanIdx = sorted.findIndex(e => e.slug === "patan-yog-shibir");
  const vadodaraIdx = sorted.findIndex(e => e.slug === "vadodara-yog-shibir");
  if (patanIdx < vadodaraIdx) {
    console.log(`  ✓ PASS: Most recently completed event (Patan #${patanIdx + 1}, 22 Sep) appears before older completed (Vadodara #${vadodaraIdx + 1}, 20 Sep)`);
  } else {
    console.error("  ✗ FAIL: Past events order incorrect");
    process.exit(1);
  }

  // 5. Past events must appear after all upcoming events
  const ahmsIdx = sorted.findIndex(e => e.slug === "ahmedabad-state-yog-shibir");
  if (ahmsIdx < patanIdx && ahmsIdx < vadodaraIdx) {
    console.log(`  ✓ PASS: All upcoming events (including farthest Ahmedabad #${ahmsIdx + 1}) appear before past events`);
  } else {
    console.error("  ✗ FAIL: Past events did not follow upcoming events");
    process.exit(1);
  }

  // 6. Test In-Progress Active Event (simulate 06:30 AM on 24 Sep)
  const inProgressTime = Date.parse("2026-09-24T06:30:00+05:30");
  const liveSorted = sortAdminEventsChronological(events, inProgressTime);
  if (liveSorted[0].slug === "kheda-yog-shibir") {
    console.log("  ✓ PASS: When an event is in-progress (24 Sep 06:30 AM), it is placed at the very top of the list");
  } else {
    console.error(`  ✗ FAIL: In-progress event was not at the top, got ${liveSorted[0].slug}`);
    process.exit(1);
  }

  // 7. Test Completed Transition (simulate 08:30 AM on 24 Sep after Kheda completes)
  const postKhedaTime = Date.parse("2026-09-24T08:30:00+05:30");
  const postKhedaSorted = sortAdminEventsChronological(events, postKhedaTime);
  if (postKhedaSorted[0].slug === "junagadh-yog-shibir") {
    console.log("  ✓ PASS: After Kheda completes (24 Sep 08:30 AM), Junagadh automatically becomes #1 upcoming");
  } else {
    console.error(`  ✗ FAIL: Junagadh was not #1 after Kheda completion, got ${postKhedaSorted[0].slug}`);
    process.exit(1);
  }
  const khedaPastIdx = postKhedaSorted.findIndex(e => e.slug === "kheda-yog-shibir");
  const patanPastIdx = postKhedaSorted.findIndex(e => e.slug === "patan-yog-shibir");
  if (khedaPastIdx < patanPastIdx) {
    console.log("  ✓ PASS: Newly completed Kheda appears as the most recently completed event (before Patan)");
  } else {
    console.error("  ✗ FAIL: Newly completed Kheda did not appear before Patan in past events");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runVerification().catch(console.error);
