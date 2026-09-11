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
        <div
          onClick={tutup}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,11,23,0.55)",
            backdropFilter: "blur(3px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "white",
              borderRadius: 18,
              padding: "22px 22px 20px",
              boxShadow: "0 24px 48px -12px rgba(2,11,23,0.5)",
            }}
          >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
              Alasan pengunduhan
            </p>
            <p style={{ margin: "4px 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              Alasan ini akan <strong>tercetak pada berkas yang Anda unduh</strong> dan tercatat
              dalam audit trail.
            </p>

            {namaDokumen && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 11.5,
                  color: "#334155",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 9,
                  padding: "8px 10px",
                  wordBreak: "break-word",
                }}
              >
                📄 {namaDokumen}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {ALASAN_CEPAT.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={busy}
                  onClick={() => setAlasan(a)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: alasan === a ? "#eff6ff" : "white",
                    color: alasan === a ? "#1e4d8f" : "#64748b",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>

            <form onSubmit={unduh}>
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                disabled={busy}
                autoFocus
                rows={3}
                maxLength={160}
                placeholder="Contoh: Pelaksanaan proses produksi bets X-2411"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: `1px solid ${error ? "#fca5a5" : "#cbd5e1"}`,
                  borderRadius: 10,
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  color: "#0f172a",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10.5, color: error ? "#dc2626" : "#94a3b8" }}>
                  {error || "Wajib diisi"}
                </span>
                <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{alasan.length}/160</span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={tutup}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    flex: 2,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: busy ? "#94a3b8" : "#1e4d8f",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Menyiapkan berkas..." : "⬇ Unduh Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
