import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState({ nama: "", email: "", role: "Admin" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("daftar"); // daftar | tambah
  const [query, setQuery] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  // Formulir akun baru
  const kosong = { nama: "", username: "", role: "Viewer", status: "Aktif", password: "" };
  const [form, setForm] = useState(kosong);

  // Baris yang sedang disunting namanya, dan dialog reset password
  const [editNama, setEditNama] = useState(null); // { username, nama }
  const [resetFor, setResetFor] = useState(null); // { username, password }

  const router = useRouter();

  async function muat() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/manage-users");
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat daftar pengguna");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    muat();
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setMe({ nama: d.nama || d.email, email: d.email, role: d.role }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  /** Semua perubahan akun melewati satu endpoint; `aksi` menentukan jenisnya. */
  async function kirim(payload, sukses) {
    setSibuk(payload.username || payload.aksi);
    setPesan("");
    setError("");
    try {
      const res = await fetch("/api/admin/manage-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Perubahan gagal disimpan");
      setPesan(sukses);
      await muat();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSibuk("");
    }
  }

  async function tambahPengguna(e) {
    e.preventDefault();
    const ok = await kirim(
      { aksi: "tambah", ...form, username: form.username.trim(), nama: form.nama.trim() },
      `Akun ${form.username.trim()} berhasil dibuat.`
    );
    if (ok) {
      setForm(kosong);
      setTab("daftar");
    }
  }

  async function simpanReset(e) {
    e.preventDefault();
    const ok = await kirim(
      { aksi: "reset-password", username: resetFor.username, password: resetFor.password },
      `Password ${resetFor.username} berhasil direset.`
    );
    if (ok) setResetFor(null);
  }

  const cari = query.trim().toLowerCase();
  const tampil = [...users]
    .sort((a, b) => String(a.nama || a.username).localeCompare(String(b.nama || b.username), "id"))
    .filter(
    (u) =>
      !cari ||
      String(u.username).toLowerCase().includes(cari) ||
      String(u.nama || "").toLowerCase().includes(cari)
  );

  const jumlahAdmin = users.filter((u) => u.role === "Admin").length;
  const jumlahAktif = users.filter((u) => u.status === "Aktif").length;

  return (
    <>
      <Head>
        <title>Kelola Pengguna — SIDOK</title>
      </Head>

      <AppShell
        user={me}
        mode="admin"
        currentPath="/admin/users"
        nav={[
          { label: "Kelola dokumen", href: "/admin/dashboard", icon: "🗂" },
          { label: "Unggah dokumen", href: "/admin/upload", icon: "＋" },
        ]}
        categories={[]}
        selectedCategory={null}
        onSelectCategory={() => {}}
        totalCount={users.length}
        hideCategories
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Cari nama atau username"
        onLogout={handleLogout}
        loggingOut={loggingOut}
      >
        <div className="pagehead">
          <div>
            <h1>Kelola pengguna</h1>
            <p>
              {users.length} akun terdaftar — {jumlahAktif} aktif, {jumlahAdmin} di antaranya
              Administrator.
            </p>
          </div>
          <div className="pagehead__acts">
            <button
              className={`btn${tab === "daftar" ? " btn--primary" : ""}`}
              onClick={() => setTab("daftar")}
            >
              Daftar pengguna
            </button>
            <button
              className={`btn${tab === "tambah" ? " btn--primary" : ""}`}
              onClick={() => setTab("tambah")}
            >
              Tambah pengguna
            </button>
          </div>
        </div>

        {error && <p className="notice notice--bad" style={{ marginBottom: 12 }}>{error}</p>}
        {pesan && <p className="notice notice--ok" style={{ marginBottom: 12 }}>{pesan}</p>}

        {/* ---------------- TAMBAH PENGGUNA ---------------- */}
        {tab === "tambah" && (
          <form className="card card--pad stack" style={{ maxWidth: 560 }} onSubmit={tambahPengguna}>
            <div>
              <label className="label" htmlFor="u-nama">Nama personel</label>
              <input
                id="u-nama"
                className="input"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama lengkap sesuai data kepegawaian"
                required
              />
              <p className="hint" style={{ marginTop: 5 }}>
                Nama ini yang tercetak pada watermark dokumen yang dibuka dan diunduh.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="u-username">Username</label>
              <input
                id="u-username"
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="contoh: qa.udin"
                required
              />
              <p className="hint" style={{ marginTop: 5 }}>
                Tidak dapat diubah setelah akun dibuat, karena dipakai sebagai penanda pada
                catatan akses dan audit trail.
              </p>
            </div>

            <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
              <div className="grow">
                <label className="label" htmlFor="u-role">Peran</label>
                <select
                  id="u-role"
                  className="select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="Viewer">Pengguna — membaca dokumen yang dibagikan</option>
                  <option value="Admin">Administrator — mengelola dokumen dan akun</option>
                </select>
              </div>
              <div style={{ width: 170 }}>
                <label className="label" htmlFor="u-status">Status</label>
                <select
                  id="u-status"
                  className="select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="u-pass">Password awal</label>
              <input
                id="u-pass"
                className="input"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 6 karakter"
                minLength={6}
                required
              />
              <p className="hint" style={{ marginTop: 5 }}>
                Sampaikan password ini kepada yang bersangkutan dan minta segera menggantinya
                lewat menu Ganti password.
              </p>
            </div>

            <button type="submit" className="btn btn--primary" disabled={sibuk === "tambah"}>
              {sibuk === "tambah" ? "Menyimpan..." : "Buat akun"}
            </button>
          </form>
        )}

        {/* ---------------- DAFTAR PENGGUNA ---------------- */}
        {tab === "daftar" &&
          (loading ? (
            <p className="muted">
              <span className="spinner" style={{ marginRight: 8 }} />
              Memuat daftar pengguna...
            </p>
          ) : tampil.length === 0 ? (
            <div className="card empty">
              <h3>Tidak ada pengguna yang cocok</h3>
              <p>Ubah kata kunci pencarian di kolom atas.</p>
            </div>
          ) : (
            <div className="docs">
              {tampil.map((u) => {
                const sendiri = u.username === me.email;
                const busy = sibuk === u.username;
                return (
                  <div key={u.username} className="doc" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div className="doc__top">
                      <div className="doc__body">
                        {editNama && editNama.username === u.username ? (
                          <div className="row" style={{ gap: 6 }}>
                            <input
                              className="input"
                              style={{ width: 240 }}
                              autoFocus
                              value={editNama.nama}
                              onChange={(e) => setEditNama({ ...editNama, nama: e.target.value })}
                            />
                            <button
                              className="btn btn--primary btn--sm"
                              disabled={busy}
                              onClick={async () => {
                                const ok = await kirim(
                                  { aksi: "ubah", username: u.username, nama: editNama.nama },
                                  "Nama diperbarui."
                                );
                                if (ok) setEditNama(null);
                              }}
                            >
                              Simpan
                            </button>
                            <button className="btn btn--sm" onClick={() => setEditNama(null)}>
                              Batal
                            </button>
                          </div>
                        ) : (
                          <h2 className="doc__title">
                            {u.nama || "(tanpa nama)"}
                            {sendiri && (
                              <span className="pill" style={{ marginLeft: 8 }}>
                                Akun Anda
                              </span>
                            )}
                          </h2>
                        )}

                        <div className="doc__meta">
                          <span className="tag">{u.username}</span>
                          <i aria-hidden="true" />
                          <span>{u.role === "Admin" ? "Administrator" : "Pengguna"}</span>
                          <i aria-hidden="true" />
                          <span className={u.status === "Aktif" ? "pill pill--ok" : "pill"}>
                            {u.status || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="doc__acts">
                        <button
                          className="btn btn--sm"
                          disabled={busy}
                          onClick={() => setEditNama({ username: u.username, nama: u.nama || "" })}
                        >
                          Ubah nama
                        </button>

                        <select
                          className="select"
                          style={{ width: "auto", padding: "6px 8px", fontSize: 11.5 }}
                          value={u.role}
                          disabled={busy || sendiri}
                          title={sendiri ? "Peran akun sendiri tidak dapat diubah" : "Ubah peran"}
                          onChange={(e) =>
                            kirim(
                              { aksi: "ubah", username: u.username, role: e.target.value },
                              `Peran ${u.username} diubah.`
                            )
                          }
                        >
                          <option value="Viewer">Pengguna</option>
                          <option value="Admin">Administrator</option>
                        </select>

                        <select
                          className="select"
                          style={{ width: "auto", padding: "6px 8px", fontSize: 11.5 }}
                          value={u.status || "Aktif"}
                          disabled={busy || sendiri}
                          title={sendiri ? "Status akun sendiri tidak dapat diubah" : "Ubah status"}
                          onChange={(e) =>
                            kirim(
                              { aksi: "ubah", username: u.username, status: e.target.value },
                              `Status ${u.username} diubah.`
                            )
                          }
                        >
                          <option value="Aktif">Aktif</option>
                          <option value="Nonaktif">Nonaktif</option>
                        </select>

                        <button
                          className="btn btn--sm"
                          disabled={busy}
                          onClick={() => setResetFor({ username: u.username, password: "" })}
                        >
                          Reset password
                        </button>

                        <button
                          className="btn btn--danger btn--sm"
                          disabled={busy || sendiri}
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus akun ${u.username}?\n\nRiwayat audit trail tetap tersimpan, tetapi orang ini langsung kehilangan seluruh akses.`
                              )
                            ) {
                              kirim({ aksi: "hapus", username: u.username }, `Akun ${u.username} dihapus.`);
                            }
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </AppShell>

      {/* ---------------- RESET PASSWORD ---------------- */}
      {resetFor && (
        <div className="modal" onClick={() => setResetFor(null)}>
          <div className="modal__card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="card__title">Reset password</div>
                <div className="card__sub">Untuk akun {resetFor.username}</div>
              </div>
              <button className="x" onClick={() => setResetFor(null)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <form className="modal__body stack" onSubmit={simpanReset}>
              <div>
                <label className="label" htmlFor="reset-pw">Password baru</label>
                <input
                  id="reset-pw"
                  className="input"
                  type="text"
                  autoFocus
                  minLength={6}
                  required
                  value={resetFor.password}
                  onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                />
                <p className="hint" style={{ marginTop: 5 }}>
                  Password lama langsung tidak berlaku. Sampaikan password ini kepada yang
                  bersangkutan melalui jalur yang aman.
                </p>
              </div>
              <button type="submit" className="btn btn--primary btn--block" disabled={!!sibuk}>
                {sibuk ? "Menyimpan..." : "Simpan password baru"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
