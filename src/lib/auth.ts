import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "player_analysis_session";
const SESSION_DAYS = 7;

export class AuthError extends Error {
  constructor(message = "Invalid or expired session.") { super(message); this.name = "AuthError"; }
}

export class ManagementAccessError extends Error {
  constructor(message = "Enter the management password to access this area.") { super(message); this.name = "ManagementAccessError"; }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64); const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePassword(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("The password must contain at least 8 characters, one letter and one number.");
}

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash: tokenHash(token), userId, expiresAt, lastSeenAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
}

export async function requireAccount() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new AuthError();
  const session = await prisma.session.findFirst({ where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() } }, include: { user: { include: { workspace: true } } } });
  if (!session) throw new AuthError();
  return { user: session.user, workspace: session.user.workspace, session };
}

export async function requireManagementAccount() {
  const account = await requireAccount();
  if (!account.workspace.managementPasswordHash) throw new ManagementAccessError("Create the management password before accessing this area.");
  if (!account.session.managementUnlockedAt) throw new ManagementAccessError();
  return account;
}
