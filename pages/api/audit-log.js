import { requireSession } from "../../../lib/auth";
import { getAllRows } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  // Hanya Admin yang boleh melihat seluruh audit log kantor
  if (session.role !== "Admin") {
    return res.status(403).json({ error: "Forbidden - Admin only" });
  }

  try {
    const logs = await getAllRows("Audit_Log");
    // Urutkan dari yang terbaru ke terlama
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.status(200).json({ logs: logs.slice(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: "Gagal memuat audit log" });
  }
}