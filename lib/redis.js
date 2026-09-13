import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Dua batas berjalan bersamaan:
//   IDLE_TTL   — sesi hangus bila tidak ada aktivitas selama ini. Diperbarui
//                setiap permintaan yang terautentikasi.
//   ABSOLUTE   — batas keras sejak login, tidak peduli seberapa aktif
//                penggunanya. Mencegah sesi hidup selamanya hanya karena tab
//                dibiarkan terbuka dan sesekali disentuh.
const IDLE_TTL = Number(process.env.SESSION_IDLE_SECONDS || 1800); // 30 menit
const ABSOLUTE_TTL = Number(process.env.SESSION_ABSOLUTE_SECONDS || 43200); // 12 jam
const VIEW_TOKEN_TTL = Number(process.env.VIEW_TOKEN_TTL_SECONDS || 600); // 10 minutes

// This Redis instance may be shared with other apps (e.g. reused from
// another project instead of provisioning a dedicated one). Every key this
// app writes is prefixed so it can never collide with another app's keys in
// the same database.
const APP_PREFIX = "docview";
const k = (key) => `${APP_PREFIX}:${key}`;

export async function createSession(token, sessionData) {
  await redis.set(
    k(`session:${token}`),
    JSON.stringify({ ...sessionData, loginAt: Date.now() }),
    { ex: IDLE_TTL }
  );
}

/**
 * Mengambil sesi sekaligus memperpanjang masa diamnya.
 *
 * Setiap permintaan yang berhasil menyetel ulang hitungan 30 menit, sehingga
 * pengguna yang sedang bekerja tidak pernah terlempar keluar. Namun batas
 * 12 jam sejak login tetap ditegakkan: begitu terlampaui, sesi dihapus dan
 * pengguna harus masuk kembali.
 */
export async function getSession(token) {
  const key = k(`session:${token}`);
  const raw = await redis.get(key);
  if (!raw) return null;

  const session = typeof raw === "string" ? JSON.parse(raw) : raw;

  const loginAt = Number(session.loginAt || 0);
  if (loginAt && Date.now() - loginAt > ABSOLUTE_TTL * 1000) {
    await redis.del(key);
    return null;
  }

  // Perpanjang jendela diam. Dijalankan tanpa menunggu agar tidak menambah
  // waktu tanggap setiap permintaan.
  redis.expire(key, IDLE_TTL).catch(() => {});

  return session;
}

export const SESSION_IDLE_SECONDS = IDLE_TTL;
export const SESSION_ABSOLUTE_SECONDS = ABSOLUTE_TTL;

export async function destroySession(token) {
  await redis.del(k(`session:${token}`));
}

/**
 * Short-lived token proving a user is allowed to view a specific document
 * right now. Generated only after a Document_Access check passes. The PDF
 * page-rendering endpoint requires this token on every page request and it
 * expires quickly so a copied link stops working shortly after.
 */
export async function createViewToken(token, { documentId, userEmail }) {
  await redis.set(
    k(`view:${token}`),
    JSON.stringify({ documentId, userEmail }),
    { ex: VIEW_TOKEN_TTL }
  );
}

export async function getViewToken(token) {
  const raw = await redis.get(k(`view:${token}`));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Simple failed-login rate limiting: locks an email out after too many
// wrong-password attempts within a short window.
export async function getFailedLoginCount(email) {
  const count = await redis.get(k(`failedlogin:${email}`));
  return Number(count || 0);
}

export async function registerFailedLogin(email) {
  const key = k(`failedlogin:${email}`);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 300); // 5 minute window
  return count;
}

export async function clearFailedLogin(email) {
  await redis.del(k(`failedlogin:${email}`));
}
