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

// Authoritative 35 Program Matrix from "17 Sept Program Updated List (2).pdf"
const AUTHORITATIVE_PDF_MATRIX = [
  {
    serial: 1,
    district: "Ahmedabad",
    level: "State",
    mobiles: ["8200040178"],
    venue: "સાબરમતી રિવરફ્રન્ટ, અમદાવાદ",
    expected: 15000,
    date: "2026-09-17",
    prefix: "AHMS",
    slug: "ahmedabad-state-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 2,
    district: "Vadodara",
    level: "Municipal",
    mobiles: ["8866155977"],
    venue: null, // BLANK IN PDF
    expected: 10000,
    date: "2026-09-20",
    prefix: "VAD",
    slug: "vadodara-yog-shibir",
    registration_mode: "external",
  },
  {
    serial: 3,
    district: "Patan",
    level: "District",
    mobiles: ["9925166942"],
    venue: "રિજનલ સાયન્સ સેન્ટર અને ડાયનાસોર પાર્ક",
    expected: 5000,
    date: "2026-09-22",
    prefix: "PAT",
    slug: "patan-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 4,
    district: "Kheda",
    level: "District",
    mobiles: ["9428318619"],
    venue: "સંતરામ મંદિર નડિયાદ",
    expected: 5000,
    date: "2026-09-24",
    prefix: "KHE",
    slug: "kheda-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 5,
    district: "Junagadh",
    level: "Municipal",
    mobiles: ["9727021258"],
    venue: "શ્રી માલદેવ રાણા કેશવાલા મહેર સમાજ, ઇન્ડિયન ઓઇલ પેટ્રોલ પંપ ની સામે, વંથલી રોડ મધુરમ, જુનાગઢ",
    expected: 10000,
    date: "2026-09-26",
    prefix: "JUN",
    slug: "junagadh-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 6,
    district: "Botad",
    level: "District",
    mobiles: ["9725796203"],
    venue: "કૃષ્ણસાગર ગાર્ડન પાળીયાદ રોડ બોટાદ",
    expected: 3000,
    date: "2026-09-27",
    prefix: "BOT",
    slug: "botad-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 7,
    district: "Rajkot",
    level: "Municipal",
    mobiles: ["9712908271"],
    venue: null, // BLANK IN PDF
    expected: 10000,
    date: "2026-09-27",
    prefix: "RAJ",
    slug: "rajkot-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 8,
    district: "Mahisagar",
    level: "District",
    mobiles: ["8758283281"],
    venue: "મોડર્ન વિદ્યાલય કડાણા",
    expected: 3000,
    date: "2026-09-29",
    prefix: "MAH",
    slug: "mahisagar-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 9,
    district: "Valsad",
    level: "District",
    mobiles: ["9998213149"],
    venue: "તિથલ બીચ, વલસાડ",
    expected: 5000,
    date: "2026-09-29",
    prefix: "VAL",
    slug: "valsad-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 10,
    district: "Bharuch",
    level: "District",
    mobiles: ["9826200631", "8200607328"],
    venue: "MATARIYA TALAO, LINK ROAD BHARUCH",
    expected: 5000,
    date: "2026-09-30",
    prefix: "BHA",
    slug: "bharuch-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 11,
    district: "Dahod",
    level: "District",
    mobiles: ["9662765519", "9712291401"],
    venue: "છાબ તળાવ, દાહોદ",
    expected: 3000,
    date: "2026-09-30",
    prefix: "DAH",
    slug: "dahod-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 12,
    district: "Mehsana",
    level: "District",
    mobiles: ["9974230200"],
    venue: null, // BLANK IN PDF
    expected: 10000,
    date: "2026-10-01",
    prefix: "MSH",
    slug: "mahesana-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 13,
    district: "Chhota Udepur",
    level: "District",
    mobiles: ["8849349421"],
    venue: "સરદાર બાગ, કુસુમસાગર તળાવ સામે, છોટાઉદેપુર",
    expected: 3000,
    date: "2026-10-01",
    prefix: "CUP",
    slug: "chhotaudepur-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 14,
    district: "Bhavnagar",
    level: "Municipal",
    mobiles: ["8487997969", "8000826379"],
    venue: null, // BLANK IN PDF
    expected: 5000,
    date: "2026-10-02",
    prefix: "BHV",
    slug: "bhavnagar-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 15,
    district: "Vav-Tharad",
    level: "District",
    mobiles: ["9023121745"],
    venue: "ગાયત્રી વિદ્યાલય, થરાદ",
    expected: 3000,
    date: "2026-10-02",
    prefix: "VAV",
    slug: "vav-tharad-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 16,
    district: "Panchmahal",
    level: "District",
    mobiles: ["9409020632", "8780352540"],
    venue: "વિરાસત વન",
    expected: 5000,
    date: "2026-10-02",
    prefix: "PAN",
    slug: "panchmahal-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 17,
    district: "Navsari",
    level: "District",
    mobiles: ["9925190997"],
    venue: "દાંડી મેમોરીયલ, નવસારી",
    expected: 5000,
    date: "2026-10-02",
    prefix: "NAV",
    slug: "navsari-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 18,
    district: "Sabarkantha",
    level: "District",
    mobiles: ["9426897901"],
    venue: "સાબર ડેરી, હિંમતનગર",
    expected: 3000,
    date: "2026-10-03",
    prefix: "SAB",
    slug: "sabarkantha-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 19,
    district: "Narmada",
    level: "District",
    mobiles: ["9327709995"],
    venue: "સ્ટેચ્યુ ઓફ યુનિટી",
    expected: 5000,
    date: "2026-10-03",
    prefix: "NAR",
    slug: "narmada-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 20,
    district: "Kutch",
    level: "District",
    mobiles: ["9099881155", "9427178424"],
    venue: "સ્મૃતિ વન ભૂકંપ સંગ્રહાલય",
    expected: 5000,
    date: "2026-10-04",
    prefix: "KUT",
    slug: "kutch-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 21,
    district: "Anand",
    level: "District",
    mobiles: ["7405173739", "9106906535"],
    venue: "સરદાર સ્મૃતિ ભવન, કરમસદ",
    expected: 3000,
    date: "2026-10-04",
    prefix: "AND",
    slug: "anand-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 22,
    district: "Dang",
    level: "District",
    mobiles: ["9870099006"],
    venue: "સરકારી સાયન્સ કોલેજ, આહવા",
    expected: 3000,
    date: "2026-10-04",
    prefix: "DNG",
    slug: "dang-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 23,
    district: "Banaskantha",
    level: "District",
    mobiles: ["9023121745"],
    venue: "અંબાજી શક્તિપીઠ અને ગબ્બર તીર્થ યાત્રા",
    expected: 5000,
    date: "2026-10-05",
    prefix: "BAN",
    slug: "banaskantha-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 24,
    district: "Tapi",
    level: "District",
    mobiles: ["9909118870"],
    venue: "જિલ્લા સેવા સદન, વ્યારા",
    expected: 3000,
    date: "2026-10-06",
    prefix: "TAP",
    slug: "tapi-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 25,
    district: "Gandhinagar",
    level: "Municipal",
    mobiles: ["8200081604"],
    venue: "વિધાનસભા પરીસર",
    expected: 5000,
    date: "2026-10-06",
    prefix: "GAN",
    slug: "gandhinagar-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 26,
    district: "Gir Somnath",
    level: "District",
    mobiles: ["8866422003"],
    venue: "સોમનાથ બીચ - પ્રભાસ પાટણ, ગીર સોમનાથ જિલ્લો",
    expected: 5000,
    date: "2026-10-07",
    prefix: "GIR",
    slug: "gir-somnath-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 27,
    district: "Surendranagar",
    level: "District",
    mobiles: ["9558432402"],
    venue: "ભક્તિવન, ચોટીલા",
    expected: 3000,
    date: "2026-10-07",
    prefix: "SUR",
    slug: "surendranagar-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 28,
    district: "Porbandar",
    level: "District",
    mobiles: ["9925018393"],
    venue: "કીર્તિ મંદિર",
    expected: 5000,
    date: "2026-10-08",
    prefix: "POR",
    slug: "porbandar-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 29,
    district: "Devbhumi Dwarka",
    level: "District",
    mobiles: ["9586282527"],
    venue: "સુદર્શન બ્રીજ બેટ દ્વારકા",
    expected: 3000,
    date: "2026-10-08",
    prefix: "DWA",
    slug: "devbhumi-dwarka-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 30,
    district: "Ahmedabad",
    level: "Municipal",
    mobiles: ["8200040178"],
    venue: "અટલ બ્રિજ",
    expected: 3000,
    date: "2026-10-09",
    prefix: "AHMC",
    slug: "ahmedabad-municipal-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 31,
    district: "Morbi",
    level: "District",
    mobiles: ["9033643781"],
    venue: null, // BLANK IN PDF
    expected: 3000,
    date: "2026-10-09",
    prefix: "MOR",
    slug: "morbi-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 32,
    district: "Surat",
    level: "Municipal",
    mobiles: ["9428454604"],
    venue: null, // BLANK IN PDF
    expected: 10000,
    date: "2026-10-10",
    prefix: "SRT",
    slug: "surat-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 33,
    district: "Amreli",
    level: "District",
    mobiles: ["9033316841"],
    venue: "New Marketing Yard, Amreli",
    expected: 3000,
    date: "2026-10-10",
    prefix: "AMR",
    slug: "amreli-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 34,
    district: "Aravalli",
    level: "District",
    mobiles: ["9724452307"],
    venue: "ઓધારી તળાવ ઓધારી મંદિર પાસે મોડાસા જિલ્લો અરવલ્લી",
    expected: 3000,
    date: "2026-10-11",
    prefix: "ARV",
    slug: "aravalli-yog-shibir",
    registration_mode: "internal",
  },
  {
    serial: 35,
    district: "Jamnagar",
    level: "Municipal",
    mobiles: ["8849815510", "7874621212"],
    venue: null, // BLANK IN PDF
    expected: 5000,
    date: "2026-10-17",
    prefix: "JAM",
    slug: "jamnagar-yog-shibir",
    registration_mode: "internal",
  },
];

async function run() {
  console.log("================================================================================");
  console.log("AUTHORITATIVE PDF VERIFICATION & MULTI-EVENT TEST SUITE");
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

  // Fetch all published events from DB
  const { data: dbEvents, error: evErr } = await supabase
    .from("events")
    .select("id, slug, district, type, reg_prefix, is_active, publish_status, general, features, venue, max_registrations, event_date")
    .eq("publish_status", "published");

  if (evErr || !dbEvents) {
    console.error("Failed to query events table:", evErr?.message);
    process.exit(1);
  }

  const dbEventBySlug = new Map(dbEvents.map((e) => [e.slug, e]));

  // ---------------------------------------------------------------------------
  // REQUIREMENT 1: PDF DATA TEST = 35/35 PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("1. PDF DATA TEST (35 Row-by-Row Comparisons)");
  console.log("==================================================");

  let pdfDataMatches = 0;

  for (const expected of AUTHORITATIVE_PDF_MATRIX) {
    const ev = dbEventBySlug.get(expected.slug);
    if (!ev) {
      assert(false, `[Row ${expected.serial}] Missing event in database for slug: ${expected.slug}`);
      continue;
    }

    const general = ev.general || {};
    const features = ev.features || {};

    const normalizeDistrict = (d) => (d || "").replace(/[-_ ]/g, "").toLowerCase();
    const districtMatches = normalizeDistrict(ev.district) === normalizeDistrict(expected.district);
    const levelMatches =
      (general.level || "").toLowerCase() === expected.level.toLowerCase() ||
      (ev.type || "").toLowerCase() === expected.level.toLowerCase();
    const dateMatches = (ev.event_date || general.event_date) === expected.date;
    const countMatches = Number(ev.max_registrations || general.expected_participants) === expected.expected;
    const prefixMatches = ev.reg_prefix === expected.prefix;

    // Contact numbers comparison
    const dbMobiles = (general.contact_mobiles || [general.contact_mobile].filter(Boolean)).map((m) => String(m).trim());
    const contactMatches = expected.mobiles.every((m) =>
      dbMobiles.some((dbM) => dbM.includes(m) || m.includes(dbM)) ||
      (general.contact_mobile && general.contact_mobile.includes(m))
    );

    // Venue comparison: expected NULL must be NULL in DB
    const venueMatches = expected.venue === null
      ? (ev.venue === null || ev.venue === "")
      : (ev.venue && (ev.venue.includes(expected.venue.slice(0, 15)) || expected.venue.includes(ev.venue.slice(0, 15))));

    // Registration mode
    const regModeMatches = expected.registration_mode === "external"
      ? (general.registration_mode === "external" && general.registration_enabled === false && features.registration === false)
      : (general.registration_mode === "internal" && general.registration_enabled !== false && features.registration !== false);

    const allRowFieldsPass =
      districtMatches &&
      levelMatches &&
      dateMatches &&
      countMatches &&
      prefixMatches &&
      contactMatches &&
      venueMatches &&
      regModeMatches;

    if (allRowFieldsPass) {
      console.log(`  [PASS] Row ${expected.serial.toString().padStart(2, " ")}: ${expected.district.padEnd(16, " ")} | ${expected.level.padEnd(9, " ")} | ${expected.date} | ${expected.prefix.padEnd(4, " ")} | Count: ${expected.expected.toString().padEnd(5, " ")} | Venue: ${expected.venue ? expected.venue.slice(0, 20) + "..." : "[NULL]"} | Mode: ${expected.registration_mode}`);
      pdfDataMatches++;
    } else {
      console.error(`  [FAIL] Row ${expected.serial}: Mismatch on ${expected.slug}:`, {
        district: { expected: expected.district, actual: ev.district, pass: districtMatches },
        level: { expected: expected.level, actual: general.level, pass: levelMatches },
        date: { expected: expected.date, actual: ev.event_date, pass: dateMatches },
        expected_count: { expected: expected.expected, actual: ev.max_registrations, pass: countMatches },
        prefix: { expected: expected.prefix, actual: ev.reg_prefix, pass: prefixMatches },
        contact: { expected: expected.mobiles, actual: general.contact_mobiles, pass: contactMatches },
        venue: { expected: expected.venue, actual: ev.venue, pass: venueMatches },
        reg_mode: { expected: expected.registration_mode, actual: general.registration_mode, pass: regModeMatches },
      });
      failed++;
    }
  }

  assert(pdfDataMatches === 35, `PDF DATA TEST = ${pdfDataMatches}/35 PASS`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2: EVENT COUNT = 35/35 PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("2. EVENT COUNT");
  console.log("==================================================");
  assert(dbEvents.length === 35, `EVENT COUNT = ${dbEvents.length}/35 PASS`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 3: VADODARA PRESERVATION = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("3. VADODARA PRESERVATION");
  console.log("==================================================");
  const vadodaraEvent = dbEvents.find((e) => e.slug === "vadodara-yog-shibir");
  assert(vadodaraEvent && vadodaraEvent.id === "2caae4eb-03b7-47be-98fa-a4a145867bd2", `Vadodara preserved with canonical UUID: 2caae4eb-03b7-47be-98fa-a4a145867bd2`);

  const { data: vRegs, error: vRegErr } = await supabase
    .from("registrations")
    .select("id, registration_number, full_name, mobile")
    .eq("event_id", "2caae4eb-03b7-47be-98fa-a4a145867bd2");
  assert(!vRegErr && vRegs && vRegs.length === 2, `Vadodara existing participant registrations preserved intact (count: ${vRegs?.length})`);
  assert(vRegs?.every((r) => r.registration_number.startsWith("VAD")), `Vadodara registrations maintain authoritative VAD prefix`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 4: 34 INTERNAL + 1 EXTERNAL = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("4. 34 INTERNAL + 1 EXTERNAL REGISTRATION MODE");
  console.log("==================================================");
  const internalEvents = dbEvents.filter((e) => e.general?.registration_enabled !== false && e.general?.registration_mode !== "external");
  const externalEvents = dbEvents.filter((e) => e.general?.registration_enabled === false || e.general?.registration_mode === "external");

  assert(internalEvents.length === 34, `Exactly 34 events enabled for internal registration (${internalEvents.length}/34)`);
  assert(externalEvents.length === 1, `Exactly 1 event configured for external mode (${externalEvents.length}/1)`);
  assert(externalEvents[0]?.slug === "vadodara-yog-shibir", `The 1 external mode event is strictly Vadodara`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 5: AHMEDABAD TWO EVENT ISOLATION = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("5. AHMEDABAD TWO EVENT ISOLATION");
  console.log("==================================================");
  const ahms = dbEvents.find((e) => e.slug === "ahmedabad-state-yog-shibir");
  const ahmc = dbEvents.find((e) => e.slug === "ahmedabad-municipal-yog-shibir");

  assert(Boolean(ahms && ahmc), `Both Ahmedabad events exist as separate records`);
  assert(ahms?.id !== ahmc?.id, `Ahmedabad State and Ahmedabad Municipal have distinct database UUIDs`);
  assert(ahms?.reg_prefix === "AHMS" && ahmc?.reg_prefix === "AHMC", `Distinct registration prefixes: State = AHMS, Municipal = AHMC`);
  assert(ahms?.event_date === "2026-09-17" && ahmc?.event_date === "2026-10-09", `Distinct dates: State = 17-09-2026, Municipal = 09-10-2026`);
  assert(ahms?.venue?.includes("સાબરમતી") && ahmc?.venue?.includes("અટલ"), `Distinct venues: Riverfront vs Atal Bridge`);
  assert(Number(ahms?.max_registrations) === 15000 && Number(ahmc?.max_registrations) === 3000, `Distinct counts: 15,000 vs 3,000`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 6: MISSING VENUE VALIDATION = 6/6 PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("6. MISSING VENUE VALIDATION (Blank in PDF)");
  console.log("==================================================");
  const blankVenuesInPdf = [
    { serial: 7, slug: "rajkot-yog-shibir", name: "Rajkot" },
    { serial: 12, slug: "mahesana-yog-shibir", name: "Mahesana" },
    { serial: 14, slug: "bhavnagar-yog-shibir", name: "Bhavnagar" },
    { serial: 31, slug: "morbi-yog-shibir", name: "Morbi" },
    { serial: 32, slug: "surat-yog-shibir", name: "Surat" },
    { serial: 35, slug: "jamnagar-yog-shibir", name: "Jamnagar" },
  ];

  let missingVenuesPassCount = 0;
  for (const b of blankVenuesInPdf) {
    const ev = dbEvents.find((e) => e.slug === b.slug);
    if (ev && (ev.venue === null || ev.venue === "")) {
      missingVenuesPassCount++;
    } else {
      console.error(`  [FAIL] Missing venue event has non-null venue: ${b.slug} = "${ev?.venue}"`);
    }
  }
  assert(missingVenuesPassCount === 6, `MISSING VENUE VALIDATION = ${missingVenuesPassCount}/6 PASS`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 7: TIME NULL VALIDATION = 35/35 PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("7. TIME NULL VALIDATION (No Invented Times)");
  console.log("==================================================");
  let nullTimePassCount = 0;
  for (const ev of dbEvents) {
    const gen = ev.general || {};
    if (gen.start_time == null && gen.end_time == null) {
      nullTimePassCount++;
    }
  }
  assert(nullTimePassCount === 35, `TIME NULL VALIDATION = ${nullTimePassCount}/35 PASS`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 8: SEQUENCE VALIDATION = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("8. SEQUENCE VALIDATION");
  console.log("==================================================");
  const { data: seqRows } = await supabase.from("event_reg_seq").select("event_id, next_val");
  assert(seqRows && seqRows.length === 35, `Sequence table has exactly 35 rows for the 35 published events (found: ${seqRows?.length})`);

  const eventIds = new Set(dbEvents.map((e) => e.id));
  const orphanSeqs = seqRows.filter((s) => !eventIds.has(s.event_id));
  assert(orphanSeqs.length === 0, `No orphaned or legacy sequence counters found`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 9: REGISTRATION TEST = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("9. REGISTRATION TEST");
  console.log("==================================================");
  const testMobileAhms = "9898111111";
  await supabase.from("registrations").delete().eq("mobile", testMobileAhms).eq("event_id", ahms.id);

  const { data: regAhms, error: regAhmsErr } = await supabase
    .from("registrations")
    .insert({
      registration_number: "pending",
      full_name: "TEST AHMEDABAD PARTICIPANT",
      mobile: testMobileAhms,
      district: "Ahmedabad",
      district_id: ahms.district_id || null,
      event_id: ahms.id,
      qr_token: "testqrahms" + Date.now(),
      custom_fields: {
        district: "East Zone",
        confirmed: true,
      },
    })
    .select("id, registration_number, event_id, qr_token")
    .single();

  assert(!regAhmsErr && regAhms, `Registration record successfully created: ${regAhms?.registration_number}`);
  assert(regAhms?.registration_number.startsWith("AHMS"), `Registration number assigned prefix AHMS correctly`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 10: ID CARD TEST = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("10. ID CARD TEST");
  console.log("==================================================");
  const cardAccessKey = "testkey" + Date.now();
  const cardHash = createHash("sha256").update(cardAccessKey, "utf8").digest("hex");
  const { data: idCard, error: cardErr } = await supabase
    .from("event_id_cards")
    .insert({
      event_id: ahms.id,
      registration_id: regAhms.id,
      access_hash: cardHash,
    })
    .select("id, token_id, event_id")
    .single();

  assert(!cardErr && idCard, `Digital ID card issued with token_id: ${idCard?.token_id}`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 11: QR SECURITY = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("11. QR SECURITY");
  console.log("==================================================");
  const signedQr = signToken(idCard.token_id, ahms.id);
  assert(signedQr.startsWith(`v1.${ahms.id}.${idCard.token_id}.`), `Signed QR token matches format v1.<EVENT_ID>.<TOKEN_ID>.<SIG>`);

  const parsedValid = parseToken(signedQr, ahms.id);
  assert(parsedValid !== null && parsedValid.tokenId === idCard.token_id, `Valid QR token passes cryptographic verification`);

  const tamperedQr = signedQr.slice(0, -4) + "AAAA";
  const parsedTampered = parseToken(tamperedQr, ahms.id);
  assert(parsedTampered === null, `Tampered QR token is rejected by cryptographic HMAC check`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 12: CROSS-EVENT SECURITY = PASS
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("12. CROSS-EVENT SECURITY");
  console.log("==================================================");
  const patanEvent = dbEvents.find((e) => e.slug === "patan-yog-shibir");
  const parsedCross = parseToken(signedQr, patanEvent.id);
  assert(parsedCross === null, `Ahmedabad ID card QR is cryptographically rejected by Patan Scanner`);

  // Clean up test registration
  await supabase.from("event_id_cards").delete().eq("id", idCard.id);
  await supabase.from("registrations").delete().eq("id", regAhms.id);

  console.log("\n================================================================================");
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test Suite Failed with Exception:", err);
  process.exit(1);
});
