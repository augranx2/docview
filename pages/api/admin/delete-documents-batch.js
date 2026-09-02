import { requireAdmin } from "../../../lib/auth";
import { findRows, deleteRowsBatch, logAudit } from "../../../lib/sheets";
import { deleteFile } from "../../../lib/googleDrive";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentIds } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: "documentIds (minimal 1) wajib diisi" });
  }

  const [allDocs, allAccess] = await Promise.all([
    findRows("Documents", (d) => documentIds.includes(d.documentId)),
    findRows("Document_Access", (a) => documentIds.includes(a.documentId)),
  ]);

  const sharedCountByDoc = {};
  for (const a of allAccess) {
    sharedCountByDoc[a.documentId] = (sharedCountByDoc[a.documentId] || 0) + 1;
  }

  const deletable = [];
  const skipped = [];
  for (const id of documentIds) {
    const doc = allDocs.find((d) => d.documentId === id);
    if (!doc) {
      skipped.push({ documentId: id, reason: "Tidak ditemukan" });
    } else if (sharedCountByDoc[id] > 0) {
      skipped.push({ documentId: id, namaDokumen: doc.namaDokumen, reason: "Masih dibagikan" });
    } else {
      deletable.push(doc);
    }
  }

  // Delete each Drive file individually (Drive API has no batch-delete),
  // but tolerate individual failures rather than aborting the whole batch.
  const driveResults = await Promise.allSettled(
    deletable.filter((d) => d.driveFileId).map((d) => deleteFile(d.driveFileId))
  );
  driveResults.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Failed to delete Drive file for ${deletable[i].documentId}:`, result.reason);
    }
  });

  if (deletable.length > 0) {
    await deleteRowsBatch(
      "Documents",
      deletable.map((d) => ({ documentId: d.documentId }))
    );
  }

  await logAudit({
    userEmail: session.email,
    action: "DOCUMENT_DELETED",
    detail: `bulk: ${deletable.map((d) => d.namaDokumen).join(", ")}`,
  });

  return res.status(200).json({
    success: true,
    deleted: deletable.length,
    skipped,
  });
}

export default withErrorHandling(handler);
