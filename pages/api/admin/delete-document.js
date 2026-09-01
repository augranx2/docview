import { requireAdmin } from "../../../lib/auth";
import { findRows, deleteRows, logAudit } from "../../../lib/sheets";
import { deleteFile } from "../../../lib/googleDrive";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  const docs = await findRows("Documents", (d) => d.documentId === documentId);
  const doc = docs[0];
  if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

  // Safety guard: don't allow deleting a file that's still shared to
  // someone — admin must end every share first (matches the intended
  // workflow: revoke access, then delete).
  const remainingAccess = await findRows(
    "Document_Access",
    (a) => a.documentId === documentId
  );
  if (remainingAccess.length > 0) {
    return res.status(400).json({
      error: `Masih dibagikan ke ${remainingAccess.length} user. Akhiri semua share dulu sebelum menghapus.`,
    });
  }

  if (doc.driveFileId) {
    try {
      await deleteFile(doc.driveFileId);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "Gagal menghapus file di Google Drive" });
    }
  }

  await deleteRows("Documents", { documentId });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "DOCUMENT_DELETED",
    detail: doc.namaDokumen,
  });

  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
