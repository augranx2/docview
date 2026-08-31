import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedUser, setPickedUser] = useState({}); // { [documentId]: username }
  const [busyDoc, setBusyDoc] = useState(null);
  const [query, setQuery] = useState("");

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
    if (
      !confirm(
        `Hapus permanen "${namaDokumen}"? File akan dihapus dari Google Drive juga. Tindakan ini tidak bisa dibatalkan.`
      )
    )
      return;
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
    <div className="page">
      <div className="topbar">
        <div>
          <h1 className="page-title">Dashboard Dokumen</h1>
          <p className="page-subtitle">Kelola dokumen dan akses berbagi</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/admin/upload" className="btn btn-primary btn-sm">
            + Upload Dokumen
          </Link>
          <LogoutButton />
        </div>
      </div>

      {!loading && documents.length > 0 && (
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input search-input"
            placeholder="Cari nama dokumen, kategori, atau username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading && <p className="muted">Memuat...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading &&
        filteredDocuments.map((doc) => {
          const availableUsers = users.filter((u) => !doc.sharedTo.includes(u.username));
          const isBusy = busyDoc === doc.documentId;

          return (
            <div key={doc.documentId} className="card" style={{ opacity: isBusy ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div className="doc-row-name" style={{ fontSize: 15 }}>
                    {doc.namaDokumen}
                  </div>
                  {doc.kategori && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 12,
                        color: "var(--blue-700)",
                        background: "var(--blue-50)",
                        borderRadius: 6,
                        padding: "2px 8px",
                        marginTop: 6,
                      }}
                    >
                      {doc.kategori}
                    </span>
                  )}
                  <div className="muted" style={{ marginTop: 6 }}>
                    Diupload {new Date(doc.uploadedAt).toLocaleString("id-ID")} oleh{" "}
                    {doc.uploadedBy}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0 }}>
                  <Link
                    href={`/viewer/${doc.documentId}`}
                    className="btn btn-outline btn-sm"
                    title="Lihat dokumen"
                  >
                    Lihat
                  </Link>
                  <a
                    href={`/api/documents/download?documentId=${doc.documentId}`}
                    className="btn btn-outline btn-sm"
                    title="Download file asli"
                  >
                    ⬇
                  </a>
                  <button
                    disabled={isBusy || doc.sharedTo.length > 0}
                    onClick={() => handleDelete(doc.documentId, doc.namaDokumen)}
                    title={
                      doc.sharedTo.length > 0
                        ? "Akhiri semua share dulu sebelum menghapus"
                        : "Hapus dokumen permanen"
                    }
                    className="btn-danger-text"
                    style={{ fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <hr className="divider" />

              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  Dibagikan ke ({doc.sharedTo.length})
                </div>
                {doc.sharedTo.length === 0 && (
                  <div className="muted" style={{ marginBottom: 10 }}>
                    Belum dibagikan ke siapa pun.
                  </div>
                )}
                <div>
                  {doc.sharedTo.map((username) => (
                    <span key={username} className="chip">
                      {username}
                      <button
                        disabled={isBusy}
                        onClick={() => handleRevoke(doc.documentId, username)}
                        title="Akhiri akses"
                        className="chip-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {availableUsers.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <select
                    disabled={isBusy}
                    value={pickedUser[doc.documentId] || ""}
                    onChange={(e) =>
                      setPickedUser((prev) => ({ ...prev, [doc.documentId]: e.target.value }))
                    }
                    className="select"
                    style={{ flex: 1 }}
                  >
                    <option value="">Pilih user untuk ditambahkan...</option>
                    {availableUsers.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.nama} ({u.username})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={isBusy || !pickedUser[doc.documentId]}
                    onClick={() => handleGrant(doc.documentId)}
                    className="btn btn-outline btn-sm"
                  >
                    Tambah
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {!loading && documents.length > 0 && filteredDocuments.length === 0 && (
        <div className="empty-state">Tidak ada dokumen yang cocok dengan pencarian.</div>
      )}

      {!loading && documents.length === 0 && !error && (
        <div className="empty-state">Belum ada dokumen yang diupload.</div>
      )}
    </div>
  );
}
