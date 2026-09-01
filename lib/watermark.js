import { PDFDocument } from "pdf-lib";

/**
 * Stamps public/watermark-controlled.png onto every page of a PDF, in the
 * bottom-right corner at a proportional size/margin. Used only by the download endpoint — the in-browser
 * canvas viewer has its own separate (dynamic text) watermark and is not
 * affected by this.
 *
 * Fetches the seal image from this same deployment's own /public folder at
 * runtime via HTTP, rather than reading it from disk — Vercel's serverless
 * function file-bundling doesn't reliably include files under /public
 * unless referenced in a way its tracer can follow, so fetching our own
 * already-served static asset sidesteps that entirely.
 */
export async function addControlledWatermark(pdfBuffer, origin) {
  const imgRes = await fetch(`${origin}/watermark-controlled.png`);
  if (!imgRes.ok) throw new Error("Gagal memuat gambar watermark");
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const sealImage = await pdfDoc.embedPng(imgBytes);

  const SEAL_WIDTH_RATIO = 0.16; // seal width relative to each page's width — smaller since it's a corner mark now
  const MARGIN_RATIO = 0.03; // margin from the page edge, relative to page width
  const OPACITY = 0.55;

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const sealWidth = width * SEAL_WIDTH_RATIO;
    const sealHeight = sealWidth * (sealImage.height / sealImage.width);
    const margin = width * MARGIN_RATIO;
    page.drawImage(sealImage, {
      x: width - sealWidth - margin,
      y: margin,
      width: sealWidth,
      height: sealHeight,
      opacity: OPACITY,
    });
  }

  return pdfDoc.save();
}
