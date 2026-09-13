import { useEffect, useState } from "react";
import Link from "next/link";
import useIdleLogout from "../lib/useIdleLogout";

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
  currentPath = "",
  hideCategories = false,
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
  useIdleLogout();

  const [railOpen, setRailOpen] = useState(false);
  const [catFind, setCatFind] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwLama, setPwLama] = useState("");
  const [pwBaru, setPwBaru] = useState("");
  const [pwPesan, setPwPesan] = useState("");
  const [pwGalat, setPwGalat] = useState("");
  const [pwSibuk, setPwSibuk] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifSiap, setNotifSiap] = useState(false);

  // Jumlah belum dibaca diambil sekali saat halaman dibuka. Tidak ada
  // penarikan berkala: lonceng ini bukan pesan instan, dan permintaan berulang
  // ke spreadsheet mahal ketika datanya sudah puluhan ribu baris.
  useEffect(() => {
    let batal = false;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (batal || !d) return;
        setNotifs(d.notifications || []);
        setUnread(d.unread || 0);
        setNotifSiap(true);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, []);

  async function tandaiSemua() {
    setUnread(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function tandaiSatu(notifId) {
    setUnread((n) => Math.max(0, n - 1));
    setNotifs((prev) =>
      prev.map((n) => (n.notifId === notifId ? { ...n, readAt: new Date().toISOString() } : n))
    );
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifId }),
    }).catch(() => {});
  }

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
        setNotifOpen(false);
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
            <div className="rail__tag truncate">Sistem Dokumen Terkendali</div>
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

        <div className="rail__nav">
          {/* Kelola pengguna hanya untuk Administrator, dan hanya saat sedang
              berada di tampilan Admin — di tampilan Pengguna menu ini tidak
              relevan. */}
          {isAdmin && mode === "admin" && (
            <Link
              href="/admin/users"
              className="rail__link"
              aria-current={currentPath === "/admin/users" ? "page" : undefined}
              onClick={() => setRailOpen(false)}
            >
              <span aria-hidden="true">👥</span>
              Kelola pengguna
            </Link>
          )}

          {/* Notifikasi berisi perubahan akses atas dokumen yang dibagikan
              kepada Anda — itu peristiwa yang dialami sebagai pengguna, bukan
              sebagai pengelola. */}
          {mode !== "admin" && (
            <button
              type="button"
              className="rail__link"
              onClick={() => {
                setRailOpen(false);
                setNotifOpen(true);
              }}
            >
              <span aria-hidden="true">🔔</span>
              Notifikasi
              {unread > 0 && <span className="rail__badge">{unread}</span>}
            </button>
          )}

          <button
            type="button"
            className="rail__link"
            onClick={() => {
              setRailOpen(false);
              setPwOpen(true);
            }}
          >
            <span aria-hidden="true">🔑</span>
            Ganti password
          </button>
        </div>

        {nav.length > 0 && (
          <div className="rail__nav" style={{ paddingTop: 0 }}>
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

        {!hideCategories && <div className="rail__split" />}

        {!hideCategories && (
        <div className="rail__head">
          <span className="rail__headline">Kategori</span>
          <span className="rail__count">{categories.length}</span>
        </div>
        )}

        {!hideCategories && categories.length > 8 && (
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

        <div className="rail__scroll" style={hideCategories ? { display: "none" } : undefined}>
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

        <div className="rail__foot">PT. Rama Emerald Multi Sukses</div>
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

          <div className="appbar__brand">
            <span className="appbar__brand-name">SIDOK</span>
            <span className="appbar__brand-sub">Sistem Dokumen Terkendali</span>
          </div>

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
              <span className="who__id">
                <span className="who__name">{user?.nama || user?.email || "—"}</span>
                <span className="who__role">{user?.role === "Admin" ? "Administrator" : "Pengguna"}</span>
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

      {notifOpen && (
        <div className="modal" onClick={() => setNotifOpen(false)}>
          <div className="modal__card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="card__title">Notifikasi</div>
                <div className="card__sub">
                  Perubahan akses dan dokumen baru yang dibagikan kepada Anda.
                </div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                {unread > 0 && (
                  <button className="btn btn--sm" onClick={tandaiSemua}>
                    Tandai semua dibaca
                  </button>
                )}
                <button className="x" onClick={() => setNotifOpen(false)} aria-label="Tutup">
                  ✕
                </button>
              </div>
            </div>

            <div className="modal__body">
              {!notifSiap ? (
                <p className="muted">
                  <span className="spinner" style={{ marginRight: 8 }} />
                  Memuat notifikasi...
                </p>
              ) : notifs.length === 0 ? (
                <div className="empty" style={{ padding: "28px 8px" }}>
                  <h3>Belum ada notifikasi</h3>
                  <p>
                    Pemberitahuan muncul di sini saat ada dokumen baru dibagikan kepada Anda atau
                    hak akses Anda berubah.
                  </p>
                </div>
              ) : (
                <div className="docs">
                  {notifs.map((n) => {
                    const belum = !String(n.readAt || "").trim();
                    return (
                      <div
                        key={n.notifId}
                        className={`doc${belum ? " doc--grant doc--on" : ""}`}
                        style={{ padding: "11px 14px" }}
                      >
                        <div className="doc__body">
                          <div style={{ fontSize: 13, fontWeight: belum ? 800 : 600 }}>{n.title}</div>
                          {n.detail && (
                            <p className="hint" style={{ marginTop: 3 }}>
                              {n.detail}
                            </p>
                          )}
                          <p className="hint" style={{ marginTop: 3 }}>
                            {new Date(n.createdAt).toLocaleString("id-ID")}
                          </p>
                        </div>
                        {belum && (
                          <button className="btn btn--sm" onClick={() => tandaiSatu(n.notifId)}>
                            Tandai dibaca
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
