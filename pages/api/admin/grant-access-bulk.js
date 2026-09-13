import { requireAdmin } from "../../../lib/auth";
import { getAllRows, appendRows, logAudit, notify } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Shares SEVERAL documents with SEVERAL users in one go.
 *
 * Existing grants are read once and used to skip duplicates, so re-running
 * this over a document that some users already have does not create a second
 * row for them — duplicated rows would make the "Kelola Akses" list show the
 * same person twice and make revoking unreliable.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentIds, usernames, canDownload } = req.body;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: "documentIds (minimal 1) wajib diisi" });
  }
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: "usernames (minimal 1) wajib diisi" });
  }

  const existing = await getAllRows("Document_Access");
  const sudahAda = new Set(existing.map((a) => `${a.documentId}\u0000${a.userEmail}`));

  const now = new Date().toISOString();
  const rows = [];
  for (const documentId of documentIds) {
    for (const username of usernames) {
      if (sudahAda.has(`${documentId}\u0000${username}`)) continue;
      rows.push({
        documentId,
        userEmail: username,
        grantedBy: session.email,
        grantedAt: now,
        canDownload: canDownload ? "TRUE" : "",
      });
    }
  }

  if (rows.length > 0) await appendRows("Document_Access", rows);

  if (rows.length > 0) {
    const penerima = [...new Set(rows.map((r) => r.userEmail))];
    await notify(penerima, {
      type: "akses-diberikan",
      title: "Dokumen baru dibagikan ke Anda",
      detail: `${documentIds.length} dokumen${canDownload ? " — boleh diunduh" : " — baca saja"}`,
    });
  }

  await logAudit({
    userEmail: session.email,
    action: "ACCESS_GRANTED",
    detail: `${documentIds.length} dokumen ke ${usernames.length} user (${rows.length} akses baru)${canDownload ? " (izin download)" : ""}`,
  });

  return res.status(200).json({
    success: true,
    added: rows.length,
    skipped: documentIds.length * usernames.length - rows.length,
  });
}

export default withErrorHandling(handler);
