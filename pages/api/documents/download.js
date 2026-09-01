import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { requireSession } from "../../../lib/auth";
import { downloadFileBuffer } from "../../../lib/googleDrive";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ error: "Belum login" });

  const userRole = String(session.role || session.HakAkses || "").toLowerCase();
  const allowedRoles = ["admin", "downloader"];

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: "Akses ditolak: Anda tidak memiliki hak akses unduh" });
  }

  const id = req.query.documentId || req.query.fileId || req.query.id;
  if (!id) return res.status(400).json({ error: "ID Dokumen tidak ditemukan" });

  try {
    const pdfBuffer = await downloadFileBuffer(id);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const watermarkPath = path.join(process.cwd(), "public", "watermark-controlled.png");
    if (fs.existsSync(watermarkPath)) {
      const watermarkBytes = fs.readFileSync(watermarkPath);
      const watermarkImage = await pdfDoc.embedPng(watermarkBytes);
      const { width: imgWidth, height: imgHeight } = watermarkImage.scale(0.35);

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawImage(watermarkImage, {
          x: width - imgWidth - 25,
          y: height - imgHeight - 25,
          width: imgWidth,
          height: imgHeight,
          opacity: 0.85,
        });
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CONTROLLED_${id}.pdf"`);
    return res.send(Buffer.from(modifiedPdfBytes));

  } catch (err) {
    return res.status(500).json({ error: "Gagal memproses file: " + err.message });
  }
}