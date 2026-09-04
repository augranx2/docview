import { requireSession, isDownloadFlagTrue } from "../../../lib/auth";
import { findRows, getAllRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Each returned document carries a `canDownload` flag telling the frontend
 * whether to show the download button for THIS user on THIS document —
 * always true for Admin, and for a Viewer only when their Document_Access
 * row has the download permission ticked.
 */
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role === "Admin") {
    const docs = await findRows("Documents", (d) => d.status === "active");
    return res.status(200).json({ documents: docs.map((d) => ({ ...d, canDownload: true })) });
  }

  const access = await findRows("Document_Access", (a) => a.userEmail === session.email);
  const downloadableIds = new Set(
    access.filter((a) => isDownloadFlagTrue(a.canDownload)).map((a) => a.documentId)
  );
  const allowedIds = new Set(access.map((a) => a.documentId));
  const allDocs = await getAllRows("Documents");
  const docs = allDocs
    .filter((d) => d.status === "active" && allowedIds.has(d.documentId))
    .map((d) => ({ ...d, canDownload: downloadableIds.has(d.documentId) }));

  return res.status(200).json({ documents: docs });
}

export default withErrorHandling(handler);
