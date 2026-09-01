import { requireSession } from "../../../lib/auth";
import { changePasswordViaAppsScript } from "../../../lib/sheets";

/**
 * Old password is verified inside Code.gs (same SHA-256+salt check used for
 * login) before anything is written — this route never reads or compares
 * hashes itself, and never touches the Users sheet directly (that tab is
 * intentionally blocked from the generic getRows/updateRowByKey actions).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Password lama dan baru wajib diisi" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password baru minimal 6 karakter" });
  }

  const result = await changePasswordViaAppsScript(session.email, oldPassword, newPassword);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(200).json({ success: true });
}
