import { requireAdmin } from "../../../lib/auth";
import { deleteRows, logAudit } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, username } = req.body;
  if (!documentId || !username) {
    return res.status(400).json({ error: "documentId dan username wajib diisi" });
  }

  await deleteRows("Document_Access", { documentId, userEmail: username });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_REVOKED",
    detail: `from ${username}`,
  });

  return res.status(200).json({ success: true });
}
