import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedUser, setPickedUser] = useState({});
  const [busyDoc, setBusyDoc] = useState(null);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [docsRes, usersRes] = await Promise.all([
        fetch("/api/admin/documents"),
        fetch("/api/admin/users"),
      ]);
      const docsData = await docsRes.json();
      const usersData = await usersRes.json();
      if (!docsRes.ok) throw new Error(docsData.error || "Gagal memuat dokumen");
      if (!usersRes.ok) throw new Error(usersData.error || "Gagal memuat user");
      setDocuments(docsData.documents || []);
      setUsers(usersData.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  async function handleGrant(documentId) {
    const username = pickedUser[documentId];
    if (!username) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/grant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah akses");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  async function handleRevoke(documentId, username) {
    if (!confirm(`Akhiri akses ${username} ke dokumen ini?`)) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/revoke-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengakhiri akses");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  async function handleDelete(documentId, namaDokumen) {
    if (!confirm(`Hapus permanen "${namaDokumen}"? File akan dihapus dari Google Drive juga.`)) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/delete-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus dokumen");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      doc.namaDokumen.toLowerCase().includes(q) ||
      (doc.kategori || "").toLowerCase().includes(q) ||
      doc.sharedTo.some((u) => u.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", paddingBottom: 60 }}>
      
      {/* HEADER BAR ADMIN */}
      <header style={{ height: 64, borderBottom: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-rama.png" alt="Logo" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0 }}>PT. Rama Emerald Multi Sukses</p>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>Panel Kontrol Administrator</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/viewer"
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
          >
            ← Lihat Mode User
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {loggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA ADMIN */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px" }}>
        
        {/* KOP HEADER BERGRADASI ADMIN */}
        <div style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #000000 0%, #1a0307 50%, #6b1826 100%)", padding: "28px 24px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <img src="/logo-rama.png" alt="Logo" style={{ height: 44, width: 44, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <div>
                  <span style={{ display: "inline-block", background: "rgba(244, 63, 94, 0.2)", border: "1px solid rgba(244, 63, 94, 0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#fecdd3", marginBottom: 6 }}>
                    ⚙️ Panel Administrator
                  </span>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard Kelola Dokumen</h1>
                  <p style={{ fontSize: 12, color: "#fbcfe8", margin: "4px 0 0" }}>Unggah dokumen baru, atur hak akses user, dan pantau arsip terkendali</p>
                </div>
              </div>

              <Link
                href="/admin/upload"
                style={{ padding: "10px 18px", borderRadius: 12, background: "white", color: "#8a1f2f", fontSize: 12, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
              >
                + Upload Dokumen Baru
              </Link>
            </div>
          </div>
        </div>

        {/* KOTAK PENCARIAN */}
        {!loading && documents.length > 0 && (
          <div style={{ position: "relative", marginBottom: 20 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
            <input
              type="text"
              style={{ width: "100%", padding: "11px 14px 11px 38px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, background: "white", color: "#0f172a", outline: "none", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
              placeholder="Cari nama dokumen, kategori, atau username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {loading && <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 40 }}>Memuat data dokumen...</p>}
        {error && <p style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>{error}</p>}

        {/* DAFTAR KARTU DOKUMEN ADMIN */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredDocuments.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "48px 20px", fontSize: 13, background: "white", borderRadius: 20, border: "1px dashed #cbd5e1" }}>
                {documents.length === 0 ? "Belum ada dokumen yang diupload." : "Tidak ada dokumen yang cocok dengan pencarian."}
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const availableUsers = users.filter((u) => !doc.sharedTo.includes(u.username));
                const isBusy = busyDoc === doc.documentId;

                return (
                  <div key={doc.documentId} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)", padding: 20, opacity: isBusy ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{doc.namaDokumen}</div>
                        {doc.kategori && (
                          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "#8a1f2f", background: "#fdf2f2", borderRadius: 6, padding: "2px 8px", marginTop: 6, border: "1px solid #f9dade" }}>
                            {doc.kategori}
                          </span>
                        )}
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                          Diupload {new Date(doc.uploadedAt).toLocaleString("id-ID")} oleh <b>{doc.uploadedBy}</b>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <Link
                          href={`/viewer/${doc.documentId}`}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                        >
                          Lihat
                        </Link>
                        <a
                          href={`/api/documents/download?documentId=${doc.documentId}`}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                          title="Download file asli"
                        >
                          ⬇
                        </a>
                        <button
                          disabled={isBusy || doc.sharedTo.length > 0}
                          onClick={() => handleDelete(doc.documentId, doc.namaDokumen)}
                          title={doc.sharedTo.length > 0 ? "Akhiri semua share dulu sebelum menghapus" : "Hapus dokumen permanen"}
                          style={{ background: "transparent", border: "none", color: doc.sharedTo.length > 0 ? "#94a3b8" : "#dc2626", fontSize: 13, fontWeight: 600, cursor: doc.sharedTo.length > 0 ? "not-allowed" : "pointer", padding: "6px 4px" }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "16px 0" }} />

                    {/* DAFTAR USER YANG DIBAGIKAN */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                        Dibagikan ke ({doc.sharedTo.length} user)
                      </div>
                      {doc.sharedTo.length === 0 && (
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontStyle: "italic" }}>
                          Belum dibagikan ke siapa pun.
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {doc.sharedTo.map((username) => (
                          <span key={username} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fdf2f2", color: "#8a1f2f", border: "1px solid #f9dade", borderRadius: 999, padding: "3px 8px 3px 12px", fontSize: 12, fontWeight: 500 }}>
                            {username}
                            <button
                              disabled={isBusy}
                              onClick={() => handleRevoke(doc.documentId, username)}
                              title="Akhiri akses"
                              style={{ border: "none", background: "#f9dade", color: "#8a1f2f", width: 16, height: 16, borderRadius: "50%", fontSize: 11, lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* TAMBAH AKSES USER */}
                    {availableUsers.length > 0 && (
                      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                        <select
                          disabled={isBusy}
                          value={pickedUser[doc.documentId] || ""}
                          onChange={(e) => setPickedUser((prev) => ({ ...prev, [doc.documentId]: e.target.value }))}
                          style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "white", outline: "none" }}
                        >
                          <option value="">Pilih user untuk ditambahkan akses...</option>
                          {availableUsers.map((u) => (
                            <option key={u.username} value={u.username}>
                              {u.nama} ({u.username}) — {u.role}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={isBusy || !pickedUser[doc.documentId]}
                          onClick={() => handleGrant(doc.documentId)}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #8a1f2f", background: "#8a1f2f", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Tambah
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}