import { requireAdmin } from "../../../lib/auth";
import {
  getUsersSafe,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  logAudit,
} from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Satu endpoint untuk seluruh pengelolaan akun: daftar, tambah, ubah, reset
 * password, dan hapus. Password tidak pernah dikirim balik ke aplikasi —
 * proses hash dilakukan di Apps Script.
 */
async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const users = await getUsersSafe();
    return res.status(200).json({ users });
  }

  if (req.method !== "POST") return res.status(405).end();

  const { aksi } = req.body || {};

  try {
    if (aksi === "tambah") {
      const { nama, username, role, status, password } = req.body;
      await createUser({ nama, username, role, status, password });
      await logAudit({
        userEmail: session.email,
        action: "USER_CREATED",
        detail: `${username} (${role}, ${status})`,
      });
      return res.status(200).json({ success: true });
    }

    if (aksi === "ubah") {
      const { username, nama, role, status } = req.body;
      if (!username) return res.status(400).json({ error: "username wajib diisi" });

      // Admin tidak boleh menonaktifkan atau menurunkan perannya sendiri —
      // tanpa penjagaan ini satu klik bisa mengunci seluruh pengelolaan sistem.
      if (username === session.email) {
        if (role && role !== "Admin") {
          return res.status(400).json({ error: "Anda tidak dapat mengubah peran akun Anda sendiri" });
        }
        if (status && status !== "Aktif") {
          return res.status(400).json({ error: "Anda tidak dapat menonaktifkan akun Anda sendiri" });
        }
      }

      await updateUser({ username, nama, role, status });
      await logAudit({
        userEmail: session.email,
        action: "USER_UPDATED",
        detail: `${username}${nama ? ` nama=${nama}` : ""}${role ? ` role=${role}` : ""}${status ? ` status=${status}` : ""}`,
      });
      return res.status(200).json({ success: true });
    }

    if (aksi === "reset-password") {
      const { username, password } = req.body;
      await resetUserPassword(username, password);
      await logAudit({
        userEmail: session.email,
        action: "PASSWORD_RESET",
        detail: `untuk ${username}`,
      });
      return res.status(200).json({ success: true });
    }

    if (aksi === "hapus") {
      const { username } = req.body;
      if (username === session.email) {
        return res.status(400).json({ error: "Anda tidak dapat menghapus akun Anda sendiri" });
      }
      await deleteUser(username);
      await logAudit({ userEmail: session.email, action: "USER_DELETED", detail: username });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Aksi tidak dikenali" });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withErrorHandling(handler);
