import { v4 as uuidv4 } from "uuid";
import { getSession } from "./redis";

// Password hashing/verification lives entirely in Code.gs (SHA-256 + salt,
// matching the EM Viable pattern) — Node never handles raw hashes, so no
// bcrypt or similar library is needed here.

export function generateToken() {
  return uuidv4();
}

const COOKIE_NAME = "session_token";

export function setSessionCookie(res, token, maxAgeSeconds) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; Max-Age=0`);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

/**
 * Reads the session cookie, looks it up in Redis, and returns the session
 * object ({ email, nama, role, ... }) or null if not logged in / expired.
 */
export async function getCurrentSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  return { ...session, token };
}

export async function requireSession(req, res) {
  const session = await getCurrentSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

export async function requireAdmin(req, res) {
  const session = await requireSession(req, res);
  if (!session) return null;
  if (session.role !== "Admin") {
    res.status(403).json({ error: "Forbidden - admin only" });
    return null;
  }
  return session;
}
