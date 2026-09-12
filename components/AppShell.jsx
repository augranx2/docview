import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Kerangka layar yang dipakai halaman daftar dokumen (admin maupun pengguna).
 *
 * Kategori dipindahkan ke rail kiri, bukan lagi kotak di dalam area konten.
 * Alasannya: kategori adalah alat navigasi yang dipakai terus-menerus, jadi
 * tempatnya di sisi layar yang tetap — sementara area konten sepenuhnya
 * menjadi milik daftar dokumen.
 *
 * Di layar sempit rail berubah menjadi laci yang ditarik dari kiri.
 */
export default function AppShell({
  user,
  nav = [],
  categories = [],
  categoryCounts = {},
  selectedCategory,
  onSelectCategory,
  totalCount = 0,
  allLabel = "Semua dokumen",
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cari dokumen...",
  onLogout,
  loggingOut,
  children,
}) {
  const [railOpen, setRailOpen] = useState(false);
  const [catFind, setCatFind] = useState("");

  // Laci ditutup saat tombol Esc ditekan — perilaku yang diharapkan dari
  // lapisan yang menutupi layar.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setRailOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cari = catFind.trim().toLowerCase();
  const tampil = categories.filter((c) => c.toLowerCase().includes(cari));

  function pilih(cat) {
    onSelectCategory(cat);
    setRailOpen(false);
  }

  const inisial = (user?.nama || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="app">
      {railOpen && <div className="scrim" onClick={() => setRailOpen(false)} />}

      <nav className={`rail${railOpen ? " rail--open" : ""}`} aria-label="Navigasi utama">
        <div className="rail__brand">
          <div className="rail__mark">
            <img src="/logo-rama.png" alt="" />
          </div>
          <div className="grow truncate">
            <div className="rail__name">SIDOK</div>
            <div className="rail__tag truncate">PT. Rama Emerald Multi Sukses</div>
          </div>
        </div>

        {nav.length > 0 && (
          <div className="rail__nav">
            {nav.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rail__link"
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setRailOpen(false)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="rail__link"
                  onClick={() => {
                    setRailOpen(false);
                    item.onClick();
                  }}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </div>
        )}

        <div className="rail__split" />

        <div className="rail__head">
          <span className="rail__headline">Kategori</span>
          <span className="rail__count">{categories.length}</span>
        </div>

        {categories.length > 8 && (
          <div className="rail__find">
            <input
              type="text"
              value={catFind}
              onChange={(e) => setCatFind(e.target.value)}
              placeholder="Saring kategori"
              aria-label="Saring kategori"
            />
          </div>
        )}

        <div className="rail__scroll">
          <button
            type="button"
            className={`cat${selectedCategory === null ? " cat--on" : ""}`}
            onClick={() => pilih(null)}
          >
            <span className="cat__name">{allLabel}</span>
            <span className="cat__count">{totalCount}</span>
          </button>

          {tampil.map((cat) => (
            <button
              key={cat}
              type="button"
              title={cat}
              className={`cat${selectedCategory === cat ? " cat--on" : ""}`}
              onClick={() => pilih(cat)}
            >
              <span className="cat__name">{cat}</span>
              <span className="cat__count">{categoryCounts[cat]}</span>
            </button>
          ))}

          {tampil.length === 0 && (
            <p className="rail__tag" style={{ padding: "12px 10px" }}>
              Tidak ada kategori yang cocok.
            </p>
          )}
        </div>

        <div className="rail__foot">
          Dokumen di sini bersifat terkendali. Akses, unduhan, dan perubahan hak tercatat.
        </div>
      </nav>

      <div className="main">
        <header className="appbar">
          <button
            type="button"
            className="rail-open"
            onClick={() => setRailOpen(true)}
            aria-label="Buka menu kategori"
          >
            ☰
          </button>

          <div className="appbar__find">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>

          <div className="grow" />

          <div className="who">
            <span className="who__dot" aria-hidden="true">
              {inisial}
            </span>
            <span>
              <span className="who__name">{user?.nama || user?.email || "—"}</span>
              <br />
              <span className="who__role">{user?.role}</span>
            </span>
          </div>

          <button type="button" className="btn btn--sm" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? "Keluar..." : "Keluar"}
          </button>
        </header>

        <div className="sheet">{children}</div>
      </div>
    </div>
  );
}
