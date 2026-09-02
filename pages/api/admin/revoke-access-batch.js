import { requireAdmin } from "../../../lib/auth";
import { deleteRowsBatch, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, usernames } = req.body;
  if (!documentId || !Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: "documentId dan usernames (minimal 1) wajib diisi" });
  }

  const matches = usernames.map((username) => ({ documentId, userEmail: username }));
  const deleted = await deleteRowsBatch("Document_Access", matches);

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_REVOKED",
    detail: `from ${usernames.join(", ")}`,
  });

  return res.status(200).json({ success: true, deleted });
}

export default withErrorHandling(handler);
