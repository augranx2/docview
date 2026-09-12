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
  mode, // "admin" | "user" — menentukan sakelar peran di rail
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwLama, setPwLama] = useState("");
  const [pwBaru, setPwBaru] = useState("");
  const [pwPesan, setPwPesan] = useState("");
  const [pwGalat, setPwGalat] = useState("");
  const [pwSibuk, setPwSibuk] = useState(false);

  const isAdmin = user?.role === "Admin";

  async function gantiPassword(e) {
    e.preventDefault();
    setPwGalat("");
    setPwPesan("");
    setPwSibuk(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: pwLama, newPassword: pwBaru }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah password");
      setPwPesan("Password berhasil diubah.");
      setPwLama("");
      setPwBaru("");
      setTimeout(() => {
        setPwOpen(false);
        setPwPesan("");
      }, 1500);
    } catch (err) {
      setPwGalat(err.message);
    } finally {
      setPwSibuk(false);
    }
  }

  // Laci ditutup saat tombol Esc ditekan — perilaku yang diharapkan dari
  // lapisan yang menutupi layar.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setRailOpen(false);
        setMenuOpen(false);
      }
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

        {/* Sakelar peran: satu-satunya tempat perpindahan Admin ↔ Pengguna,
            sekaligus penanda tetap sedang berada di tampilan yang mana. */}
        {isAdmin && (
          <>
            <div className="mode">
              <Link href="/admin/dashboard" aria-current={mode === "admin" ? "page" : undefined}>
                Admin
              </Link>
              <Link href="/viewer" aria-current={mode === "user" ? "page" : undefined}>
                Pengguna
              </Link>
            </div>
            <p className="mode__note">
              {mode === "admin"
                ? "Anda mengelola dokumen: mengunggah, mengatur akses, dan menghapus."
                : "Anda melihat SIDOK seperti yang dilihat personel biasa."}
            </p>
          </>
        )}

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

          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="who"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span className="who__dot" aria-hidden="true">
                {inisial}
              </span>
              <span style={{ textAlign: "left" }}>
                <span className="who__name">{user?.nama || user?.email || "—"}</span>
                <br />
                <span className="who__role">{user?.role}</span>
              </span>
            </button>

            {menuOpen && (
              <>
                {/* Lapisan tak terlihat: sekali klik di mana pun menutup menu */}
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 50 }}
                />
                <div className="menu">
                  <div className="menu__id">
                    <span className="who__dot" style={{ width: 38, height: 38, fontSize: 15 }}>
                      {inisial}
                    </span>
                    <div className="grow truncate">
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{user?.nama || "—"}</div>
                      <div className="hint truncate">{user?.email}</div>
                      <div className="hint">Peran: {user?.role}</div>
                    </div>
                  </div>

                  <p className="hint" style={{ marginBottom: 10 }}>
                    Nama ini tercetak pada watermark setiap dokumen yang Anda buka dan unduh.
                  </p>

                  <button
                    type="button"
                    className="btn btn--block"
                    onClick={() => {
                      setMenuOpen(false);
                      setPwOpen(true);
                    }}
                  >
                    Ganti password
                  </button>
                </div>
              </>
            )}
          </div>

          <button type="button" className="btn btn--sm" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? "Keluar..." : "Keluar"}
          </button>
        </header>

        <div className="sheet">{children}</div>
      </div>

      {pwOpen && (
        <div className="modal" onClick={() => setPwOpen(false)}>
          <div className="modal__card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="card__title">Ganti password</div>
                <div className="card__sub">Masukkan password lama untuk mengonfirmasi.</div>
              </div>
              <button className="x" onClick={() => setPwOpen(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <form className="modal__body stack" onSubmit={gantiPassword}>
              <div>
                <label className="label" htmlFor="pw-lama">
                  Password lama
                </label>
                <input
                  id="pw-lama"
                  className="input"
                  type="password"
                  value={pwLama}
                  onChange={(e) => setPwLama(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="pw-baru">
                  Password baru
                </label>
                <input
                  id="pw-baru"
                  className="input"
                  type="password"
                  value={pwBaru}
                  onChange={(e) => setPwBaru(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <p className="hint" style={{ marginTop: 5 }}>
                  Minimal 6 karakter.
                </p>
              </div>
              {pwGalat && <p className="notice notice--bad">{pwGalat}</p>}
              {pwPesan && <p className="notice notice--ok">{pwPesan}</p>}
              <button type="submit" className="btn btn--primary btn--block" disabled={pwSibuk}>
                {pwSibuk ? "Menyimpan..." : "Simpan password baru"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
