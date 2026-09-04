import { requireAdmin } from "../../../lib/auth";
import { updateRowsByMatch, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Turns the download permission on or off for one user on one document,
 * by flipping the canDownload flag on their existing Document_Access row.
 * Access itself is untouched — the user keeps being able to view either way.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, usernames, canDownload } = req.body;
  if (!documentId || !Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: "documentId dan usernames (minimal 1) wajib diisi" });
  }

  // Blank means "view only" — the flag is only ever written as TRUE, and
  // revoking it clears the cell rather than writing FALSE, so the sheet stays
  // readable at a glance (only the download-allowed rows are marked).
  const value = canDownload ? "TRUE" : "";
  let updated = 0;
  for (const username of usernames) {
    updated += await updateRowsByMatch(
      "Document_Access",
      { documentId, userEmail: username },
      { canDownload: value }
    );
  }

  if (updated === 0) {
    return res.status(404).json({ error: "Baris akses tidak ditemukan untuk user tersebut" });
  }

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "DOWNLOAD_PERMISSION_CHANGED",
    detail: `${canDownload ? "Izinkan" : "Cabut"} download untuk ${usernames.join(", ")}`,
  });

  return res.status(200).json({ success: true, updated });
}

export default withErrorHandling(handler);
