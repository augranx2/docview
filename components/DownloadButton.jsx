import { useState } from "react";

/**
 * Tombol unduh dengan dialog alasan yang wajib diisi.
 *
 * Pengunduhan tidak lagi berupa tautan langsung, melainkan permintaan yang
 * membawa alasan. Berkas diterima sebagai blob lalu disimpan lewat tautan
 * sementara — cara ini memungkinkan aplikasi menampilkan pesan galat yang
 * terbaca bila permintaan ditolak, alih-alih membuka tab berisi JSON mentah
 * seperti yang terjadi pada tautan biasa.
 */
export default function DownloadButton({ documentId, namaDokumen, className, style, label = "⬇ Download" }) {
  const [open, setOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Lima keperluan yang paling sering dipakai. Tetap bisa diketik bebas —
  // pilihan cepat ini hanya pintasan, bukan pembatas.
  const ALASAN_CEPAT = [
    "Distribusi dokumen",
    "Registrasi",
    "Pelatihan",
    "Audit",
    "Revisi dokumen",
  ];

  function tutup() {
    if (busy) return;
    setOpen(false);
    setAlasan("");
    setError("");
  }

  async function unduh(e) {
    e.preventDefault();
    const bersih = alasan.trim();
    if (bersih.length < 5) {
      setError("Alasan wajib diisi, minimal 5 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/documents/download?documentId=${encodeURIComponent(documentId)}&alasan=${encodeURIComponent(bersih)}`
      );
      if (!res.ok) {
        let pesan = `Gagal mengunduh (status ${res.status}).`;
        try {
          const data = await res.json();
          if (data.error) pesan = data.error;
        } catch {
          /* balasan bukan JSON — pakai pesan bawaan di atas */
        }
        throw new Error(pesan);
      }

      // Nama berkas diambil dari header server supaya konsisten dengan
      // penamaan di Google Drive, bukan dikarang ulang di sisi peramban.
      const disposisi = res.headers.get("Content-Disposition") || "";
      const cocok = /filename\*=UTF-8''([^;]+)/.exec(disposisi) || /filename="([^"]+)"/.exec(disposisi);
      const namaFile = cocok ? decodeURIComponent(cocok[1]) : `${namaDokumen || "dokumen"}.pdf`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Ditunda sesaat: sebagian peramban membatalkan unduhan bila URL objek
      // dicabut tepat setelah klik.
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setOpen(false);
      setAlasan("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        {label}
      </button>

      {open && (
        <div className="modal" onClick={tutup}>
          <div className="modal__card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="card__title">Alasan mengunduh</div>
                <div className="card__sub">
                  Alasan ini tercetak pada berkas yang Anda unduh dan tercatat dalam rekam jejak.
                </div>
              </div>
              <button className="x" onClick={tutup} aria-label="Tutup">
                ✕
              </button>
            </div>

            <form className="modal__body stack" onSubmit={unduh}>
              {namaDokumen && (
                <p className="tag" style={{ maxWidth: "100%", whiteSpace: "normal", textAlign: "left" }}>
                  {namaDokumen}
                </p>
              )}

              <div className="row" style={{ gap: 6 }}>
                {ALASAN_CEPAT.map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy}
                    onClick={() => setAlasan(a)}
                    className={`who-chip${alasan === a ? " who-chip--on" : ""}`}
                  >
                    {a}
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  className={`textarea${error ? " input--bad" : ""}`}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  disabled={busy}
                  autoFocus
                  rows={3}
                  maxLength={160}
                  placeholder="Contoh: Distribusi dokumen ke Bagian Produksi"
                />
                <div className="row row--between" style={{ marginTop: 4 }}>
                  <span className="hint" style={{ color: error ? "var(--danger)" : undefined }}>
                    {error || "Wajib diisi"}
                  </span>
                  <span className="hint">{alasan.length}/160</span>
                </div>
              </div>

              <div className="row" style={{ flexWrap: "nowrap" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={tutup} disabled={busy}>
                  Batal
                </button>
                <button type="submit" className="btn btn--primary" style={{ flex: 2 }} disabled={busy}>
                  {busy ? "Menyiapkan berkas..." : "Unduh sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
