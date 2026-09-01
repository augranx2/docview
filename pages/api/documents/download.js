import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { requireSession } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ error: "Belum login" });

  const isDownloader = session.role === "downloader" || session.role === "admin";
  if (!isDownloader) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: "File ID diperlukan" });

  try {
    // Ambil Buffer PDF asli (sesuaikan dengan fungsi storage/gdrive Anda)
    const pdfBuffer = await getFileBufferFromDrive(fileId); 

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Load Logo Watermark dari folder public
    const watermarkPath = path.join(process.cwd(), "public", "watermark-controlled.png");
    
    // Cek apakah gambar watermark ada
    if (fs.existsSync(watermarkPath)) {
      const watermarkBytes = fs.readFileSync(watermarkPath);
      const watermarkImage = await pdfDoc.embedPng(watermarkBytes);
      const { width: imgWidth, height: imgHeight } = watermarkImage.scale(0.35);

      // Tempel watermark di pojok kanan atas tiap halaman
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

    // Simpan PDF yang sudah diberi watermark
    const modifiedPdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CONTROLLED_${fileId}.pdf"`);
    return res.send(Buffer.from(modifiedPdfBytes));

  } catch (err) {
    return res.status(500).json({ error: "Gagal memproses file: " + err.message });
  }
}