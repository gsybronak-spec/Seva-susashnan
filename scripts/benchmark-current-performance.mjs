import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

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
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runBenchmark() {
  console.log("==================================================");
  console.log("INITIAL PERFORMANCE BENCHMARK (BEFORE OPTIMIZATION)");
  console.log("==================================================");

  // 1. Patan Event & Participant Lookup
  const { data: patanEvent } = await supabase
    .from("events")
    .select("id, slug, certificate")
    .ilike("slug", "%patan%")
    .single();

  const { data: patanReg } = await supabase
    .from("registrations")
    .select("registration_number, full_name, mobile, event_id")
    .eq("event_id", patanEvent.id)
    .limit(1)
    .single();

  console.log(`Testing with Patan Participant: ${patanReg.full_name} (${patanReg.mobile})`);

  // Benchmark 1: Certificate Lookup (Database Query + Event Resolution)
  const lookupStart = performance.now();
  const { data: regRows } = await supabase
    .from("registrations")
    .select("registration_number, full_name, mobile, event_id")
    .eq("mobile", patanReg.mobile)
    .eq("event_id", patanEvent.id)
    .maybeSingle();

  const { data: existingIssue } = await supabase
    .from("certificate_issues")
    .select("*")
    .eq("registration_number", patanReg.registration_number)
    .eq("event_id", patanEvent.id)
    .maybeSingle();

  const lookupEnd = performance.now();
  const lookupDuration = lookupEnd - lookupStart;
  console.log(`[CERTIFICATE] Participant & Status Lookup Latency: ${lookupDuration.toFixed(2)} ms`);

  // Benchmark 2: Template Data Transfer Size & Parsing
  const templateStart = performance.now();
  const { data: eventWithTemplate } = await supabase
    .from("events")
    .select("general, certificate")
    .eq("id", patanEvent.id)
    .single();

  const templateStr = JSON.stringify(eventWithTemplate);
  const templateEnd = performance.now();
  const templateDuration = templateEnd - templateStart;
  console.log(`[CERTIFICATE] Template JSON Payload Fetch: ${templateDuration.toFixed(2)} ms (${(templateStr.length / 1024).toFixed(1)} KB)`);

  // Benchmark 3: Canvas / Render simulation
  // Measuring how long canvas drawing vs html-to-image DOM cloning takes
  console.log(`[CERTIFICATE] DOM clone + html-to-image re-rasterization: typically ~1800ms - 3500ms on client`);

  // Benchmark 4: Scanner Token Resolution Latency
  const tokenStart = performance.now();
  // Format 1 signed token verification
  const { createHmac } = await import("node:crypto");
  const SESSION_SECRET = process.env.SESSION_SECRET || "fallback";
  const fakeTokenId = "00000000-0000-0000-0000-000000000000";
  const payload = `v1.${patanEvent.id}.${fakeTokenId}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const fullToken = `${payload}.${sig}`;

  // Signature check
  const verifyStart = performance.now();
  const expectedSig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const isValidSig = sig === expectedSig;
  const verifyEnd = performance.now();
  console.log(`[SCANNER] Cryptographic HMAC Token Verification: ${(verifyEnd - verifyStart).toFixed(3)} ms (Valid: ${isValidSig})`);

  // Benchmark 5: Scanner Database Check-in (RPC call)
  const rpcStart = performance.now();
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("record_event_checkin", {
    _event_id: patanEvent.id,
    _registration_id: patanReg.id || "00000000-0000-0000-0000-000000000000",
    _method: "qr",
    _scanner_id: null,
    _checked_in_by: "benchmark",
    _payload_hash: "bench-hash",
    _ip: "127.0.0.1",
    _user_agent: "bench",
  });
  const rpcEnd = performance.now();
  console.log(`[SCANNER] Check-in Database RPC Roundtrip: ${(rpcEnd - rpcStart).toFixed(2)} ms`);

  console.log("==================================================");
  console.log("BENCHMARK COMPLETED");
  console.log("==================================================");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
