import { requireAdmin } from "../../../lib/auth";
import { ensureFileIsPrivate } from "../../../lib/googleDrive";
import { updateRowByKey, appendRow, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, driveFileId, accessUserEmails } = req.body;

  if (!documentId || !driveFileId) {
    return res.status(400).json({ error: "documentId dan driveFileId wajib diisi" });
  }

  try {
    await ensureFileIsPrivate(driveFileId);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Gagal mengatur permission file di Drive" });
  }

  await updateRowByKey("Documents", "documentId", documentId, {
    driveFileId,
    status: "active",
  });

  const emails = Array.isArray(accessUserEmails) ? accessUserEmails : [];
  for (const email of emails) {
    await appendRow("Document_Access", {
      documentId,
      userEmail: email,
      grantedBy: session.email,
      grantedAt: new Date().toISOString(),
    });
  }

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "UPLOAD",
    detail: `Shared to ${emails.length} user(s)`,
  });

  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
