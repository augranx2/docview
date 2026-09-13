import { requireSession } from "../../../lib/auth";
import { getAllRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Pemberitahuan milik pengguna yang sedang masuk, terbaru di atas.
 *
 * Bila tab Notifications belum ada di spreadsheet, endpoint ini mengembalikan
 * daftar kosong alih-alih galat — aplikasi tetap berjalan penuh tanpa fitur
 * pemberitahuan, dan mulai bekerja begitu tabnya dibuat.
 */
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  let rows = [];
  try {
    rows = await getAllRows("Notifications");
  } catch {
    return res.status(200).json({ notifications: [], unread: 0, available: false });
  }

  const milik = rows
    .filter((n) => n.userEmail === session.email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);

  const unread = milik.filter((n) => !String(n.readAt || "").trim()).length;

  return res.status(200).json({ notifications: milik, unread, available: true });
}

export default withErrorHandling(handler);
