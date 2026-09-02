import { requireAdmin } from "../../../lib/auth";
import { updateRowByKey, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, kategori } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  await updateRowByKey("Documents", "documentId", documentId, {
    kategori: (kategori || "").trim(),
  });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "DOCUMENT_UPDATED",
    detail: `kategori diubah ke "${(kategori || "").trim() || "(kosong)"}"`,
  });

  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
