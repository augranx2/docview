import { v4 as uuidv4 } from "uuid";
import { requireSession, isDownloadFlagTrue } from "../../../lib/auth";
import { findRows, logAudit } from "../../../lib/sheets";
import { createViewToken } from "../../../lib/redis";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  // Admins can view anything active; regular users need an explicit
  // Document_Access grant. This is the single source of truth for access.
  // The same lookup also tells us whether this user may download this
  // particular document, so the viewer page can show or hide its download
  // button without a second round trip.
  let canDownload = true;
  if (session.role !== "Admin") {
    const access = await findRows(
      "Document_Access",
      (a) => a.documentId === documentId && a.userEmail === session.email
    );
    if (access.length === 0) {
      await logAudit({ userEmail: session.email, documentId, action: "ACCESS_DENIED" });
      return res.status(403).json({ error: "Anda tidak memiliki akses ke dokumen ini" });
    }
    canDownload = access.some((a) => isDownloadFlagTrue(a.canDownload));
  }

  const viewToken = uuidv4();
  await createViewToken(viewToken, { documentId, userEmail: session.email });

  await logAudit({ userEmail: session.email, documentId, action: "VIEW" });

  return res.status(200).json({ viewToken, canDownload });
}

export default withErrorHandling(handler);
