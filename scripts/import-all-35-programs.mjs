import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load environment variables from .env
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const VADODARA_EXISTING_ID = "2caae4eb-03b7-47be-98fa-a4a145867bd2";

// Authoritative 35 Programs from PDF "17 Sept Program Updated List (2).pdf"
const PROGRAMS_MASTER = [
  {
    serial: 1,
    district_name: "Ahmedabad",
    level: "State",
    mobiles: ["8200040178"],
    venue: "સાબરમતી રિવરફ્રન્ટ, અમદાવાદ",
    expected: 15000,
    date: "2026-09-17",
    prefix: "AHMS",
    slug: "ahmedabad-state-yog-shibir",
    title_gu: "અમદાવાદ રાજ્ય કક્ષા યોગ શિબિર",
    title_en: "Ahmedabad State Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
    area_options: ["East Zone", "West Zone", "Central Zone", "North Zone", "South Zone"],
  },
  {
    serial: 2,
    district_name: "Vadodara",
    level: "Municipal",
    mobiles: ["8866155977"],
    venue: "Railway Police Parade Ground, Kothi Kacheri Char Rasta, Behind Kothi Kacheri, Vadodara, Gujarat",
    expected: 10000,
    date: "2026-09-20",
    prefix: "VAD",
    slug: "vadodara-yog-shibir",
    title_gu: "વડોદરા મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Vadodara Yog Shibir",
    reg_enabled: false,
    reg_mode: "external",
    id: VADODARA_EXISTING_ID,
    area_options: ["VADODARA EAST", "VADODARA WEST", "VADODARA RURAL"],
  },
  {
    serial: 3,
    district_name: "Patan",
    level: "District",
    mobiles: ["9925166942"],
    venue: "રિજનલ સાયન્સ સેન્ટર અને ડાયનાસોર પાર્ક",
    expected: 5000,
    date: "2026-09-22",
    prefix: "PAT",
    slug: "patan-yog-shibir",
    title_gu: "પાટણ જિલ્લો યોગ શિબિર",
    title_en: "Patan Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 4,
    district_name: "Kheda",
    level: "District",
    mobiles: ["9428318619"],
    venue: "સંતરામ મંદિર નડિયાદ",
    expected: 5000,
    date: "2026-09-24",
    prefix: "KHE",
    slug: "kheda-yog-shibir",
    title_gu: "ખેડા જિલ્લો યોગ શિબિર",
    title_en: "Kheda Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 5,
    district_name: "Junagadh",
    level: "Municipal",
    mobiles: ["9727021258"],
    venue: "શ્રી માલદેવ રાણા કેશવાલા મહેર સમાજ, ઇન્ડિયન ઓઇલ પેટ્રોલ પંપ ની સામે, વંથલી રોડ મધુરમ, જુનાગઢ",
    expected: 10000,
    date: "2026-09-26",
    prefix: "JUN",
    slug: "junagadh-yog-shibir",
    title_gu: "જૂનાગઢ મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Junagadh Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 6,
    district_name: "Botad",
    level: "District",
    mobiles: ["9725796203"],
    venue: "કૃષ્ણસાગર ગાર્ડન પાળીયાદ રોડ બોટાદ",
    expected: 3000,
    date: "2026-09-27",
    prefix: "BOT",
    slug: "botad-yog-shibir",
    title_gu: "બોટાદ જિલ્લો યોગ શિબિર",
    title_en: "Botad Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 7,
    district_name: "Rajkot",
    level: "Municipal",
    mobiles: ["9712908271"],
    venue: null, // NULL in PDF
    expected: 10000,
    date: "2026-09-27",
    prefix: "RAJ",
    slug: "rajkot-yog-shibir",
    title_gu: "રાજકોટ મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Rajkot Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 8,
    district_name: "Mahisagar",
    level: "District",
    mobiles: ["8758283281"],
    venue: "મોડર્ન વિદ્યાલય કડાણા",
    expected: 3000,
    date: "2026-09-29",
    prefix: "MAH",
    slug: "mahisagar-yog-shibir",
    title_gu: "મહીસાગર જિલ્લો યોગ શિબિર",
    title_en: "Mahisagar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 9,
    district_name: "Valsad",
    level: "District",
    mobiles: ["9998213149"],
    venue: "તિથલ બીચ, વલસાડ",
    expected: 5000,
    date: "2026-09-29",
    prefix: "VAL",
    slug: "valsad-yog-shibir",
    title_gu: "વલસાડ જિલ્લો યોગ શિબિર",
    title_en: "Valsad Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 10,
    district_name: "Bharuch",
    level: "District",
    mobiles: ["9826200631", "8200607328"],
    venue: "MATARIYA TALAO, LINK ROAD BHARUCH",
    expected: 5000,
    date: "2026-09-30",
    prefix: "BHA",
    slug: "bharuch-yog-shibir",
    title_gu: "ભરૂચ જિલ્લો યોગ શિબિર",
    title_en: "Bharuch Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 11,
    district_name: "Dahod",
    level: "District",
    mobiles: ["9662765519", "9712291401"],
    venue: "છાબ તળાવ, દાહોદ",
    expected: 3000,
    date: "2026-09-30",
    prefix: "DAH",
    slug: "dahod-yog-shibir",
    title_gu: "દાહોદ જિલ્લો યોગ શિબિર",
    title_en: "Dahod Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 12,
    district_name: "Mehsana",
    level: "District",
    mobiles: ["9974230200"],
    venue: null, // NULL in PDF
    expected: 10000,
    date: "2026-10-01",
    prefix: "MSH",
    slug: "mahesana-yog-shibir",
    title_gu: "મહેસાણા જિલ્લો યોગ શિબિર",
    title_en: "Mahesana Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 13,
    district_name: "Chhota Udepur",
    level: "District",
    mobiles: ["8849349421"],
    venue: "સરદાર બાગ, કુસુમસાગર તળાવ સામે, છોટાઉદેપુર",
    expected: 3000,
    date: "2026-10-01",
    prefix: "CUP",
    slug: "chhotaudepur-yog-shibir",
    title_gu: "છોટાઉદેપુર જિલ્લો યોગ શિબિર",
    title_en: "Chhotaudepur Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 14,
    district_name: "Bhavnagar",
    level: "Municipal",
    mobiles: ["8487997969", "8000826379"],
    venue: null, // NULL in PDF
    expected: 5000,
    date: "2026-10-02",
    prefix: "BHV",
    slug: "bhavnagar-yog-shibir",
    title_gu: "ભાવનગર મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Bhavnagar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 15,
    district_name: "Vav-Tharad",
    level: "District",
    mobiles: ["9023121745"],
    venue: "ગાયત્રી વિદ્યાલય, થરાદ",
    expected: 3000,
    date: "2026-10-02",
    prefix: "VAV",
    slug: "vav-tharad-yog-shibir",
    title_gu: "વાવ થરાદ જિલ્લો યોગ શિબિર",
    title_en: "Vav Tharad Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 16,
    district_name: "Panchmahal",
    level: "District",
    mobiles: ["9409020632", "8780352540"],
    venue: "વિરાસત વન",
    expected: 5000,
    date: "2026-10-02",
    prefix: "PAN",
    slug: "panchmahal-yog-shibir",
    title_gu: "પંચમહાલ જિલ્લો યોગ શિબિર",
    title_en: "Panchmahal Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 17,
    district_name: "Navsari",
    level: "District",
    mobiles: ["9925190997"],
    venue: "દાંડી મેમોરીયલ, નવસારી",
    expected: 5000,
    date: "2026-10-02",
    prefix: "NAV",
    slug: "navsari-yog-shibir",
    title_gu: "નવસારી જિલ્લો યોગ શિબિર",
    title_en: "Navsari Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 18,
    district_name: "Sabarkantha",
    level: "District",
    mobiles: ["9426897901"],
    venue: "સાબર ડેરી, હિંમતનગર",
    expected: 3000,
    date: "2026-10-03",
    prefix: "SAB",
    slug: "sabarkantha-yog-shibir",
    title_gu: "સાબરકાંઠા જિલ્લો યોગ શિબિર",
    title_en: "Sabarkantha Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 19,
    district_name: "Narmada",
    level: "District",
    mobiles: ["9327709995"],
    venue: "સ્ટેચ્યુ ઓફ યુનિટી",
    expected: 5000,
    date: "2026-10-03",
    prefix: "NAR",
    slug: "narmada-yog-shibir",
    title_gu: "નર્મદા જિલ્લો યોગ શિબિર",
    title_en: "Narmada Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 20,
    district_name: "Kutch",
    level: "District",
    mobiles: ["9099881155", "9427178424"],
    venue: "સ્મૃતિ વન ભૂકંપ સંગ્રહાલય",
    expected: 5000,
    date: "2026-10-04",
    prefix: "KUT",
    slug: "kutch-yog-shibir",
    title_gu: "કચ્છ જિલ્લો યોગ શિબિર",
    title_en: "Kutch Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 21,
    district_name: "Anand",
    level: "District",
    mobiles: ["7405173739", "9106906535"],
    venue: "સરદાર સ્મૃતિ ભવન, કરમસદ",
    expected: 3000,
    date: "2026-10-04",
    prefix: "AND",
    slug: "anand-yog-shibir",
    title_gu: "આણંદ જિલ્લો યોગ શિબિર",
    title_en: "Anand Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 22,
    district_name: "Dang",
    level: "District",
    mobiles: ["9870099006"],
    venue: "સરકારી સાયન્સ કોલેજ, આહવા",
    expected: 3000,
    date: "2026-10-04",
    prefix: "DNG",
    slug: "dang-yog-shibir",
    title_gu: "ડાંગ જિલ્લો યોગ શિબિર",
    title_en: "Dang Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 23,
    district_name: "Banaskantha",
    level: "District",
    mobiles: ["9023121745"],
    venue: "અંબાજી શક્તિપીઠ અને ગબ્બર તીર્થ યાત્રા",
    expected: 5000,
    date: "2026-10-05",
    prefix: "BAN",
    slug: "banaskantha-yog-shibir",
    title_gu: "બનાસકાંઠા જિલ્લો યોગ શિબિર",
    title_en: "Banaskantha Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 24,
    district_name: "Tapi",
    level: "District",
    mobiles: ["9909118870"],
    venue: "જિલ્લા સેવા સદન, વ્યારા",
    expected: 3000,
    date: "2026-10-06",
    prefix: "TAP",
    slug: "tapi-yog-shibir",
    title_gu: "તાપી જિલ્લો યોગ શિબિર",
    title_en: "Tapi Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 25,
    district_name: "Gandhinagar",
    level: "Municipal",
    mobiles: ["8200081604"],
    venue: "વિધાનસભા પરીસર",
    expected: 5000,
    date: "2026-10-06",
    prefix: "GAN",
    slug: "gandhinagar-yog-shibir",
    title_gu: "ગાંધીનગર મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Gandhinagar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 26,
    district_name: "Gir Somnath",
    level: "District",
    mobiles: ["8866422003"],
    venue: "સોમનાથ બીચ - પ્રભાસ પાટણ, ગીર સોમનાથ જિલ્લો",
    expected: 5000,
    date: "2026-10-07",
    prefix: "GIR",
    slug: "gir-somnath-yog-shibir",
    title_gu: "ગીર સોમનાથ જિલ્લો યોગ શિબિર",
    title_en: "Gir Somnath Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 27,
    district_name: "Surendranagar",
    level: "District",
    mobiles: ["9558432402"],
    venue: "ભક્તિવન, ચોટીલા",
    expected: 3000,
    date: "2026-10-07",
    prefix: "SUR",
    slug: "surendranagar-yog-shibir",
    title_gu: "સુરેન્દ્રનગર જિલ્લો યોગ શિબિર",
    title_en: "Surendranagar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 28,
    district_name: "Porbandar",
    level: "District",
    mobiles: ["9925018393"],
    venue: "કીર્તિ મંદિર",
    expected: 5000,
    date: "2026-10-08",
    prefix: "POR",
    slug: "porbandar-yog-shibir",
    title_gu: "પોરબંદર જિલ્લો યોગ શિબિર",
    title_en: "Porbandar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 29,
    district_name: "Devbhumi Dwarka",
    level: "District",
    mobiles: ["9586282527"],
    venue: "સુદર્શન બ્રીજ બેટ દ્વારકા",
    expected: 3000,
    date: "2026-10-08",
    prefix: "DWA",
    slug: "devbhumi-dwarka-yog-shibir",
    title_gu: "દેવભૂમિ દ્વારકા જિલ્લો યોગ શિબિર",
    title_en: "Devbhumi Dwarka Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 30,
    district_name: "Ahmedabad",
    level: "Municipal",
    mobiles: ["8200040178"],
    venue: "અટલ બ્રિજ",
    expected: 3000,
    date: "2026-10-09",
    prefix: "AHMC",
    slug: "ahmedabad-municipal-yog-shibir",
    title_gu: "અમદાવાદ મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Ahmedabad Municipal Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
    area_options: ["Ahmedabad East", "Ahmedabad West", "Ahmedabad Central"],
  },
  {
    serial: 31,
    district_name: "Morbi",
    level: "District",
    mobiles: ["9033643781"],
    venue: null, // NULL in PDF
    expected: 3000,
    date: "2026-10-09",
    prefix: "MOR",
    slug: "morbi-yog-shibir",
    title_gu: "મોરબી જિલ્લો યોગ શિબિર",
    title_en: "Morbi Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 32,
    district_name: "Surat",
    level: "Municipal",
    mobiles: ["9428454604"],
    venue: null, // NULL in PDF
    expected: 10000,
    date: "2026-10-10",
    prefix: "SRT",
    slug: "surat-yog-shibir",
    title_gu: "સુરત મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Surat Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 33,
    district_name: "Amreli",
    level: "District",
    mobiles: ["9033316841"],
    venue: "New Marketing Yard, Amreli",
    expected: 3000,
    date: "2026-10-10",
    prefix: "AMR",
    slug: "amreli-yog-shibir",
    title_gu: "અમરેલી જિલ્લો યોગ શિબિર",
    title_en: "Amreli Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 34,
    district_name: "Aravalli",
    level: "District",
    mobiles: ["9724452307"],
    venue: "ઓધારી તળાવ ઓધારી મંદિર પાસે મોડાસા જિલ્લો અરવલ્લી",
    expected: 3000,
    date: "2026-10-11",
    prefix: "ARV",
    slug: "aravalli-yog-shibir",
    title_gu: "અરવલ્લી જિલ્લો યોગ શિબિર",
    title_en: "Aravalli Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
  {
    serial: 35,
    district_name: "Jamnagar",
    level: "Municipal",
    mobiles: ["8849815510", "7874621212"],
    venue: null, // NULL in PDF
    expected: 5000,
    date: "2026-10-17",
    prefix: "JAM",
    slug: "jamnagar-yog-shibir",
    title_gu: "જામનગર મહાનગરપાલિકા યોગ શિબિર",
    title_en: "Jamnagar Yog Shibir",
    reg_enabled: true,
    reg_mode: "internal",
  },
];

function buildDefaultForm(p, districtRecord) {
  const districtOptions = p.area_options
    ? p.area_options.map((opt) => ({ label: opt, value: opt }))
    : [
        {
          label: `${districtRecord.name} (City / Urban)`,
          value: `${districtRecord.name} (City / Urban)`,
        },
        {
          label: `${districtRecord.name} (Rural / Gramya)`,
          value: `${districtRecord.name} (Rural / Gramya)`,
        },
      ];

  return {
    fields: [
      {
        id: `f_name_${p.prefix.toLowerCase()}`,
        key: "full_name",
        label: "Full Name",
        label_gu: "પૂરું નામ",
        type: "text",
        required: true,
        placeholder: "Enter Full Name",
        help: "As it should appear on your Digital ID pass.",
        validation: { min: 2, max: 120 },
        order: 1,
        enabled: true,
      },
      {
        id: `f_mobile_${p.prefix.toLowerCase()}`,
        key: "mobile",
        label: "Mobile Number",
        label_gu: "મોબાઇલ નંબર",
        type: "phone",
        required: true,
        placeholder: "10-digit mobile number",
        help: "Will be used for pass verification and attendance.",
        validation: { pattern: "^[6-9]\\d{9}$", message: "Enter a valid 10-digit Indian mobile number" },
        order: 2,
        enabled: true,
      },
      {
        id: `f_district_${p.prefix.toLowerCase()}`,
        key: "district",
        label: "District / Area",
        label_gu: "જિલ્લો / વિસ્તાર",
        type: "dropdown",
        required: true,
        placeholder: "Select Area / District",
        options: districtOptions,
        order: 3,
        enabled: true,
      },
      {
        id: `f_refname_${p.prefix.toLowerCase()}`,
        key: "reference_name",
        label: "Reference Name",
        label_gu: "સંદર્ભ આપનાર વ્યક્તિનું નામ",
        type: "text",
        required: false,
        placeholder: "Optional referrer name",
        help: "Name of the person or center who recommended this camp.",
        order: 4,
        enabled: true,
      },
      {
        id: `f_refcode_${p.prefix.toLowerCase()}`,
        key: "referral_code",
        label: "Referral Code",
        label_gu: "રેફરલ કોડ",
        type: "text",
        required: false,
        placeholder: "Optional referral code",
        help: "Enter invite code if available.",
        order: 5,
        enabled: true,
      },
    ],
  };
}

async function run() {
  console.log("================================================================================");
  console.log("GUJARAT STATE YOG BOARD — IMPORT & SYNC ALL 35 PROGRAMS FROM PDF");
  console.log("================================================================================");

  // 1. Fetch all districts from database for mapping
  const { data: districts, error: distErr } = await supabase.from("districts").select("id, name, slug");
  if (distErr) throw new Error("Failed to fetch districts: " + distErr.message);

  const districtMap = new Map();
  for (const d of districts) {
    districtMap.set(d.name.toLowerCase().trim(), d);
    districtMap.set(d.slug.toLowerCase().trim(), d);
  }

  // 2. Fetch all existing events
  const { data: existingEvents, error: evErr } = await supabase
    .from("events")
    .select("id, slug, reg_prefix, is_active, publish_status, general, features, venue, max_registrations, event_date");
  if (evErr) throw new Error("Failed to fetch existing events: " + evErr.message);

  const eventBySlug = new Map();
  const eventById = new Map();
  for (const e of existingEvents) {
    if (e.slug) eventBySlug.set(e.slug, e);
    eventById.set(e.id, e);
  }

  console.log(`Found ${districts.length} districts in DB and ${existingEvents.length} existing events.`);

  // Set legacy boilerplate 'default' event to draft / template so only the 35 PDF events are published
  const defaultBoilerplate = existingEvents.find((e) => e.slug === "default" && e.id !== VADODARA_EXISTING_ID);
  if (defaultBoilerplate) {
    await supabase.from("events").update({ publish_status: "draft", is_template: true }).eq("id", defaultBoilerplate.id);
    console.log(`Archived legacy default boilerplate event (${defaultBoilerplate.id}) to draft/template.`);
  }

  const report = [];

  for (const p of PROGRAMS_MASTER) {
    // Resolve district
    let distRec = districtMap.get(p.district_name.toLowerCase().trim());
    if (!distRec) {
      // Fuzzy matching for hyphenated names like Vav-Tharad
      const cleaned = p.district_name.replace(/[-_ ]/g, "").toLowerCase();
      distRec = districts.find((d) => d.name.replace(/[-_ ]/g, "").toLowerCase() === cleaned);
    }
    if (!distRec) {
      throw new Error(`District record not found for: ${p.district_name}`);
    }

    // Check if event already exists
    let existing = null;
    if (p.id && eventById.has(p.id)) {
      existing = eventById.get(p.id);
    } else if (eventBySlug.has(p.slug)) {
      existing = eventBySlug.get(p.slug);
    }

    let eventId = existing?.id;

    if (p.serial === 2) {
      // VADODARA: strictly preserve existing event and set registration_enabled = false / external
      console.log(`[Entry 2] Preserving Vadodara (${existing?.id || VADODARA_EXISTING_ID}). Setting external/disabled mode.`);
      const currentFeatures = existing?.features ?? {};
      const currentGeneral = existing?.general ?? {};

      const { error: updErr } = await supabase
        .from("events")
        .update({
          is_active: true,
          publish_status: "published",
          lifecycle_status: "upcoming",
          type: "municipal",
          district: distRec.name,
          district_id: distRec.id,
          district_name: distRec.name,
          event_date: p.date,
          // Do NOT touch venue if already present
          venue: existing?.venue || p.venue,
          max_registrations: p.expected,
          reg_prefix: p.prefix,
          features: {
            ...currentFeatures,
            registration: false, // PUBLIC REGISTRATION DISABLED
            attendance: true,
            certificate: false,
            show_details: true,
            countdown: true,
            footer: true,
          },
          general: {
            ...currentGeneral,
            title: currentGeneral.title || p.title_gu,
            level: p.level,
            contact_mobiles: p.mobiles,
            contact_mobile: p.mobiles.join(" / "),
            expected_participants: p.expected,
            registration_mode: "external", // Explicit external mode
            registration_enabled: false,
            event_date: p.date,
            start_time: currentGeneral.start_time ?? null,
            end_time: currentGeneral.end_time ?? null,
            event_time: currentGeneral.event_time ?? null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing?.id || VADODARA_EXISTING_ID);

      if (updErr) throw new Error("Failed to update Vadodara: " + updErr.message);
      eventId = existing?.id || VADODARA_EXISTING_ID;
    } else if (existing) {
      // Update existing record safely without wiping custom form changes
      console.log(`[Entry ${p.serial}] Updating existing event: ${p.slug} (${existing.id})`);
      const currentFeatures = existing.features ?? {};
      const currentGeneral = existing.general ?? {};

      const { error: updErr } = await supabase
        .from("events")
        .update({
          is_active: true,
          publish_status: "published",
          lifecycle_status: "upcoming",
          type: p.level.toLowerCase(),
          district: distRec.name,
          district_id: distRec.id,
          district_name: distRec.name,
          event_date: p.date,
          venue: p.venue, // NULL if missing in PDF
          max_registrations: p.expected,
          reg_prefix: p.prefix,
          features: {
            ...currentFeatures,
            registration: true,
            attendance: true,
            show_details: true,
          },
          general: {
            ...currentGeneral,
            title: currentGeneral.title || p.title_gu,
            level: p.level,
            contact_mobiles: p.mobiles,
            contact_mobile: p.mobiles.join(" / "),
            expected_participants: p.expected,
            registration_mode: "internal",
            event_date: p.date,
            start_time: currentGeneral.start_time ?? null,
            end_time: currentGeneral.end_time ?? null,
            event_time: currentGeneral.event_time ?? null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updErr) throw new Error(`Failed to update ${p.slug}: ` + updErr.message);
      eventId = existing.id;
    } else {
      // Insert new event
      console.log(`[Entry ${p.serial}] Creating new event: ${p.slug} (${p.level})`);
      const formConfig = buildDefaultForm(p, distRec);

      const newEvent = {
        slug: p.slug,
        is_active: true,
        publish_status: "published",
        lifecycle_status: "upcoming",
        type: p.level.toLowerCase(),
        district: distRec.name,
        district_id: distRec.id,
        district_name: distRec.name,
        event_date: p.date,
        event_time: null, // NO INVENTED TIME
        venue: p.venue,   // NULL IF MISSING IN PDF
        max_registrations: p.expected,
        reg_prefix: p.prefix,
        features: {
          registration: true,
          attendance: true,
          certificate: false,
          show_details: true,
          countdown: true,
          footer: true,
          referral: true,
          whatsapp: false,
          social: false,
          live: false,
          embedded_live: false,
          backup_live: false,
        },
        general: {
          title: p.title_gu,
          subtitle: p.title_en,
          level: p.level,
          theme: "યોગમય ગુજરાત — સ્વસ્થ ગુજરાત",
          description: `ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા આયોજિત ભવ્ય યોગ શિબિર — ${p.district_name}.`,
          banner_url: "",
          contact_mobiles: p.mobiles,
          contact_mobile: p.mobiles.join(" / "),
          expected_participants: p.expected,
          registration_mode: "internal",
          event_date: p.date,
          start_time: null,
          end_time: null,
          event_time: null,
          duration_minutes: 120,
          speaker_name: "",
          speaker_designation: "",
          coverage: {
            type: "single",
            district_ids: [distRec.id],
          },
        },
        form: formConfig,
        certificate: {
          enabled: false,
          title: "યોગ શિબિર સહભાગી પ્રમાણપત્ર",
          organization_name: "ગુજરાત રાજ્ય યોગ બોર્ડ",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: insData, error: insErr } = await supabase
        .from("events")
        .insert(newEvent)
        .select("id")
        .single();

      if (insErr) throw new Error(`Failed to insert ${p.slug}: ` + insErr.message);
      eventId = insData.id;
    }

    // Ensure atomic registration sequence exists for this event
    const { error: seqErr } = await supabase
      .from("event_reg_seq")
      .insert({ event_id: eventId, next_val: 1 })
      .select()
      .maybeSingle();

    // Ignore duplicate key error on event_reg_seq (it means sequence is already initialized!)
    if (seqErr && seqErr.code !== "23505") {
      console.warn(`[Seq Warning] for ${p.slug}:`, seqErr.message);
    }

    report.push({
      serial: p.serial,
      district: p.district_name,
      level: p.level,
      date: p.date,
      prefix: p.prefix,
      slug: p.slug,
      expected: p.expected,
      contacts: p.mobiles.join(", "),
      venue: p.venue || "[MISSING IN PDF]",
      reg_enabled: p.reg_enabled ? "YES" : "NO (External)",
    });
  }

  // Verification
  console.log("\n================================================================================");
  console.log("IMPORT COMPLETED — MASTER VERIFICATION REPORT");
  console.log("================================================================================");
  console.table(report);

  const { data: finalEvents, error: fErr } = await supabase
    .from("events")
    .select("id, slug, is_active, publish_status, features, reg_prefix, event_date")
    .eq("publish_status", "published")
    .order("event_date", { ascending: true });

  if (fErr) throw new Error(fErr.message);

  const regEnabledCount = finalEvents.filter((e) => e.features?.registration === true).length;
  const regDisabledCount = finalEvents.filter((e) => e.features?.registration === false).length;

  console.log(`\nVerification Summary:`);
  console.log(`- Total published event records in DB: ${finalEvents.length}`);
  console.log(`- Events with registration enabled on this portal: ${regEnabledCount}`);
  console.log(`- Events with registration disabled / external (Vadodara): ${regDisabledCount}`);

  if (finalEvents.length < 35) {
    throw new Error(`Expected at least 35 published events, found ${finalEvents.length}`);
  }
  if (regEnabledCount !== 34) {
    throw new Error(`Expected exactly 34 registration-enabled events, found ${regEnabledCount}`);
  }

  console.log("\nSUCCESS: All 35 programs accurately imported and verified!");
}

run().catch((err) => {
  console.error("FATAL ERROR in import script:", err);
  process.exit(1);
});
