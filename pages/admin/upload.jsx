import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [kategori, setKategori] = useState("");
  const [allowedUsers, setAllowedUsers] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Pilih file PDF terlebih dahulu");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kategori", kategori);
    formData.append("allowedUsers", allowedUsers);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah dokumen");

      setMessage("Dokumen berhasil diunggah!");
      setFile(null);
      setKategori("");
      setAllowedUsers("");
      
      // Reset input file elemen
      const fileInput = document.getElementById("file-input");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", paddingBottom: 60 }}>
      
      {/* HEADER BAR */}
      <header style={{ height: 64, borderBottom: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-rama.png" alt="Logo" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0 }}>PT. Rama Emerald Multi Sukses</p>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>Sistem Dokumen Terkendali</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/admin/dashboard"
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
          >
            ← Kembali ke Dashboard
          </Link>
          <button
            onClick={handleLogout}
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        
        {/* KOP HEADER BERGRADASI */}
        <div style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #000000 0%, #1a0307 50%, #6b1826 100%)", padding: "28px 24px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                📤
              </div>
              <div>
                <span style={{ display: "inline-block", background: "rgba(244, 63, 94, 0.2)", border: "1px solid rgba(244, 63, 94, 0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#fecdd3", marginBottom: 6 }}>
                  Administrator Only
                </span>
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Upload Dokumen Baru</h1>
                <p style={{ fontSize: 12, color: "#fbcfe8", margin: "4px 0 0" }}>
                  Dokumen disimpan ke Google Drive dan dibagikan secara otomatis
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM UPLOAD */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* INPUT FILE */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                File Dokumen (PDF, Maks. 20MB)
              </label>
              <div style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: 20, textAlign: "center", background: "#f8fafc", cursor: "pointer", position: "relative" }}>
                <input
                  id="file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
                <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#8a1f2f" : "#475569" }}>
                  {file ? file.name : "Klik atau seret file PDF ke sini"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Format yang didukung: .pdf"}
                </div>
              </div>
            </div>

            {/* KATEGORI */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Kategori Dokumen (Opsional)
              </label>
              <input
                type="text"
                placeholder="misal: SOP, Prosedur, Denah, Format"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 13, outline: "none", color: "#0f172a" }}
              />
            </div>

            {/* HAK AKSES USER */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Izin Akses Pengguna
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan username/email user, pisahkan dengan koma (contoh: qc.udin, qa.anggara)"
                value={allowedUsers}
                onChange={(e) => setAllowedUsers(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 13, outline: "none", color: "#0f172a", fontFamily: "inherit", resize: "vertical" }}
              />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                Biarkan kosong jika dokumen boleh diakses oleh semua pengguna.
              </p>
            </div>

            {/* NOTIFIKASI */}
            {error && (
              <div style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
                ⚠️ {error}
              </div>
            )}
            {message && (
              <div style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
                ✓ {message}
              </div>
            )}

            {/* TOMBOL SUBMIT */}
            <button
              type="submit"
              disabled={uploading}
              style={{ padding: "12px", borderRadius: 12, background: uploading ? "#cbd5e1" : "#8a1f2f", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: uploading ? "not-allowed" : "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}
            >
              {uploading ? "Mengunggah Dokumen..." : "Upload Sekarang"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}