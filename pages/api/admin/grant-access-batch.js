import { requireAdmin } from "../../../lib/auth";
import { findRows, appendRows, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, usernames, canDownload } = req.body;
  if (!documentId || !Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: "documentId dan usernames (minimal 1) wajib diisi" });
  }

  const existingAccess = await findRows(
    "Document_Access",
    (a) => a.documentId === documentId
  );
  const alreadyShared = new Set(existingAccess.map((a) => a.userEmail));
  const targets = [...new Set(usernames)].filter((u) => !alreadyShared.has(u));

  if (targets.length === 0) {
    return res.status(200).json({ success: true, added: 0 });
  }

  const now = new Date().toISOString();
  const rows = targets.map((username) => ({
    documentId,
    userEmail: username,
    grantedBy: session.email,
    grantedAt: now,
    canDownload: canDownload ? "TRUE" : "",
  }));

  const added = await appendRows("Document_Access", rows);

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_GRANTED",
    detail: `to ${targets.join(", ")}${canDownload ? " (izin download)" : ""}`,
  });

  return res.status(200).json({ success: true, added });
}

export default withErrorHandling(handler);
