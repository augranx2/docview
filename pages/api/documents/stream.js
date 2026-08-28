import { getViewToken } from "../../../lib/redis";
import { findRows } from "../../../lib/sheets";
import { downloadFileBuffer } from "../../../lib/googleDrive";

/**
 * Serves the raw PDF bytes ONLY to a request carrying a valid, unexpired
 * view token (see request-view.js). The frontend never gets a Drive link —
 * it fetches this endpoint via JS and renders pages into <canvas> with
 * pdf.js, so there's no direct "open/save" browser PDF view of the file.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token wajib diisi" });

  const viewData = await getViewToken(token);
  if (!viewData) {
    return res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa" });
  }

  const docs = await findRows("Documents", (d) => d.documentId === viewData.documentId);
  const doc = docs[0];
  if (!doc || doc.status !== "active") {
    return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  }

  const buffer = await downloadFileBuffer(doc.driveFileId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Content-Disposition", "inline"); // no filename hint, discourages "Save As"
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(buffer);
}
