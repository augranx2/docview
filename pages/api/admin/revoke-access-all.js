import { requireAdmin } from "../../../lib/auth";
import { deleteRows, logAudit } from "../../../lib/sheets";
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

  const deleted = await deleteRows("Document_Access", { documentId });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_REVOKED",
    detail: `from all (${deleted} akses)`,
  });

  return res.status(200).json({ success: true, deleted });
}

export default withErrorHandling(handler);
