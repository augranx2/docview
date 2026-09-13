import { requireAdmin } from "../../../lib/auth";
import { getAllRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Pemeriksaan cepat kesiapan fitur notifikasi.
 *
 * Dipakai saat pemberitahuan tidak muncul: endpoint ini membedakan tab yang
 * belum dibuat, Apps Script versi lama yang belum mengenal tab tersebut, dan
 * tab yang sudah benar namun memang masih kosong.
 */
async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  try {
    const rows = await getAllRows("Notifications");
    return res.status(200).json({
      siap: true,
      jumlahBaris: rows.length,
      contoh: rows.slice(-3),
      pesan:
        rows.length === 0
          ? "Tab Notifications sudah terbaca, tetapi masih kosong. Coba bagikan satu dokumen lalu periksa lagi."
          : `Tab Notifications terbaca dengan ${rows.length} baris.`,
    });
  } catch (err) {
    return res.status(200).json({
      siap: false,
      pesan: `Tab Notifications tidak terbaca: ${err.message}. Pastikan tab sudah dibuat DAN Apps Script sudah di-deploy sebagai versi baru.`,
    });
  }
}

export default withErrorHandling(handler);
