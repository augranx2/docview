import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedUser, setPickedUser] = useState({}); // { [documentId]: username }
  const [busyDoc, setBusyDoc] = useState(null);

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

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Dashboard Dokumen</h2>
        <Link href="/admin/upload">+ Upload Dokumen Baru</Link>
      </div>

      {loading && <p>Memuat...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading &&
        documents.map((doc) => {
          const availableUsers = users.filter((u) => !doc.sharedTo.includes(u.username));
          const isBusy = busyDoc === doc.documentId;

          return (
            <div
              key={doc.documentId}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>{doc.namaDokumen}</strong>
                  {doc.kategori && <span style={{ color: "#888" }}> · {doc.kategori}</span>}
                  <div style={{ fontSize: 12, color: "#888" }}>
                    Diupload {new Date(doc.uploadedAt).toLocaleString("id-ID")} oleh{" "}
                    {doc.uploadedBy}
                  </div>
                </div>
                <button
                  disabled={isBusy || doc.sharedTo.length > 0}
                  onClick={() => handleDelete(doc.documentId, doc.namaDokumen)}
                  title={
                    doc.sharedTo.length > 0
                      ? "Akhiri semua share dulu sebelum menghapus"
                      : "Hapus dokumen permanen"
                  }
                  style={{ color: doc.sharedTo.length > 0 ? "#ccc" : "crimson" }}
                >
                  Hapus
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>
                  Dibagikan ke ({doc.sharedTo.length}):
                </div>
                {doc.sharedTo.length === 0 && (
                  <div style={{ fontSize: 13, color: "#888" }}>Belum dibagikan ke siapa pun.</div>
                )}
                {doc.sharedTo.map((username) => (
                  <span
                    key={username}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#f2f2f2",
                      borderRadius: 12,
                      padding: "2px 10px",
                      marginRight: 6,
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    {username}
                    <button
                      disabled={isBusy}
                      onClick={() => handleRevoke(doc.documentId, username)}
                      title="Akhiri akses"
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "crimson",
                        fontWeight: "bold",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {availableUsers.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <select
                    disabled={isBusy}
                    value={pickedUser[doc.documentId] || ""}
                    onChange={(e) =>
                      setPickedUser((prev) => ({ ...prev, [doc.documentId]: e.target.value }))
                    }
                    style={{ padding: 4 }}
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
                  >
                    Tambah Akses
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {!loading && documents.length === 0 && !error && (
        <p>Belum ada dokumen yang diupload.</p>
      )}
    </div>
  );
}
