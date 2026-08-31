import { loginViaAppsScript } from "../../../lib/sheets";
import { generateToken, setSessionCookie } from "../../../lib/auth";
import { createSession, registerFailedLogin, clearFailedLogin, getFailedLoginCount } from "../../../lib/redis";

const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS || 28800);

/**
 * Password verification happens entirely inside Code.gs (SHA-256 + salt,
 * same pattern as EM Viable) — this route never sees the hash or salt.
 * Note: the app is username-based (matching EM Viable), but the session
 * object still uses the "email" field name internally for consistency with
 * the rest of this codebase (Document_Access.userEmail, etc.) — it holds
 * the username value, not necessarily a real email address.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  // Lock out after 5 failed attempts within 5 minutes
  const currentFails = await getFailedLoginCount(username);
  if (currentFails >= 5) {
    return res.status(429).json({ error: "Terlalu banyak percobaan gagal. Coba lagi nanti." });
  }

  const result = await loginViaAppsScript(username, password);

  if (result.error) {
    await registerFailedLogin(username);
    return res.status(401).json({ error: result.error });
  }

  await clearFailedLogin(username);

  const token = generateToken();
  await createSession(token, {
    email: result.username, // username as the internal user identifier
    nama: result.nama,
    role: result.role,
  });
  setSessionCookie(res, token, SESSION_TTL);

  return res.status(200).json({
    username: result.username,
    nama: result.nama,
    role: result.role,
  });
}
