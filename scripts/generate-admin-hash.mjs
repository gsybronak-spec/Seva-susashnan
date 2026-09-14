#!/usr/bin/env node
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(plain, stored) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  const actual = scryptSync(plain, salt, expected.length, { N, r, p });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

const plainPassword = process.argv[2];
if (!plainPassword) {
  console.error("Error: Please provide a password.");
  console.error("Usage: node scripts/generate-admin-hash.mjs \"NewPasswordHere\"");
  process.exit(1);
}
if (plainPassword.length < 8) {
  console.error("Error: Password must be at least 8 characters.");
  process.exit(1);
}

const hash = hashPassword(plainPassword);
const valid = verifyPassword(plainPassword, hash);
if (!valid) {
  console.error("Self-test verification failed.");
  process.exit(1);
}

console.log("\n=== Super Admin Password Hash Generated Successfully ===");
console.log("Algorithm: scrypt (N=16384, r=8, p=1, keylen=64)");
console.log("Verification: PASSED");
console.log("\nRun the following SQL in your Supabase SQL Editor to reset the Super Admin:\n");
console.log(`UPDATE public.admin_users
SET password_hash = '${hash}',
    must_change_password = true,
    disabled = false
WHERE role = 'super_admin' AND username = 'superadmin';\n`);
