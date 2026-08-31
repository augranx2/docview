import { requireDownloadAccess } from "../../../lib/auth";
import { findRows, logAudit } from "../../../lib/sheets";
import { downloadFileBuffer } from "../../../lib/googleDrive";

/**
 * Unlike stream.js (which serves pixels for the in-browser canvas viewer),
 * this endpoint hands back the actual PDF file with Content-Disposition:
 * attachment, so it's a real, saveable download. Only reachable by
 * Admin/Downloader roles — Viewer accounts get 403 even with a valid
 * session.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireDownloadAccess(req, res);
  if (!session) return;

  const { documentId } = req.query;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  const docs = await findRows("Documents", (d) => d.documentId === documentId);
  const doc = docs[0];
  if (!doc || doc.status !== "active") {
    return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  }

  // Admins can download anything active; Downloader accounts still need an
  // explicit Document_Access grant, same rule as viewing.
  if (session.role !== "Admin") {
    const access = await findRows(
      "Document_Access",
      (a) => a.documentId === documentId && a.userEmail === session.email
    );
    if (access.length === 0) {
      await logAudit({ userEmail: session.email, documentId, action: "ACCESS_DENIED" });
      return res.status(403).json({ error: "Anda tidak memiliki akses ke dokumen ini" });
    }
  }

  const buffer = await downloadFileBuffer(doc.driveFileId);

  const safeName = (doc.namaDokumen || "dokumen").replace(/[^a-zA-Z0-9 ._-]/g, "_");

  await logAudit({ userEmail: session.email, documentId, action: "DOWNLOAD" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(buffer);
}
