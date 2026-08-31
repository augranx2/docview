import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

export default function DocumentListPage() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(null);
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
      .then((me) => setRole(me?.role || null))
      .catch(() => {});
  }, [router]);

  const canDownload = role === "Admin" || role === "Downloader";

  const filtered = docs.filter((doc) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      doc.namaDokumen.toLowerCase().includes(q) ||
      (doc.kategori || "").toLowerCase().includes(q)
    );
  });

  // Group by kategori so the list reads cleanly when there are many documents.
  const grouped = filtered.reduce((acc, doc) => {
    const key = doc.kategori || "Lainnya";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1 className="page-title">Dokumen Saya</h1>
          <p className="page-subtitle">Dokumen yang telah dibagikan kepada Anda</p>
        </div>
        <LogoutButton />
      </div>

      {!loading && docs.length > 0 && (
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input search-input"
            placeholder="Cari nama dokumen atau kategori..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading && <p className="muted">Memuat...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading &&
        Object.entries(grouped).map(([kategori, items]) => (
          <div key={kategori}>
            <div className="section-label">{kategori}</div>
            {items.map((doc) => (
              <div key={doc.documentId} className="doc-row" style={{ cursor: "default" }}>
                <span className="doc-row-icon" aria-hidden>
                  📄
                </span>
                <span className="doc-row-name" style={{ flex: 1 }}>
                  {doc.namaDokumen}
                </span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Link
                    href={`/viewer/${doc.documentId}`}
                    className="btn btn-outline btn-sm"
                  >
                    Lihat
                  </Link>
                  {canDownload && (
                    <a
                      href={`/api/documents/download?documentId=${doc.documentId}`}
                      className="btn btn-outline btn-sm"
                      title="Download file asli"
                    >
                      ⬇ Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {!loading && docs.length > 0 && filtered.length === 0 && (
        <div className="empty-state">Tidak ada dokumen yang cocok dengan pencarian.</div>
      )}

      {!loading && docs.length === 0 && !error && (
        <div className="empty-state">Belum ada dokumen yang dibagikan ke Anda.</div>
      )}
    </div>
  );
}
