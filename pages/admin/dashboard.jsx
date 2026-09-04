import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openPickerDoc, setOpenPickerDoc] = useState(null); // documentId whose "add access" panel is open
  const [selectedUsers, setSelectedUsers] = useState({}); // { [documentId]: string[] } — users picked to GRANT
  const [grantWithDownload, setGrantWithDownload] = useState({}); // { [documentId]: bool } — give download permission on grant

  const [expandedDoc, setExpandedDoc] = useState(null); // documentId whose "Kelola Akses" section is expanded
  const [selectedRevoke, setSelectedRevoke] = useState({}); // { [documentId]: string[] } — users picked to REVOKE

  const [selectedDocs, setSelectedDocs] = useState([]); // documentIds picked for bulk delete
  const [sortBy, setSortBy] = useState("newest"); // newest | oldest | name-asc | name-desc
  const [selectedCategory, setSelectedCategory] = useState(null); // null = semua kategori
  const [editingCategoryDoc, setEditingCategoryDoc] = useState(null); // documentId being edited
  const [categoryDraft, setCategoryDraft] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [busyDoc, setBusyDoc] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
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

  // ---- GRANT (tambah akses) ----
  function toggleUserSelected(documentId, username) {
    setSelectedUsers((prev) => {
      const current = prev[documentId] || [];
      const next = current.includes(username)
        ? current.filter((u) => u !== username)
        : [...current, username];
      return { ...prev, [documentId]: next };
    });
  }

  async function handleGrantSelected(documentId) {
    const usernames = selectedUsers[documentId] || [];
    if (usernames.length === 0) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/grant-access-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          usernames,
          canDownload: !!grantWithDownload[documentId],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah akses");
      setSelectedUsers((prev) => ({ ...prev, [documentId]: [] }));
      setOpenPickerDoc(null);
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  async function handleGrantAll(documentId) {
    const withDownload = !!grantWithDownload[documentId];
    if (
      !confirm(
        `Bagikan dokumen ini ke SEMUA user aktif${withDownload ? " DENGAN izin download" : " (lihat saja)"}?`
      )
    )
      return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/grant-access-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, canDownload: withDownload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membagikan ke semua user");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  // ---- REVOKE (akhiri akses) — single + multi-select batch ----
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

  function toggleRevokeSelected(documentId, username) {
    setSelectedRevoke((prev) => {
      const current = prev[documentId] || [];
      const next = current.includes(username)
        ? current.filter((u) => u !== username)
        : [...current, username];
      return { ...prev, [documentId]: next };
    });
  }

  async function handleRevokeSelected(documentId) {
    const usernames = selectedRevoke[documentId] || [];
    if (usernames.length === 0) return;
    if (!confirm(`Akhiri akses ${usernames.length} user sekaligus dari dokumen ini?`)) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/revoke-access-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, usernames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengakhiri akses");
      setSelectedRevoke((prev) => ({ ...prev, [documentId]: [] }));
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  // ---- IZIN DOWNLOAD PER USER PER DOKUMEN ----
  async function handleSetDownload(documentId, usernames, canDownload) {
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/set-download-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, usernames, canDownload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah izin download");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  // ---- EDIT KATEGORI ----
  function startEditCategory(doc) {
    setEditingCategoryDoc(doc.documentId);
    setCategoryDraft(doc.kategori || "");
  }

  async function handleSaveCategory(documentId) {
    setSavingCategory(true);
    try {
      const res = await fetch("/api/admin/update-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, kategori: categoryDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan kategori");
      setEditingCategoryDoc(null);
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingCategory(false);
    }
  }

  // ---- DELETE — single + bulk ----
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

  function toggleDocSelected(documentId) {
    setSelectedDocs((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId]
    );
  }

  async function handleBulkDelete() {
    if (selectedDocs.length === 0) return;
    if (!confirm(`Hapus permanen ${selectedDocs.length} dokumen terpilih? File akan dihapus dari Google Drive juga.`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/delete-documents-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedDocs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus dokumen");
      setSelectedDocs([]);
      if (data.skipped && data.skipped.length > 0) {
        alert(
          `${data.deleted} dokumen dihapus. ${data.skipped.length} dilewati (masih dibagikan ke user, akhiri dulu share-nya): ${data.skipped
            .map((s) => s.namaDokumen || s.documentId)
            .join(", ")}`
        );
      }
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkBusy(false);
    }
  }

  // ---- Filter + sort ----
  const UNCATEGORIZED = "Tanpa Kategori";

  // Hitung jumlah dokumen per kategori (untuk sidebar), tidak terpengaruh
  // oleh pencarian/kategori terpilih — supaya angka di sidebar tetap stabil.
  const categoryCounts = documents.reduce((acc, doc) => {
    const key = doc.kategori || UNCATEGORIZED;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const categoryList = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));

  const filteredDocuments = documents
    .filter((doc) => {
      if (selectedCategory && (doc.kategori || UNCATEGORIZED) !== selectedCategory) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        doc.namaDokumen.toLowerCase().includes(q) ||
        (doc.kategori || "").toLowerCase().includes(q) ||
        doc.sharedTo.some((s) => s.username.toLowerCase().includes(q))
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

  const selectableDocIds = filteredDocuments
    .filter((d) => d.sharedTo.length === 0)
    .map((d) => d.documentId);
  const allSelectableChecked =
    selectableDocIds.length > 0 && selectableDocIds.every((id) => selectedDocs.includes(id));

  function toggleSelectAll() {
    if (allSelectableChecked) {
      setSelectedDocs((prev) => prev.filter((id) => !selectableDocIds.includes(id)));
    } else {
      setSelectedDocs((prev) => [...new Set([...prev, ...selectableDocIds])]);
    }
  }

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
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px" }}>

        {/* KOP HEADER BERGRADASI ADMIN */}
        <div style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #000000 0%, #020b17 50%, #15427d 100%)", padding: "28px 24px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <img src="/logo-rama.png" alt="Logo" style={{ height: 44, width: 44, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <div>
                  <span style={{ display: "inline-block", background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#bfdbfe", marginBottom: 6 }}>
                    ⚙️ Panel Administrator
                  </span>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard Kelola Dokumen</h1>
                  <p style={{ fontSize: 12, color: "#bfdbfe", margin: "4px 0 0" }}>Unggah dokumen baru, atur hak akses user, dan pantau arsip terkendali</p>
                </div>
              </div>

              <Link
                href="/admin/upload"
                style={{ padding: "10px 18px", borderRadius: 12, background: "white", color: "#1e4d8f", fontSize: 12, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
              >
                + Upload Dokumen Baru
              </Link>
            </div>
          </div>
        </div>

        {/* LAYOUT SIDEBAR + KONTEN */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* SIDEBAR KATEGORI */}
          {!loading && documents.length > 0 && (
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
                  background: selectedCategory === null ? "#1e4d8f" : "transparent",
                  color: selectedCategory === null ? "white" : "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <span>📋 Semua Dokumen</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{documents.length}</span>
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
                    background: selectedCategory === cat ? "#1e4d8f" : "transparent",
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

        {/* KOTAK PENCARIAN + SORT */}
        {!loading && documents.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
              <input
                type="text"
                style={{ width: "100%", padding: "11px 14px 11px 38px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, background: "white", color: "#0f172a", outline: "none", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                placeholder="Cari nama dokumen, kategori, atau username..."
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

        {/* TOOLBAR BULK ACTION */}
        {!loading && filteredDocuments.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "8px 4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", cursor: selectableDocIds.length > 0 ? "pointer" : "default" }}>
              <input
                type="checkbox"
                checked={allSelectableChecked}
                disabled={selectableDocIds.length === 0}
                onChange={toggleSelectAll}
              />
              {selectedDocs.length > 0 ? `${selectedDocs.length} dokumen dipilih` : "Pilih semua"}
            </label>
            {selectedDocs.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkBusy}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #dc2626", background: bulkBusy ? "#fca5a5" : "#dc2626", color: "white", fontSize: 12, fontWeight: 700, cursor: bulkBusy ? "not-allowed" : "pointer" }}
              >
                {bulkBusy ? "Menghapus..." : `Hapus ${selectedDocs.length} Dokumen Terpilih`}
              </button>
            )}
          </div>
        )}

        {loading && <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 40 }}>Memuat data dokumen...</p>}
        {error && <p style={{ color: "#dc2626", fontSize: 13, background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>{error}</p>}

        {/* DAFTAR KARTU DOKUMEN ADMIN */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredDocuments.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "48px 20px", fontSize: 13, background: "white", borderRadius: 20, border: "1px dashed #cbd5e1" }}>
                {documents.length === 0 ? "Belum ada dokumen yang diupload." : "Tidak ada dokumen yang cocok dengan pencarian."}
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const sharedUsernames = doc.sharedTo.map((s) => s.username);
                const availableUsers = users.filter((u) => !sharedUsernames.includes(u.username));
                const downloadCount = doc.sharedTo.filter((s) => s.canDownload).length;
                const isBusy = busyDoc === doc.documentId;
                const isExpanded = expandedDoc === doc.documentId;
                const canDelete = doc.sharedTo.length === 0;

                return (
                  <div key={doc.documentId} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)", padding: 16, opacity: isBusy ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.documentId)}
                          disabled={!canDelete}
                          title={canDelete ? "Pilih untuk hapus massal" : "Masih dibagikan — tidak bisa dihapus"}
                          onChange={() => toggleDocSelected(doc.documentId)}
                          style={{ marginTop: 4, flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", wordBreak: "break-word" }}>{doc.namaDokumen}</div>

                          {editingCategoryDoc === doc.documentId ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                              <input
                                type="text"
                                autoFocus
                                value={categoryDraft}
                                onChange={(e) => setCategoryDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveCategory(doc.documentId);
                                  if (e.key === "Escape") setEditingCategoryDoc(null);
                                }}
                                placeholder="Nama kategori..."
                                style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 6, outline: "none", width: 140 }}
                              />
                              <button
                                disabled={savingCategory}
                                onClick={() => handleSaveCategory(doc.documentId)}
                                style={{ fontSize: 11, fontWeight: 700, color: "white", background: "#1e4d8f", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                              >
                                Simpan
                              </button>
                              <button
                                disabled={savingCategory}
                                onClick={() => setEditingCategoryDoc(null)}
                                style={{ fontSize: 11, fontWeight: 600, color: "#334155", background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                              {doc.kategori ? (
                                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "#1e4d8f", background: "#eff6ff", borderRadius: 6, padding: "2px 8px", border: "1px solid #bfdbfe" }}>
                                  {doc.kategori}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Tanpa kategori</span>
                              )}
                              <button
                                onClick={() => startEditCategory(doc)}
                                title="Edit kategori"
                                style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}
                              >
                                ✏️
                              </button>
                            </div>
                          )}

                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                            {new Date(doc.uploadedAt).toLocaleString("id-ID")} · {doc.uploadedBy} · {doc.sharedTo.length} user
                            {downloadCount > 0 && ` · ${downloadCount} boleh download`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <Link
                          href={`/viewer/${doc.documentId}`}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                        >
                          Lihat
                        </Link>
                        <a
                          href={`/api/documents/download?documentId=${doc.documentId}`}
                          style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                          title="Download file asli"
                        >
                          ⬇
                        </a>
                        <button
                          onClick={() => setExpandedDoc(isExpanded ? null : doc.documentId)}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: isExpanded ? "#eff6ff" : "white", color: "#1e4d8f", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          Kelola Akses {isExpanded ? "▲" : "▼"}
                        </button>
                        <button
                          disabled={isBusy || !canDelete}
                          onClick={() => handleDelete(doc.documentId, doc.namaDokumen)}
                          title={canDelete ? "Hapus dokumen permanen" : "Akhiri semua share dulu sebelum menghapus"}
                          style={{ background: "transparent", border: "none", color: canDelete ? "#dc2626" : "#cbd5e1", fontSize: 12, fontWeight: 600, cursor: canDelete ? "pointer" : "not-allowed", padding: "6px 4px" }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "14px 0" }} />

                        {/* DAFTAR USER YANG DIBAGIKAN — dengan multi-select revoke */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                              Dibagikan ke ({doc.sharedTo.length} user)
                            </div>
                            {(selectedRevoke[doc.documentId] || []).length > 0 && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleSetDownload(doc.documentId, selectedRevoke[doc.documentId], true)
                                  }
                                  title="Beri izin download file asli untuk user terpilih"
                                  style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #16a34a", background: "white", color: "#16a34a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                >
                                  ⬇ Izinkan Download
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleSetDownload(doc.documentId, selectedRevoke[doc.documentId], false)
                                  }
                                  title="Cabut izin download — user tetap bisa melihat dokumen"
                                  style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                >
                                  👁 Lihat Saja
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() => handleRevokeSelected(doc.documentId)}
                                  style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #dc2626", background: "white", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                >
                                  Akhiri {(selectedRevoke[doc.documentId] || []).length} Terpilih
                                </button>
                              </div>
                            )}
                          </div>
                          {doc.sharedTo.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontStyle: "italic" }}>
                              Belum dibagikan ke siapa pun.
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                              Klik label di sebelah nama untuk mengatur izin download user tersebut pada dokumen ini.
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {doc.sharedTo.map(({ username, canDownload }) => {
                              const checked = (selectedRevoke[doc.documentId] || []).includes(username);
                              return (
                                <label
                                  key={username}
                                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, fontSize: 12, background: checked ? "#eff6ff" : "#fafafa", cursor: "pointer" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRevokeSelected(doc.documentId, username)}
                                  />
                                  <span style={{ flex: 1 }}>{username}</span>

                                  {/* SAKELAR IZIN DOWNLOAD — per user, per dokumen */}
                                  <button
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSetDownload(doc.documentId, [username], !canDownload);
                                    }}
                                    title={
                                      canDownload
                                        ? "Izin download AKTIF — klik untuk mencabut (jadi lihat saja)"
                                        : "Lihat saja — klik untuk mengizinkan download file asli"
                                    }
                                    style={{
                                      border: canDownload ? "1px solid #16a34a" : "1px solid #cbd5e1",
                                      background: canDownload ? "#f0fdf4" : "white",
                                      color: canDownload ? "#16a34a" : "#94a3b8",
                                      fontSize: 10,
                                      fontWeight: 700,
                                      borderRadius: 6,
                                      padding: "2px 8px",
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {canDownload ? "⬇ Boleh download" : "👁 Lihat saja"}
                                  </button>

                                  <button
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRevoke(doc.documentId, username);
                                    }}
                                    title="Akhiri akses user ini saja"
                                    style={{ border: "none", background: "none", color: "#dc2626", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* TAMBAH AKSES USER — multi-select */}
                        {availableUsers.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  setOpenPickerDoc((prev) => (prev === doc.documentId ? null : doc.documentId))
                                }
                                style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "white", color: "#334155", textAlign: "left", cursor: "pointer" }}
                              >
                                {(selectedUsers[doc.documentId] || []).length > 0
                                  ? `${(selectedUsers[doc.documentId] || []).length} user dipilih`
                                  : "Pilih user untuk ditambahkan akses..."}
                                <span style={{ float: "right" }}>{openPickerDoc === doc.documentId ? "▲" : "▼"}</span>
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => handleGrantAll(doc.documentId)}
                                title={`Bagikan ke ${availableUsers.length} user aktif lainnya sekaligus`}
                                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Bagikan ke Semua
                              </button>
                            </div>

                            {/* PILIHAN IZIN DOWNLOAD SAAT MEMBAGIKAN */}
                            <label
                              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "#334155", cursor: "pointer" }}
                            >
                              <input
                                type="checkbox"
                                checked={!!grantWithDownload[doc.documentId]}
                                onChange={(e) =>
                                  setGrantWithDownload((prev) => ({
                                    ...prev,
                                    [doc.documentId]: e.target.checked,
                                  }))
                                }
                              />
                              Sekaligus beri izin <strong>download file asli</strong> untuk user yang dibagikan
                              <span style={{ color: "#94a3b8" }}>(bisa diubah kapan saja setelahnya)</span>
                            </label>

                            {openPickerDoc === doc.documentId && (
                              <div style={{ marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 8, background: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                                <div style={{ maxHeight: 220, overflowY: "auto", padding: 6 }}>
                                  {availableUsers.map((u) => {
                                    const checked = (selectedUsers[doc.documentId] || []).includes(u.username);
                                    return (
                                      <label
                                        key={u.username}
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, fontSize: 13, cursor: "pointer", background: checked ? "#eff6ff" : "transparent" }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleUserSelected(doc.documentId, u.username)}
                                        />
                                        <span>
                                          {u.nama} ({u.username}) — {u.role}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 8, borderTop: "1px solid #f1f5f9" }}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenPickerDoc(null)}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    disabled={isBusy || (selectedUsers[doc.documentId] || []).length === 0}
                                    onClick={() => handleGrantSelected(doc.documentId)}
                                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1e4d8f", background: "#1e4d8f", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                  >
                                    Tambah ({(selectedUsers[doc.documentId] || []).length})
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

          </div>
          {/* /AREA KONTEN DOKUMEN */}
        </div>
        {/* /LAYOUT SIDEBAR + KONTEN */}

      </div>
    </div>
  );
}
