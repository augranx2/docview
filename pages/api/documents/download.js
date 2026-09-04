import { requireSession, isDownloadFlagTrue } from "../../../lib/auth";
import { findRows, logAudit } from "../../../lib/sheets";
import { downloadFileBuffer } from "../../../lib/googleDrive";
import { addControlledWatermark } from "../../../lib/watermark";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Unlike stream.js (which serves bytes for the in-browser canvas viewer),
 * this endpoint hands back the actual PDF file with Content-Disposition:
 * attachment, so it's a real, saveable download.
 *
 * Permission model: Admin can download anything. A Viewer can download only
 * a document that was shared to them WITH the download box ticked — i.e.
 * their Document_Access row for that document has canDownload = TRUE.
 * Being shared a document alone is never enough.
 */
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { documentId } = req.query;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  const docs = await findRows("Documents", (d) => d.documentId === documentId);
  const doc = docs[0];
  if (!doc || doc.status !== "active") {
    return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  }

  if (session.role !== "Admin") {
    const access = await findRows(
      "Document_Access",
      (a) => a.documentId === documentId && a.userEmail === session.email
    );
    if (access.length === 0) {
      await logAudit({ userEmail: session.email, documentId, action: "ACCESS_DENIED" });
      return res.status(403).json({ error: "Anda tidak memiliki akses ke dokumen ini" });
    }
    if (!access.some((a) => isDownloadFlagTrue(a.canDownload))) {
      await logAudit({
        userEmail: session.email,
        documentId,
        action: "ACCESS_DENIED",
        detail: "Download tanpa izin",
      });
      return res.status(403).json({
        error: "Dokumen ini dibagikan untuk dilihat saja. Minta izin download ke Administrator.",
      });
    }
  }

  const buffer = await downloadFileBuffer(doc.driveFileId);

  const origin = req.headers.origin || `https://${req.headers.host}`;

  // Stamp identifies the downloader on the copy being sent right now. Time
  // is rendered in WIB explicitly — the serverless function runs in UTC, so
  // formatting without a fixed timeZone would put the wrong hour on the file.
  const userLabel = session.nama ? `${session.nama} (${session.email})` : session.email;
  const timeLabel = `${new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;

  let watermarkedBuffer;
  try {
    watermarkedBuffer = await addControlledWatermark(buffer, origin, {
      userLabel,
      timeLabel,
    });
  } catch (err) {
    console.error("Watermark failed, sending original file instead:", err);
    watermarkedBuffer = buffer; // fail safe: still let the download through
  }

  const safeName = (doc.namaDokumen || "dokumen").replace(/[^a-zA-Z0-9 ._-]/g, "_");

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "DOWNLOAD",
    detail: timeLabel,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(Buffer.from(watermarkedBuffer));
}

export default withErrorHandling(handler);
