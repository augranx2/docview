import { requireSession } from "../../../lib/auth";
import { getAllRows, updateRowsByMatch } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/** Menandai satu pemberitahuan sudah dibaca, atau seluruhnya bila `all` true. */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { notifId, all } = req.body || {};
  const readAt = new Date().toISOString();

  try {
    if (all) {
      const rows = await getAllRows("Notifications");
      const belum = rows.filter(
        (n) => n.userEmail === session.email && !String(n.readAt || "").trim()
      );
      for (const n of belum) {
        await updateRowsByMatch("Notifications", { notifId: n.notifId }, { readAt });
      }
      return res.status(200).json({ success: true, updated: belum.length });
    }

    if (!notifId) return res.status(400).json({ error: "notifId wajib diisi" });
    // Dicocokkan bersama userEmail agar seseorang tidak bisa menandai
    // pemberitahuan milik orang lain hanya dengan menebak notifId.
    const updated = await updateRowsByMatch(
      "Notifications",
      { notifId, userEmail: session.email },
      { readAt }
    );
    return res.status(200).json({ success: true, updated });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}

export default withErrorHandling(handler);
