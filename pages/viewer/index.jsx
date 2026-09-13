import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DownloadButton from "../../components/DownloadButton";
import AppShell from "../../components/AppShell";

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
  const [auditTotal, setAuditTotal] = useState(0);
  const [catFilter, setCatFilter] = useState("");
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
      if (res.ok) {
        setAuditLogs(data.logs || []);
        setAuditTotal(data.total || (data.logs || []).length);
      }
    } catch {
      setAuditLogs([]);
      setAuditTotal(0);
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

  function fmtTgl(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  const nav = isAdmin ? [{ label: "Audit Trail", onClick: fetchAuditLogs, icon: "🕘" }] : [];

  return (
    <>
      <Head>
        <title>Dokumen Saya — SIDOK</title>
      </Head>

      <AppShell
        user={{ nama: user.nama, email: user.username, role: user.role }}
        mode="user"
        nav={nav}
        categories={categoryList}
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        totalCount={docs.length}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Cari nama dokumen atau kategori"
        onLogout={handleLogout}
        loggingOut={loggingOut}
      >
        <div className="pagehead">
          <div>
            <h1>{selectedCategory || "Dokumen saya"}</h1>
            <p>
              {isAdmin
                ? "Sebagai Administrator Anda dapat membuka dan mengunduh seluruh dokumen aktif."
                : "Dokumen yang dibagikan kepada Anda. Sebagian dapat diunduh bila Administrator memberi izin."}
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
          </div>
        </div>

        {error && <p className="notice notice--bad" style={{ marginBottom: 14 }}>{error}</p>}

        {loading ? (
          <p className="muted">
            <span className="spinner" style={{ marginRight: 8 }} />
            Memuat dokumen...
          </p>
        ) : filtered.length === 0 ? (
          <div className="card empty">
            <h3>{docs.length === 0 ? "Belum ada dokumen untuk Anda" : "Tidak ada yang cocok"}</h3>
            <p>
              {docs.length === 0
                ? "Administrator belum membagikan dokumen apa pun. Hubungi Administrator bila Anda membutuhkan akses."
                : "Ubah kata kunci pencarian atau pilih kategori lain di panel kiri."}
            </p>
          </div>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 10 }}>
              {filtered.length} dokumen
              {selectedCategory ? ` dalam kategori ini` : ""}
            </p>

            <div className="docs">
              {filtered.map((doc) => (
                <article key={doc.documentId} className={`doc${doc.canDownload ? " doc--grant" : ""}`}>
                  <div className="doc__body">
                    <h2 className="doc__title">{doc.namaDokumen}</h2>
                    <div className="doc__meta">
                      {doc.kategori && <span className="tag">{doc.kategori}</span>}
                      <span>Diunggah {fmtTgl(doc.uploadedAt)}</span>
                      <i aria-hidden="true" />
                      <span>{doc.canDownload ? "Boleh diunduh" : "Hanya bisa dibaca"}</span>
                    </div>
                  </div>

                  <div className="doc__acts">
                    <Link href={`/viewer/${doc.documentId}`} className="btn btn--primary btn--sm">
                      Buka
                    </Link>
                    {doc.canDownload ? (
                      <DownloadButton
                        documentId={doc.documentId}
                        namaDokumen={doc.namaDokumen}
                        label="Unduh"
                        className="btn btn--sm"
                      />
                    ) : (
                      <span className="pill pill--mute" title="Dibagikan untuk dibaca saja">
                        Baca saja
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </AppShell>

      {/* ---------------- REKAM JEJAK ---------------- */}
      {showAuditModal && (
        <div className="modal" onClick={() => setShowAuditModal(false)}>
          <div className="modal__card" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="card__title">Audit Trail</div>
                <div className="card__sub">
                  Login, akses, unduhan, dan perubahan hak akses
                  {auditTotal > auditLogs.length && ` — menampilkan ${auditLogs.length} terbaru dari ${auditTotal}`}
                </div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <a className="btn btn--sm" href="/api/admin/audit-log?format=csv">
                  Unduh CSV
                </a>
                <button className="x" onClick={() => setShowAuditModal(false)} aria-label="Tutup">
                  ✕
                </button>
              </div>
            </div>
            <div className="modal__body">
              {loadingAudit ? (
                <p className="muted">
                  <span className="spinner" style={{ marginRight: 8 }} />
                  Memuat rekam jejak...
                </p>
              ) : auditLogs.length === 0 ? (
                <p className="muted">Belum ada aktivitas tercatat.</p>
              ) : (
                <div className="docs">
                  {auditLogs.map((log, idx) => (
                    <div key={idx} className="doc" style={{ padding: "10px 14px" }}>
                      <div className="doc__body">
                        <div className="row" style={{ gap: 8 }}>
                          <span className="pill">{log.action}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{log.userEmail}</span>
                        </div>
                        {log.detail && (
                          <p className="hint" style={{ marginTop: 4 }}>{log.detail}</p>
                        )}
                      </div>
                      <span className="hint" style={{ flexShrink: 0 }}>
                        {new Date(log.timestamp).toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
