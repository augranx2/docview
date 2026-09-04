import { requireAdmin, isDownloadFlagTrue } from "../../../lib/auth";
import { getAllRows, findRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const [documents, access] = await Promise.all([
    getAllRows("Documents"),
    getAllRows("Document_Access"),
  ]);

  const activeDocuments = documents.filter((d) => d.status === "active");

  const result = activeDocuments.map((doc) => ({
    ...doc,
    // Each entry is { username, canDownload } so the dashboard can show and
    // toggle per-user download permission, not just who has access.
    sharedTo: access
      .filter((a) => a.documentId === doc.documentId)
      .map((a) => ({
        username: a.userEmail,
        canDownload: isDownloadFlagTrue(a.canDownload),
      })),
  }));

  return res.status(200).json({ documents: result });
}

export default withErrorHandling(handler);
