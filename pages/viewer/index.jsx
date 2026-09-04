import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function DocumentListPage() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null); // null = semua kategori
  const [sortBy, setSortBy] = useState("newest"); // newest | oldest | name-asc | name-desc
  const [user, setUser] = useState({ role: null, nama: "", username: "" });
  const [loggingOut, setLoggingOut] = useState(false);
  
  // State Modal Profil, Ganti Password, & Audit Trail
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

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
      .then((me) => setUser({ role: me?.role || null, nama: me?.nama || me?.email || "", username: me?.email || "" }))
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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPassError("");
    setPassMsg("");
    setChangingPass(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah password");
      setPassMsg("Password berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassMsg("");
      }, 1500);
    } catch (err) {
      setPassError(err.message);
    } finally {
      setChangingPass(false);
    }
  }

  async function fetchAuditLogs() {
    setShowAuditModal(true);
    setLoadingAudit(true);
    try {
      const res = await fetch("/api/admin/audit-log");
      const data = await res.json();
      if (res.ok) setAuditLogs(data.logs || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  }

  // Download is no longer decided by role — each document carries its own
  // canDownload flag for this user, set by the Admin when sharing it.
  const isAdmin = user.role === "Admin";

  const UNCATEGORIZED = "Tanpa Kategori";
  const categoryCounts = docs.reduce((acc, doc) => {
    const key = doc.kategori || UNCATEGORIZED;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const categoryList = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));

  const filtered = docs
    .filter((doc) => {
      if (selectedCategory && (doc.kategori || UNCATEGORIZED) !== selectedCategory) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        doc.namaDokumen.toLowerCase().includes(q) ||
        (doc.kategori || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.uploadedAt) - new Date(b.uploadedAt);
        case "name-asc":
          return a.namaDokumen.localeCompare(b.namaDokumen);
        case "name-desc":
          return b.namaDokumen.localeCompare(a.namaDokumen);
        case "newest":
        default:
          return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      }
    });

  const avatarLetter = (user.nama || user.username || "U").charAt(0).toUpperCase();

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
          {/* KOTAK PROFIL YANG BISA DIKLIK */}
          <div
            onClick={() => setShowProfileModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#f1f5f9", padding: "6px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", border: "1px solid #cbd5e1" }}
            title="Klik untuk melihat Detail Profil"
          >
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "#8a1f2f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
              {avatarLetter}
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{user.nama || user.username || "User"}</div>
              <div style={{ fontSize: 9, color: "#8a1f2f", textTransform: "uppercase", fontWeight: 700 }}>{user.role || "User"}</div>
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
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px" }}>
        
        {/* KOP HEADER BERGRADASI */}
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
                    {isAdmin
                      ? "Akses penuh Administrator & daftar dokumen terkendali"
                      : "Dokumen yang dibagikan ke Anda — sebagian mungkin diberi izin unduh oleh Administrator"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isAdmin && (
                  <>
                    <button
                      onClick={fetchAuditLogs}
                      style={{ padding: "9px 14px", borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      📋 Audit Trail
                    </button>
                    <Link
                      href="/admin/dashboard"
                      style={{ padding: "9px 16px", borderRadius: 12, background: "white", color: "#8a1f2f", fontSize: 12, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                    >
                      ⚙️ Dashboard Admin
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LAYOUT SIDEBAR + KONTEN */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* SIDEBAR KATEGORI */}
          {!loading && docs.length > 0 && (
            <div
              style={{
                width: 220,
                flexShrink: 0,
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 10,
                position: "sticky",
                top: 84,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px 6px" }}>
                Kategori
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: selectedCategory === null ? "#8a1f2f" : "transparent",
                  color: selectedCategory === null ? "white" : "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <span>📋 Semua Dokumen</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{docs.length}</span>
              </button>

              {categoryList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "none",
                    background: selectedCategory === cat ? "#8a1f2f" : "transparent",
                    color: selectedCategory === cat ? "white" : "#334155",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat === UNCATEGORIZED ? "🗂 " : "📁 "}
                    {cat}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.85, flexShrink: 0, marginLeft: 6 }}>{categoryCounts[cat]}</span>
                </button>
              ))}
            </div>
          )}

          {/* AREA KONTEN DOKUMEN */}
          <div style={{ flex: 1, minWidth: 0 }}>

        {/* PENCARIAN + SORT */}
        {!loading && docs.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
              <input
                type="text"
                style={{ width: "100%", padding: "11px 14px 11px 38px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, background: "white", color: "#0f172a", outline: "none", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                placeholder="Cari nama dokumen atau kategori..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Urutkan dokumen"
              style={{ padding: "0 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <option value="newest">↓ Terbaru Diupload</option>
              <option value="oldest">↑ Terlama Diupload</option>
              <option value="name-asc">A → Z Nama Dokumen</option>
              <option value="name-desc">Z → A Nama Dokumen</option>
            </select>
          </div>
        )}

        {loading && <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 40 }}>Memuat daftar dokumen...</p>}
        {error && <p style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>{error}</p>}

        {/* DAFTAR DOKUMEN */}
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
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", background: "white", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
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
                    <Link
                      href={`/viewer/${doc.documentId}`}
                      style={{ padding: "8px 16px", borderRadius: 10, background: "#0f172a", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                    >
                      Lihat
                    </Link>

                    {doc.canDownload ? (
                      <a
                        href={`/api/documents/download?documentId=${doc.documentId}`}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                        title="Download file asli"
                      >
                        ⬇ Download
                      </a>
                    ) : (
                      <span
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1px dashed #e2e8f0", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                        title="Dokumen ini dibagikan untuk dilihat saja"
                      >
                        👁 Lihat saja
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

          </div>
          {/* /AREA KONTEN DOKUMEN */}
        </div>
        {/* /LAYOUT SIDEBAR + KONTEN */}
      </div>

      {/* MODAL PROFIL */}
      {showProfileModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" }}>
          <div style={{ width: "100%", maxWidth: 380, background: "white", borderRadius: 24, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8a1f2f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold" }}>
                {avatarLetter}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: 0 }}>Profil Pengguna</h3>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Informasi akun aktif Anda</p>
              </div>
            </div>

            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Nama Lengkap</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{user.nama || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Username</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{user.username || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Hak Akses (Role)</span>
                <span style={{ fontWeight: 700, color: "#8a1f2f", background: "#fdf2f2", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
                  {user.role || "—"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowPasswordModal(true);
                }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                🔑 Ganti Password
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#0f172a", color: "white", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GANTI PASSWORD */}
      {showPasswordModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" }}>
          <div style={{ width: "100%", maxWidth: 380, background: "white", borderRadius: 24, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>Ganti Password</h3>
            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>Masukkan password lama dan password baru Anda</p>

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Password Lama</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Password Baru (Min. 6 Karakter)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none" }}
                />
              </div>

              {passError && <p style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", padding: 8, borderRadius: 8 }}>{passError}</p>}
              {passMsg && <p style={{ color: "#16a34a", fontSize: 12, background: "#f0fdf4", padding: 8, borderRadius: 8 }}>{passMsg}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={changingPass}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, background: "#8a1f2f", color: "white", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
                >
                  {changingPass ? "Menyimpan..." : "Simpan Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDIT TRAIL */}
      {showAuditModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" }}>
          <div style={{ width: "100%", maxWidth: 700, background: "white", borderRadius: 24, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: 0 }}>Audit Trail (Rekam Jejak Aktivitas)</h3>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Catatan aktivitas login, view, dan manajemen dokumen</p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                style={{ border: "none", background: "#f1f5f9", width: 30, height: 30, borderRadius: "50%", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: 12 }}>
              {loadingAudit ? (
                <p style={{ textAlign: "center", color: "#64748b", padding: 30 }}>Memuat log aktivitas...</p>
              ) : auditLogs.length === 0 ? (
                <p style={{ textAlign: "center", color: "#64748b", padding: 30 }}>Belum ada data audit log.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {auditLogs.map((log, idx) => (
                    <div key={idx} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: "#1e293b" }}>{log.userEmail || "Sistem"}</span>
                          <span style={{ fontSize: 10, background: "#fdf2f2", color: "#8a1f2f", border: "1px solid #f9dade", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                            {log.action}
                          </span>
                        </div>
                        {log.detail && <div style={{ color: "#475569", fontSize: 11 }}>{log.detail}</div>}
                        {log.documentId && <div style={{ color: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}>DocID: {log.documentId}</div>}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 10, whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleString("id-ID")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: 16, textAlign: "right" }}>
              <button
                onClick={() => setShowAuditModal(false)}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#0f172a", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}