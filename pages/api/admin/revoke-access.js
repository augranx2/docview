import { requireAdmin } from "../../../lib/auth";
import { deleteRows, logAudit } from "../../../lib/sheets";
import { notifyDocument } from "../../../lib/notifyDoc";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, username } = req.body;
  if (!documentId || !username) {
    return res.status(400).json({ error: "documentId dan username wajib diisi" });
  }

  await deleteRows("Document_Access", { documentId, userEmail: username });

  await notifyDocument([username], documentId, {
    type: "akses-dicabut",
    title: "Akses Anda ke sebuah dokumen dicabut",
  });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_REVOKED",
    detail: `from ${username}`,
  });

  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
