import { v4 as uuidv4 } from "uuid";
import { requireAdmin } from "../../../lib/auth";
import { createResumableUploadSession } from "../../../lib/googleDrive";
import { appendRow } from "../../../lib/sheets";

const MAX_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 20 * 1024 * 1024);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return; // requireAdmin already sent the response

  const { fileName, mimeType, fileSize, kategori } = req.body;

  if (!fileName || !mimeType || !fileSize) {
    return res.status(400).json({ error: "fileName, mimeType, fileSize wajib diisi" });
  }
  if (mimeType !== "application/pdf") {
    return res.status(400).json({ error: "Hanya file PDF yang diperbolehkan" });
  }
  if (fileSize > MAX_SIZE) {
    return res.status(400).json({ error: "Ukuran file melebihi 20MB" });
  }

  const documentId = uuidv4();
  const driveFileName = `${documentId}.pdf`;

  let resumableSessionUrl;
  try {
    resumableSessionUrl = await createResumableUploadSession({
      fileName: driveFileName,
      mimeType,
      fileSize,
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Gagal membuat sesi upload ke Google Drive" });
  }

  await appendRow("Documents", {
    documentId,
    namaDokumen: fileName,
    kategori: kategori || "",
    driveFileId: "",
    uploadedBy: session.email,
    uploadedAt: new Date().toISOString(),
    status: "pending",
  });

  return res.status(200).json({ documentId, resumableSessionUrl });
}
