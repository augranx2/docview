import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function DocumentListPage() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState({ role: null, nama: "", username: "" });
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents/list")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setDocs(data.documents || []);
      })
      .catch(() => setError("Gagal memuat daftar dokumen"))
      .finally(() => setLoading(false));

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setUser({ role: me?.role || null, nama: me?.nama || "", username: me?.email || "" }))
      .catch(() => {});
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  const canDownload = user.role === "Admin" || user.role === "Downloader";
  const isAdmin = user.role === "Admin";

  const filtered = docs.filter((doc) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      doc.namaDokumen.toLowerCase().includes(q) ||
      (doc.kategori || "").toLowerCase().includes(q)
    );
  });

  const avatarLetter = (user.nama || user.username || "U").charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", paddingBottom: 60 }}>
      
      {/* HEADER BAR KELAS ATAS (Gaya EM Non Viable) */}
      <header style={{ height: 64, borderBottom: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-rama.png" alt="Logo" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0 }}>PT. Rama Emerald Multi Sukses</p>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>Sistem Dokumen Terkendali</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f1f5f9", padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#334155" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#8a1f2f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold" }}>
              {avatarLetter}
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{user.nama || user.username || "User"}</div>
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{user.role || "User"}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {loggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px" }}>
        
        {/* KOP HEADER BERGRADASI HITAM KE MAROON */}
        <div style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #000000 0%, #1a0307 50%, #6b1826 100%)", padding: "28px 24px", color: "white", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <img src="/logo-rama.png" alt="Logo" style={{ height: 44, width: 44, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <div>
                  <span style={{ display: "inline-block", background: "rgba(244, 63, 94, 0.2)", border: "1px solid rgba(244, 63, 94, 0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#fecdd3", marginBottom: 6 }}>
                    ✓ Dokumen Resmi Kantor
                  </span>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dokumen Saya</h1>
                  <p style={{ fontSize: 12, color: "#fbcfe8", margin: "4px 0 0" }}>
                    {isAdmin ? "Akses penuh Administrator & daftar dokumen terkendali" : user.role === "Downloader" ? "Akses dokumen dengan izin unduh file asli" : "Akses khusus lihat dokumen (Read-Only)"}
                  </p>
                </div>
              </div>

              {/* TOMBOL KHUSUS ADMIN */}
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  style={{ padding: "9px 16px", borderRadius: 12, background: "white", color: "#8a1f2f", fontSize: 12, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                >
                  ⚙️ Buka Dashboard Admin
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* KOTAK PENCARIAN */}
        {!loading && docs.length > 0 && (
          <div style={{ position: "relative", marginBottom: 20 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
            <input
              type="text"
              style={{ width: "100%", padding: "11px 14px 11px 38px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, background: "white", color: "#0f172a", outline: "none", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
              placeholder="Cari nama dokumen atau kategori..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {/* STATUS LOADING / ERROR */}
        {loading && <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 40 }}>Memuat daftar dokumen...</p>}
        {error && <p style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>{error}</p>}

        {/* DAFTAR DOKUMEN BERDASARKAN ROLE */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "48px 20px", fontSize: 13, background: "white", borderRadius: 20, border: "1px dashed #cbd5e1" }}>
                {docs.length === 0 ? "Belum ada dokumen yang dibagikan ke Anda." : "Tidak ada dokumen yang cocok dengan pencarian."}
              </div>
            ) : (
              filtered.map((doc) => (
                <div
                  key={doc.documentId}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", background: "white", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)", transition: "all 0.15s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fdf2f2", color: "#8a1f2f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      📄
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {doc.namaDokumen}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {doc.kategori && (
                          <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6 }}>
                            {doc.kategori}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          Diupload: {new Date(doc.uploadedAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Tombol Lihat (Berlaku untuk semua role: Admin, Downloader, Viewer) */}
                    <Link
                      href={`/viewer/${doc.documentId}`}
                      style={{ padding: "8px 16px", borderRadius: 10, background: "#0f172a", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}
                    >
                      Lihat
                    </Link>

                    {/* Tombol Download HANYA MUNCUL untuk Admin & Downloader */}
                    {canDownload && (
                      <a
                        href={`/api/documents/download?documentId=${doc.documentId}`}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                        title="Download file asli"
                      >
                        ⬇ Download
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}