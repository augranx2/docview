import { findRows, notify } from "./sheets";

/**
 * Mengirim pemberitahuan yang menyebut nama dokumen, bukan hanya id-nya.
 *
 * Nama diambil sekali di sini supaya setiap endpoint tidak perlu mengulang
 * pencarian yang sama, dan bila dokumennya sudah tidak ada, pemberitahuan
 * tetap terkirim dengan keterangan seadanya.
 */
export async function notifyDocument(usernames, documentId, { type, title, suffix = "" }) {
  let nama = documentId;
  try {
    const docs = await findRows("Documents", (d) => d.documentId === documentId);
    if (docs[0]?.namaDokumen) nama = docs[0].namaDokumen;
  } catch {
    /* nama dokumen bersifat pelengkap — abaikan bila gagal diambil */
  }
  await notify(usernames, { type, title, detail: `${nama}${suffix}` });
}
