import { useSession } from "@tanstack/react-start/server";

export type AdminRole = "super_admin" | "view_admin";

export type AdminSessionData = {
  userId?: string;
  username?: string;
  role?: AdminRole;
  mustChangePassword?: boolean;
};

const ADMIN_SESSION_NAME = "syb-admin";

export function adminSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return {
    password,
    name: ADMIN_SESSION_NAME,
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getAdminSession() {
  return useSession<AdminSessionData>(adminSessionConfig());
}

export async function requireAdmin(): Promise<AdminSessionData> {
  const session = await getAdminSession();
  if (!session.data.userId || !session.data.role) {
    throw new Error("Unauthorized");
  }
  return session.data;
}

export async function requireSuperAdmin(): Promise<AdminSessionData> {
  const data = await requireAdmin();
  if (data.role !== "super_admin") throw new Error("Forbidden: super admin only");
  return data;
}

// ---------- Password hashing (scrypt) ----------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const { randomBytes, scryptSync } = await import("node:crypto");
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const { scryptSync, timingSafeEqual } = await import("node:crypto");
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

export async function constantTimeEqualStrings(a: string, b: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}
