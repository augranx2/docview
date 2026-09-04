import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * The standard PDF fonts only cover WinAnsi, so any character outside it
 * (curly quotes, an en dash pasted from Word, emoji in a name) makes
 * pdf-lib throw mid-draw. Names come from a spreadsheet typed by hand, so
 * that's a real risk — strip anything unencodable rather than lose the
 * whole download to it.
 */
function toWinAnsiSafe(text) {
  return String(text || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/**
 * Stamps public/watermark-controlled.png onto every page of a PDF in the
 * bottom-right corner, plus two lines of text just above it recording WHO
 * downloaded the file and WHEN. Used only by the download endpoint — the
 * in-browser canvas viewer has its own separate (tiled, dynamic) watermark
 * and is not affected by this.
 *
 * The stamp is applied to the copy being sent right now; the original file
 * in Google Drive is never modified. Two people downloading the same
 * document therefore get two differently-stamped copies, so a leaked file
 * traces back to whoever downloaded it.
 *
 * Fetches the seal image from this same deployment's own /public folder at
 * runtime via HTTP, rather than reading it from disk — Vercel's serverless
 * function file-bundling doesn't reliably include files under /public
 * unless referenced in a way its tracer can follow, so fetching our own
 * already-served static asset sidesteps that entirely.
 */
export async function addControlledWatermark(pdfBuffer, origin, stampInfo = {}) {
  const imgRes = await fetch(`${origin}/watermark-controlled.png`);
  if (!imgRes.ok) throw new Error("Gagal memuat gambar watermark");
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const sealImage = await pdfDoc.embedPng(imgBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const SEAL_WIDTH_RATIO = 0.16; // seal width relative to each page's width
  const MARGIN_RATIO = 0.03; // margin from the page edge, relative to page width
  const OPACITY = 0.55;
  const TEXT_OPACITY = 0.7;
  const TEXT_COLOR = rgb(0.12, 0.30, 0.56); // matches the app's blue accent

  const lines = [
    toWinAnsiSafe(stampInfo.userLabel ? `Diunduh oleh: ${stampInfo.userLabel}` : ""),
    toWinAnsiSafe(stampInfo.timeLabel || ""),
  ].filter(Boolean);

  for (const page of pdfDoc.getPages()) {
    const { width } = page.getSize();
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

    // Text sits directly above the seal, right-aligned to the same edge, so
    // the block reads as one unit no matter the page size.
    const fontSize = Math.max(6, Math.min(9, width * 0.013));
    const lineGap = fontSize * 1.35;
    let y = margin + sealHeight + fontSize * 0.8;

    for (const line of [...lines].reverse() /* draw bottom-up */) {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, {
        x: width - margin - textWidth,
        y,
        size: fontSize,
        font,
        color: TEXT_COLOR,
        opacity: TEXT_OPACITY,
      });
      y += lineGap;
    }
  }

  return pdfDoc.save();
}
