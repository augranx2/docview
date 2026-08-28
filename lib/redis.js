import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS || 28800); // 8 hours
const VIEW_TOKEN_TTL = Number(process.env.VIEW_TOKEN_TTL_SECONDS || 600); // 10 minutes

export async function createSession(token, sessionData) {
  await redis.set(`session:${token}`, JSON.stringify(sessionData), { ex: SESSION_TTL });
}

export async function getSession(token) {
  const raw = await redis.get(`session:${token}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function destroySession(token) {
  await redis.del(`session:${token}`);
}

/**
 * Short-lived token proving a user is allowed to view a specific document
 * right now. Generated only after a Document_Access check passes. The PDF
 * page-rendering endpoint requires this token on every page request and it
 * expires quickly so a copied link stops working shortly after.
 */
export async function createViewToken(token, { documentId, userEmail }) {
  await redis.set(
    `view:${token}`,
    JSON.stringify({ documentId, userEmail }),
    { ex: VIEW_TOKEN_TTL }
  );
}

export async function getViewToken(token) {
  const raw = await redis.get(`view:${token}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Simple failed-login rate limiting: locks an email out after too many
// wrong-password attempts within a short window.
export async function registerFailedLogin(email) {
  const key = `failedlogin:${email}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 300); // 5 minute window
  return count;
}

export async function clearFailedLogin(email) {
  await redis.del(`failedlogin:${email}`);
}
