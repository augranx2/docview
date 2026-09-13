import { requireAdmin } from "../../../lib/auth";
import { deleteRows, findRows, logAudit } from "../../../lib/sheets";
import { notifyDocument } from "../../../lib/notifyDoc";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Removes EVERY access grant for one document in a single sheet rewrite —
 * the counterpart to "Bagikan ke Semua". Doing this by matching on
 * documentId alone is far cheaper than sending the full username list.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  // Daftar penerima diambil sebelum baris dihapus — setelah itu tidak ada
  // lagi cara mengetahui siapa saja yang kehilangan akses.
  const sebelum = await findRows("Document_Access", (a) => a.documentId === documentId);
  const deleted = await deleteRows("Document_Access", { documentId });

  await notifyDocument(
    sebelum.map((a) => a.userEmail),
    documentId,
    { type: "akses-dicabut", title: "Akses Anda ke sebuah dokumen dicabut" }
  );

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_REVOKED",
    detail: `from all (${deleted} akses)`,
  });

  return res.status(200).json({ success: true, deleted });
}

export default withErrorHandling(handler);
