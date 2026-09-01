import fs from "fs";
import path from "path";
import { requireSession } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // 1. Verifikasi Sesi & Role Downloader/Admin
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ error: "Belum login" });

  const isDownloader = session.role === "downloader" || session.role === "admin";
  if (!isDownloader) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: "File ID diperlukan" });

  try {
    // 2. Load pdf-lib langsung via CDN (Tanpa npm install)
    const { PDFDocument } = await import("https://unpkg.com/pdf-lib/dist/pdf-lib.esm.js");

    // 3. Ambil Buffer PDF Asli (Sesuaikan dengan fungsi penyimpanan PDF Anda)
    // Contoh jika dari folder local atau google drive
    const pdfBuffer = await getFileBufferFromDrive(fileId); 

    // 4. Load PDF dan Logo Watermark
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const watermarkPath = path.join(process.cwd(), "public", "watermark-controlled.png");
    const watermarkBytes = fs.readFileSync(watermarkPath);
    const watermarkImage = await pdfDoc.embedPng(watermarkBytes);

    // Skala logo (0.35 = 35% ukuran asli)
    const { width: imgWidth, height: imgHeight } = watermarkImage.scale(0.35);

    // 5. Tempelkan Stempel CONTROLLED ke Setiap Halaman PDF
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();

      // Menempelkan di pojok kanan atas halaman
      page.drawImage(watermarkImage, {
        x: width - imgWidth - 25,
        y: height - imgHeight - 25,
        width: imgWidth,
        height: imgHeight,
        opacity: 0.85,
      });
    }

    // 6. Generate file PDF baru yang sudah ber-watermark
    const modifiedPdfBytes = await pdfDoc.save();

    // 7. Download PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CONTROLLED_${fileId}.pdf"`);
    return res.send(Buffer.from(modifiedPdfBytes));

  } catch (err) {
    return res.status(500).json({ error: "Gagal memproses watermark: " + err.message });
  }
}