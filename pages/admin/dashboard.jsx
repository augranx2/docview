import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DownloadButton from "../../components/DownloadButton";
import AppShell from "../../components/AppShell";

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
  const [categoryIsNew, setCategoryIsNew] = useState(false); // sedang mengetik kategori baru
  const [catFilter, setCatFilter] = useState("");
  const [aksesCari, setAksesCari] = useState({}); // { [documentId]: kata kunci }
  const [bulkShare, setBulkShare] = useState(null); // { usernames: [], canDownload: bool, busy, hasil }
  const [migrasi, setMigrasi] = useState(null); // { running, dryRun, index, total, processed, skipped, failed, log }
  const [categoryDraft, setCategoryDraft] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [busyDoc, setBusyDoc] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [me, setMe] = useState({ nama: "Administrator", email: "", role: "Admin" });
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMe({ nama: data.nama || data.email, email: data.email, role: data.role });
      })
      .catch(() => {});
  }, []);

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
      const data = await bacaRespons(res);
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
      const data = await bacaRespons(res);
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
      const data = await bacaRespons(res);
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
      const data = await bacaRespons(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengakhiri akses");
      setSelectedRevoke((prev) => ({ ...prev, [documentId]: [] }));
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  // Server kadang membalas halaman HTML (mis. galat gateway saat operasi besar
  // melewati batas waktu) alih-alih JSON. res.json() pada kasus itu melempar
  // "Unexpected token '<'" yang tidak memberi tahu apa pun kepada pengguna.
  async function bacaRespons(res) {
    const teks = await res.text();
    try {
      return JSON.parse(teks);
    } catch {
      return {
        error:
          res.status >= 500
            ? "Server tidak merespons tepat waktu. Operasi mungkin tetap berjalan di latar — muat ulang halaman untuk memeriksa hasilnya."
            : `Server membalas dengan format tidak terduga (status ${res.status}).`,
      };
    }
  }

  // ---- CABUT SELURUH AKSES SEBUAH DOKUMEN ----
  async function handleRevokeAll(documentId) {
    if (!confirm("Akhiri akses SEMUA user pada dokumen ini?")) return;
    setBusyDoc(documentId);
    try {
      const res = await fetch("/api/admin/revoke-access-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await bacaRespons(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengakhiri akses");
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyDoc(null);
    }
  }

  // ---- BAGIKAN BEBERAPA DOKUMEN SEKALIGUS ----
  async function handleBulkShare() {
    const usernames = bulkShare?.usernames || [];
    if (usernames.length === 0) {
      alert("Pilih minimal satu user terlebih dahulu.");
      return;
    }
    setBulkShare((prev) => ({ ...prev, busy: true, hasil: null }));
    try {
      const res = await fetch("/api/admin/grant-access-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedDocs,
          usernames,
          canDownload: !!bulkShare.canDownload,
        }),
      });
      const data = await bacaRespons(res);
      if (!res.ok) throw new Error(data.error || "Gagal membagikan dokumen");
      setBulkShare((prev) => ({ ...prev, busy: false, hasil: data }));
      await loadAll();
    } catch (err) {
      alert(err.message);
      setBulkShare((prev) => ({ ...prev, busy: false }));
    }
  }

  // ---- RAPIKAN FILE LAMA DI GOOGLE DRIVE ----
  // Dijalankan bertahap dari browser: tiap panggilan hanya memproses beberapa
  // file lalu mengembalikan posisi terakhir. Satu permintaan panjang akan
  // diputus server sebelum ratusan file selesai diproses.
  async function jalankanMigrasi(dryRun) {
    if (!dryRun && !confirm("Rapikan nama dan folder SEMUA file lama di Google Drive?\n\nIsi file tidak diubah dan aplikasi tetap berjalan normal selama proses.")) {
      return;
    }

    let index = 0;
    let akumulasi = { processed: 0, skipped: 0, failed: 0, log: [] };
    setMigrasi({ running: true, dryRun, index: 0, total: 0, ...akumulasi });

    try {
      while (true) {
        const res = await fetch("/api/admin/migrate-drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startIndex: index, batchSize: 5, dryRun }),
        });
        const data = await bacaRespons(res);
        if (!res.ok) throw new Error(data.error || "Migrasi gagal");

        akumulasi = {
          processed: akumulasi.processed + data.processed,
          skipped: akumulasi.skipped + data.skipped,
          failed: akumulasi.failed + data.failed,
          log: [...akumulasi.log, ...data.log].slice(-40),
        };
        index = data.nextIndex;
        setMigrasi({ running: !data.done, dryRun, index, total: data.total, ...akumulasi });

        if (data.done) break;
      }
      if (!dryRun) await loadAll();
    } catch (err) {
      setMigrasi((prev) => ({
        ...(prev || {}),
        running: false,
        log: [...((prev && prev.log) || []), `BERHENTI: ${err.message}`],
      }));
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
      const data = await bacaRespons(res);
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
    setCategoryIsNew(false);
  }

  // Daftar kategori untuk dropdown, dihitung dari dokumen yang sudah dimuat —
  // tidak perlu panggilan API terpisah karena semuanya sudah ada di memori.
  const categoryOptions = [...new Set(documents.map((d) => (d.kategori || "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "id")
  );

  async function handleSaveCategory(documentId) {
    if (!categoryDraft.trim()) {
      alert("Kategori wajib diisi — kategori menentukan folder file di Google Drive.");
      return;
    }
    setSavingCategory(true);
    try {
      const res = await fetch("/api/admin/update-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, kategori: categoryDraft }),
      });
      const data = await bacaRespons(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan kategori");
      if (data.warning) alert(data.warning);
      setEditingCategoryDoc(null);
      setCategoryIsNew(false);
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
      const data = await bacaRespons(res);
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
      const data = await bacaRespons(res);
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

  // Seluruh dokumen yang sedang tampil dapat dipilih. Sebelumnya daftar ini
  // dibatasi pada dokumen yang belum dibagikan — sisa aturan lama ketika
  // pilihan massal hanya dipakai untuk menghapus. Akibatnya "Pilih semua" tidak
  // bereaksi sama sekali pada kategori yang seluruh dokumennya sudah dibagikan.
  const selectableDocIds = filteredDocuments.map((d) => d.documentId);
  const allSelectableChecked =
    selectableDocIds.length > 0 && selectableDocIds.every((id) => selectedDocs.includes(id));

  function toggleSelectAll() {
    if (allSelectableChecked) {
      setSelectedDocs((prev) => prev.filter((id) => !selectableDocIds.includes(id)));
    } else {
      setSelectedDocs((prev) => [...new Set([...prev, ...selectableDocIds])]);
    }
  }

  function fmtTgl(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  const nav = [
    { label: "Unggah dokumen", href: "/admin/upload", icon: "＋" },
  ];

  return (
    <>
      <Head>
        <title>Kelola Dokumen — SIDOK</title>
      </Head>

      <AppShell
        user={me}
        mode="admin"
        currentPath="/admin/dashboard"
        nav={nav}
        categories={categoryList}
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        totalCount={documents.length}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Cari dokumen, kategori, atau nama pengguna"
        onLogout={handleLogout}
        loggingOut={loggingOut}
      >
        <div className="pagehead">
          <div>
            <h1>{selectedCategory || "Kelola dokumen"}</h1>
            <p>
              Unggah dokumen baru, atur siapa yang boleh membaca dan mengunduh, serta pantau
              arsip terkendali.
            </p>
          </div>
          <div className="pagehead__acts">
            <select
              className="select"
              style={{ width: "auto" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Urutkan dokumen"
            >
              <option value="newest">Terbaru diunggah</option>
              <option value="oldest">Terlama diunggah</option>
              <option value="name-asc">Nama A → Z</option>
              <option value="name-desc">Nama Z → A</option>
            </select>
            <Link href="/admin/upload" className="btn btn--primary">
              Unggah dokumen
            </Link>
          </div>
        </div>

        {error && <p className="notice notice--bad" style={{ marginBottom: 14 }}>{error}</p>}

        {/* ---------- PERAPIAN BERKAS DI GOOGLE DRIVE ---------- */}
        <details className="card card--pad" style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            Perapian berkas di Google Drive
          </summary>
          <p className="hint" style={{ margin: "8px 0 12px" }}>
            Menyesuaikan nama berkas lama yang masih berupa kode acak dan memindahkannya ke folder
            sesuai kategori. Aman dijalankan berulang — berkas yang sudah rapi dilewati.
          </p>
          <div className="row">
            <button className="btn btn--sm" disabled={migrasi?.running} onClick={() => jalankanMigrasi(true)}>
              Lihat rencana
            </button>
            <button
              className="btn btn--primary btn--sm"
              disabled={migrasi?.running}
              onClick={() => jalankanMigrasi(false)}
            >
              {migrasi?.running ? "Sedang berjalan..." : "Jalankan perapian"}
            </button>
          </div>

          {migrasi && (
            <div style={{ marginTop: 12 }}>
              <div className="bar">
                <div style={{ width: migrasi.total ? `${Math.round((migrasi.index / migrasi.total) * 100)}%` : "0%" }} />
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                {migrasi.dryRun && "Rencana — "}
                {migrasi.index}/{migrasi.total} diperiksa, {migrasi.processed}{" "}
                {migrasi.dryRun ? "akan diubah" : "dirapikan"}, {migrasi.skipped} sudah sesuai
                {migrasi.failed > 0 && `, ${migrasi.failed} gagal`}
                {!migrasi.running && migrasi.total > 0 && " — selesai"}
              </p>
              {migrasi.log.length > 0 && <pre className="log">{migrasi.log.join("\n")}</pre>}
            </div>
          )}
        </details>

        {/* ---------- PILIH BANYAK ---------- */}
        {!loading && filteredDocuments.length > 0 && (
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <label className="check" style={{ alignItems: "center" }}>
              <input type="checkbox" checked={allSelectableChecked} onChange={toggleSelectAll} />
              <span style={{ fontWeight: 600 }}>
                {selectedDocs.length > 0
                  ? `${selectedDocs.length} dokumen dipilih`
                  : `Pilih semua (${filteredDocuments.length})`}
              </span>
            </label>

            {selectedDocs.length > 0 && (
              <div className="row">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => setBulkShare({ usernames: [], canDownload: false, busy: false, hasil: null })}
                >
                  Bagikan {selectedDocs.length} dokumen
                </button>
                <button className="btn btn--danger btn--sm" onClick={handleBulkDelete} disabled={bulkBusy}>
                  {bulkBusy ? "Menghapus..." : "Hapus terpilih"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- PANEL BAGIKAN BANYAK DOKUMEN ---------- */}
        {bulkShare && (
          <div className="card card--pad" style={{ marginBottom: 14, borderColor: "var(--blue-100)" }}>
            <div className="card__head">
              <div>
                <div className="card__title">Bagikan {selectedDocs.length} dokumen</div>
                <div className="card__sub">
                  Pilih penerima. Pengguna yang sudah punya akses pada sebuah dokumen akan dilewati.
                </div>
              </div>
              <button className="x" onClick={() => setBulkShare(null)} aria-label="Tutup">
                ✕
              </button>
            </div>

            <div className="row" style={{ marginBottom: 9 }}>
              <button
                className="btn btn--sm"
                onClick={() => setBulkShare((p) => ({ ...p, usernames: users.map((u) => u.username) }))}
              >
                Pilih semua pengguna
              </button>
              <button className="btn btn--sm" onClick={() => setBulkShare((p) => ({ ...p, usernames: [] }))}>
                Kosongkan
              </button>
              <span className="hint">{bulkShare.usernames.length} dipilih</span>
            </div>

            <div className="scrollbox row" style={{ gap: 6 }}>
              {[...users]
                .sort((a, b) => a.username.localeCompare(b.username, "id"))
                .map((u) => {
                const on = bulkShare.usernames.includes(u.username);
                return (
                  <label key={u.username} className={`who-chip${on ? " who-chip--on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setBulkShare((p) => ({
                          ...p,
                          usernames: p.usernames.includes(u.username)
                            ? p.usernames.filter((x) => x !== u.username)
                            : [...p.usernames, u.username],
                        }))
                      }
                    />
                    {u.username}
                    </label>
                  );
                })}
            </div>

            <label className="check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={!!bulkShare.canDownload}
                onChange={(e) => setBulkShare((p) => ({ ...p, canDownload: e.target.checked }))}
              />
              <span>
                Sekaligus izinkan mengunduh berkas asli untuk seluruh dokumen dan pengguna di atas.
                Bisa diubah kapan saja.
              </span>
            </label>

            {bulkShare.hasil && (
              <p className="notice notice--ok" style={{ marginTop: 10 }}>
                {bulkShare.hasil.added} akses ditambahkan
                {bulkShare.hasil.skipped > 0 && `, ${bulkShare.hasil.skipped} dilewati karena sudah punya akses`}.
              </p>
            )}

            <button
              className="btn btn--primary"
              style={{ marginTop: 12 }}
              onClick={handleBulkShare}
              disabled={bulkShare.busy}
            >
              {bulkShare.busy ? "Membagikan..." : `Bagikan ke ${bulkShare.usernames.length} pengguna`}
            </button>
          </div>
        )}

        {/* ---------- DAFTAR DOKUMEN ---------- */}
        {loading ? (
          <p className="muted">
            <span className="spinner" style={{ marginRight: 8 }} />
            Memuat dokumen...
          </p>
        ) : filteredDocuments.length === 0 ? (
          <div className="card empty">
            <h3>{documents.length === 0 ? "Belum ada dokumen" : "Tidak ada yang cocok"}</h3>
            <p>
              {documents.length === 0
                ? "Unggah dokumen pertama untuk mulai membagikannya ke personel."
                : "Ubah kata kunci pencarian atau pilih kategori lain di panel kiri."}
            </p>
          </div>
        ) : (
          <div className="docs">
            {filteredDocuments.map((doc) => {
              const isExpanded = expandedDoc === doc.documentId;
              const isBusy = busyDoc === doc.documentId;
              const dipilih = selectedDocs.includes(doc.documentId);
              const sharedUsernames = doc.sharedTo.map((x) => x.username);
              // Kedua daftar diurutkan abjad dan disaring dengan satu kotak
              // pencarian yang sama — dengan puluhan pengguna, menelusuri
              // daftar tak berurutan jauh lebih lambat daripada mengetik.
              const kunci = (aksesCari[doc.documentId] || "").trim().toLowerCase();
              const cocok = (nama) => !kunci || String(nama).toLowerCase().includes(kunci);

              const pembaca = [...doc.sharedTo]
                .sort((a, b) => a.username.localeCompare(b.username, "id"))
                .filter((x) => cocok(x.username));

              const availableUsers = users
                .filter((u) => !sharedUsernames.includes(u.username))
                .sort((a, b) => a.username.localeCompare(b.username, "id"))
                .filter((u) => cocok(u.username));
              const downloadCount = doc.sharedTo.filter((x) => x.canDownload).length;
              const revokePicked = selectedRevoke[doc.documentId] || [];

              return (
                <div
                  key={doc.documentId}
                  className={`doc${downloadCount > 0 ? " doc--grant" : ""}${dipilih ? " doc--on" : ""}`}
                  style={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <div className="doc__top">
                    <input
                      type="checkbox"
                      checked={dipilih}
                      onChange={() => toggleDocSelected(doc.documentId)}
                      style={{ marginTop: 3, accentColor: "var(--blue-500)" }}
                      aria-label={`Pilih ${doc.namaDokumen}`}
                    />

                    <div className="doc__body">
                      <h2 className="doc__title">{doc.namaDokumen}</h2>

                      <div className="doc__meta">
                        {editingCategoryDoc === doc.documentId ? (
                          <span className="row" style={{ gap: 6 }}>
                            <select
                              className="select"
                              style={{ width: "auto", padding: "4px 8px", fontSize: 11.5 }}
                              autoFocus
                              value={categoryIsNew ? "__new__" : categoryDraft}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "__new__") {
                                  setCategoryIsNew(true);
                                  setCategoryDraft("");
                                } else {
                                  setCategoryIsNew(false);
                                  setCategoryDraft(v);
                                }
                              }}
                            >
                              <option value="">Pilih kategori</option>
                              {categoryOptions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                              <option value="__new__">Buat kategori baru</option>
                            </select>
                            {categoryIsNew && (
                              <input
                                className="input"
                                style={{ width: 170, padding: "4px 8px", fontSize: 11.5 }}
                                autoFocus
                                value={categoryDraft}
                                onChange={(e) => setCategoryDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveCategory(doc.documentId);
                                  if (e.key === "Escape") setEditingCategoryDoc(null);
                                }}
                                placeholder="Nama kategori baru"
                              />
                            )}
                            <button
                              className="btn btn--primary btn--sm"
                              disabled={savingCategory}
                              onClick={() => handleSaveCategory(doc.documentId)}
                            >
                              {savingCategory ? "..." : "Simpan"}
                            </button>
                            <button
                              className="btn btn--sm"
                              onClick={() => {
                                setEditingCategoryDoc(null);
                                setCategoryIsNew(false);
                              }}
                            >
                              Batal
                            </button>
                          </span>
                        ) : (
                          <>
                            <span className="tag">{doc.kategori || "Tanpa kategori"}</span>
                            <button
                              className="btn btn--quiet btn--sm"
                              onClick={() => startEditCategory(doc)}
                              title="Ubah kategori"
                            >
                              Ubah
                            </button>
                          </>
                        )}

                        <i aria-hidden="true" />
                        <span>Diunggah {fmtTgl(doc.uploadedAt)}</span>
                        <i aria-hidden="true" />
                        <span>{doc.sharedTo.length} pembaca</span>
                        {downloadCount > 0 && (
                          <>
                            <i aria-hidden="true" />
                            <span>{downloadCount} boleh mengunduh</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="doc__acts">
                      <Link href={`/viewer/${doc.documentId}`} className="btn btn--sm">
                        Buka
                      </Link>
                      <DownloadButton
                        documentId={doc.documentId}
                        namaDokumen={doc.namaDokumen}
                        label="Unduh"
                        className="btn btn--sm"
                      />
                      <button
                        className={`btn btn--sm${isExpanded ? " btn--primary" : ""}`}
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.documentId)}
                      >
                        Akses
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        disabled={isBusy}
                        onClick={() => handleDelete(doc.documentId, doc.namaDokumen)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  {/* ---------- PENGATURAN AKSES ---------- */}
                  {isExpanded && (
                    <div className="panel">
                      <div className="row row--between" style={{ marginBottom: 8 }}>
                        <span className="panel__title" style={{ margin: 0 }}>
                          Pembaca dokumen ini ({doc.sharedTo.length})
                        </span>

                        {doc.sharedTo.length > 0 && revokePicked.length === 0 && (
                          <button
                            className="btn btn--danger btn--sm"
                            disabled={isBusy}
                            onClick={() => handleRevokeAll(doc.documentId)}
                          >
                            Cabut akses semua
                          </button>
                        )}

                        {revokePicked.length > 0 && (
                          <div className="row">
                            <button
                              className="btn btn--ok btn--sm"
                              disabled={isBusy}
                              onClick={() => handleSetDownload(doc.documentId, revokePicked, true)}
                            >
                              Izinkan unduh
                            </button>
                            <button
                              className="btn btn--sm"
                              disabled={isBusy}
                              onClick={() => handleSetDownload(doc.documentId, revokePicked, false)}
                            >
                              Baca saja
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              disabled={isBusy}
                              onClick={() => handleRevokeSelected(doc.documentId)}
                            >
                              Cabut {revokePicked.length} akses
                            </button>
                          </div>
                        )}
                      </div>

                      {(doc.sharedTo.length > 0 || users.length > 8) && (
                        <input
                          className="input"
                          style={{ marginBottom: 9 }}
                          type="search"
                          value={aksesCari[doc.documentId] || ""}
                          onChange={(e) =>
                            setAksesCari((prev) => ({ ...prev, [doc.documentId]: e.target.value }))
                          }
                          placeholder="Cari nama pengguna..."
                          aria-label="Cari nama pengguna"
                        />
                      )}

                      {doc.sharedTo.length === 0 ? (
                        <p className="hint">Belum dibagikan ke siapa pun.</p>
                      ) : (
                        <>
                          <p className="hint" style={{ marginBottom: 7 }}>
                            Klik lencana di sebelah nama untuk mengatur izin unduh orang tersebut
                            pada dokumen ini.
                            {kunci && ` Menampilkan ${pembaca.length} dari ${doc.sharedTo.length}.`}
                          </p>
                          <div className="scrollbox stack" style={{ gap: 4 }}>
                            {pembaca.length === 0 && (
                              <p className="hint" style={{ textAlign: "center", padding: "8px 0" }}>
                                Tidak ada pembaca yang cocok.
                              </p>
                            )}
                            {pembaca.map(({ username, canDownload }) => {
                              const dicentang = revokePicked.includes(username);
                              return (
                                <label
                                  key={username}
                                  className="row"
                                  style={{
                                    gap: 9,
                                    padding: "5px 8px",
                                    borderRadius: 8,
                                    background: dicentang ? "var(--blue-50)" : "transparent",
                                    cursor: "pointer",
                                    flexWrap: "nowrap",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={dicentang}
                                    onChange={() => toggleRevokeSelected(doc.documentId, username)}
                                    style={{ accentColor: "var(--blue-500)" }}
                                  />
                                  <span className="grow truncate" style={{ fontSize: 12.5 }}>
                                    {username}
                                  </span>
                                  <button
                                    type="button"
                                    className={`pill${canDownload ? " pill--ok" : ""}`}
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSetDownload(doc.documentId, [username], !canDownload);
                                    }}
                                    title={
                                      canDownload
                                        ? "Boleh mengunduh — klik untuk mengubah jadi baca saja"
                                        : "Baca saja — klik untuk mengizinkan mengunduh"
                                    }
                                    style={{ cursor: "pointer" }}
                                  >
                                    {canDownload ? "Boleh unduh" : "Baca saja"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--quiet btn--sm"
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRevoke(doc.documentId, username);
                                    }}
                                    title="Cabut akses orang ini"
                                  >
                                    ✕
                                  </button>
                                </label>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* ---------- TAMBAH PEMBACA ---------- */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                        <div className="panel__title">Tambah pembaca</div>

                        {availableUsers.length === 0 ? (
                          <p className="hint">
                            {kunci
                              ? "Tidak ada pengguna yang cocok dengan pencarian."
                              : "Semua pengguna sudah memiliki akses ke dokumen ini."}
                          </p>
                        ) : (
                          <>
                            <div className="scrollbox row" style={{ gap: 6, maxHeight: 150 }}>
                              {availableUsers.map((u) => {
                                const on = (selectedUsers[doc.documentId] || []).includes(u.username);
                                return (
                                  <label key={u.username} className={`who-chip${on ? " who-chip--on" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleUserSelected(doc.documentId, u.username)}
                                    />
                                    {u.username}
                                  </label>
                                );
                              })}
                            </div>

                            <label className="check" style={{ marginTop: 9 }}>
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
                              <span>Sekaligus izinkan mengunduh berkas asli. Bisa diubah kapan saja.</span>
                            </label>

                            <div className="row" style={{ marginTop: 9 }}>
                              <button
                                className="btn btn--primary btn--sm"
                                disabled={isBusy || (selectedUsers[doc.documentId] || []).length === 0}
                                onClick={() => handleGrantSelected(doc.documentId)}
                              >
                                Bagikan ke {(selectedUsers[doc.documentId] || []).length} pengguna
                              </button>
                              <button
                                className="btn btn--sm"
                                disabled={isBusy}
                                onClick={() => handleGrantAll(doc.documentId)}
                              >
                                Bagikan ke semua
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AppShell>
    </>
  );
}
