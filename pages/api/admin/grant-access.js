import { requireAdmin } from "../../../lib/auth";
import { findRows, appendRow, logAudit } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, username } = req.body;
  if (!documentId || !username) {
    return res.status(400).json({ error: "documentId dan username wajib diisi" });
  }

  const existing = await findRows(
    "Document_Access",
    (a) => a.documentId === documentId && a.userEmail === username
  );
  if (existing.length > 0) {
    return res.status(200).json({ success: true, alreadyGranted: true });
  }

  await appendRow("Document_Access", {
    documentId,
    userEmail: username,
    grantedBy: session.email,
    grantedAt: new Date().toISOString(),
  });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_GRANTED",
    detail: `to ${username}`,
  });

  return res.status(200).json({ success: true });
}
