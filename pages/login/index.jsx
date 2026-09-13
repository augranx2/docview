import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // ?sebab=idle dikirim oleh pengalih otomatis saat sesi hangus karena diam.
  const sesiHabis = router.query.sebab === "idle";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal");
        return;
      }
      router.push(data.role === "Admin" ? "/admin/dashboard" : "/viewer");
    } catch {
      setError("Terjadi kesalahan, coba lagi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Masuk — SIDOK</title>
      </Head>

      <div className="split">
        {/* ================= PANEL KIRI: IDENTITAS & NILAI SISTEM ================= */}
        <aside className="panel">
          <div className="grid-overlay" />
          <div className="glow" />

          <div className="brand">
            <div className="brand-mark">
              <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" />
            </div>
            <div>
              <p className="brand-name">PT. Rama Emerald Multi Sukses</p>
              <p className="brand-sub">SIDOK — Sistem Dokumen Terkendali</p>
            </div>
          </div>

          <div className="headline">
            <h1>
              Dokumen mutu,
              <br />
              <span>terkendali sampai ke pengguna.</span>
            </h1>
            <p>
              Setiap dokumen hanya terbuka bagi personel yang diberi akses, dan setiap
              salinan membawa identitas pengunduhnya.
            </p>
          </div>

          <ul className="points">
            <li>
              <span className="ico">👁</span> Hanya bisa dibaca — izin unduh diberikan per dokumen
            </li>
            <li>
              <span className="ico">🔖</span> Watermark identitas pengguna di setiap halaman
            </li>
            <li>
              <span className="ico">🕘</span> Audit trail mencatat akses, unduh, dan perubahan hak
            </li>
          </ul>
        </aside>

        {/* ================= PANEL KANAN: FORM ================= */}
        <main className="form-side">
          <div className="form-wrap">
            {/* Brand ringkas — hanya tampil saat panel kiri disembunyikan di layar sempit */}
            <div className="hero-mobile">
              <div className="hero-mobile__grid" />
              <div className="brand-mobile">
                <div className="brand-mark">
                  <img src="/logo-rama.png" alt="Logo" />
                </div>
                <div>
                  <p className="brand-name">PT. Rama Emerald Multi Sukses</p>
                  <p className="brand-sub">SIDOK — Sistem Dokumen Terkendali</p>
                </div>
              </div>
              <p className="hero-mobile__line">
                Dokumen mutu, terkendali sampai ke pengguna.
              </p>
            </div>

            <h2>Masuk ke SIDOK</h2>
            <p className="lead">
              Gunakan username dan password yang diberikan Administrator sistem.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="username personil"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="pw">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {sesiHabis && !error && (
                <p className="note">
                  Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk
                  kembali.
                </p>
              )}

              {error && <p className="error">⚠️ {error}</p>}

              <button type="submit" className="submit" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <p className="hint">Lupa password? Hubungi Administrator sistem untuk direset.</p>

            <ul className="points points--mobile">
              <li>
                <span className="ico">👁</span> Hanya bisa dibaca — izin unduh diberikan per dokumen
              </li>
              <li>
                <span className="ico">🔖</span> Watermark identitas pengguna di setiap halaman
              </li>
              <li>
                <span className="ico">🕘</span> Audit trail mencatat akses, unduh, dan perubahan hak
              </li>
            </ul>

            <p className="foot">Aktivitas login, akses, dan unduh tercatat dalam audit trail.</p>
          </div>
        </main>
      </div>

      <style jsx global>{`
        /* Halaman masuk menempel penuh ke tepi layar. Tanpa penegasan ini,
           margin bawaan peramban menyisakan bingkai putih di sekeliling panel. */
        html,
        body,
        #__next {
          margin: 0 !important;
          padding: 0 !important;
          height: 100%;
          background: #020b17;
          overflow: hidden;
        }
      `}</style>

      <style jsx>{`
        /* Dipasang dengan position: fixed terhadap viewport, bukan mengandalkan
           aliran dokumen. Dengan begitu margin atau padding apa pun yang
           tersisa pada body tidak dapat menyisakan bingkai putih di tepi
           layar — penyebab bingkai yang sebelumnya terlihat. */
        .split {
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* ---------- PANEL KIRI ---------- */
        .panel {
          position: relative;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 46px 52px;
          color: #ffffff;
          background: linear-gradient(150deg, #020b17 0%, #0b2545 52%, #15427d 100%);
        }
        /* Garis kisi tipis — memberi tekstur tanpa mengganggu keterbacaan teks */
        .grid-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 46px 46px;
          -webkit-mask-image: radial-gradient(ellipse at 30% 40%, black, transparent 75%);
          mask-image: radial-gradient(ellipse at 30% 40%, black, transparent 75%);
        }
        .glow {
          position: absolute;
          width: 520px;
          height: 520px;
          right: -180px;
          bottom: -200px;
          border-radius: 50%;
          filter: blur(100px);
          background: rgba(37, 99, 235, 0.35);
          pointer-events: none;
        }

        .brand,
        .brand-mobile {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          padding: 9px;
          border-radius: 13px;
          background: #ffffff;
          flex-shrink: 0;
        }
        .brand-mark img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .brand .brand-name {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .brand .brand-sub {
          margin: 2px 0 0;
          font-size: 11px;
          color: #bfdbfe;
        }

        .headline {
          position: relative;
          max-width: 460px;
        }
        .headline h1 {
          font-size: 40px;
          line-height: 1.14;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
        }
        .headline h1 span {
          color: #60a5fa;
        }
        .headline p {
          font-size: 14px;
          line-height: 1.65;
          color: #cbd5e1;
          margin: 0;
        }

        .points {
          position: relative;
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .points li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          color: #dbeafe;
        }
        .ico {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          font-size: 12px;
          flex-shrink: 0;
        }

        /* ---------- PANEL KANAN ---------- */
        .form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          background: #ffffff;
          overflow-y: auto;
        }
        .form-wrap {
          width: 100%;
          max-width: 370px;
        }
        /* Pita gradasi untuk layar sempit: membawa warna tema ke halaman masuk
           yang tanpa panel kiri akan terasa kosong. */
        .hero-mobile {
          display: none;
          position: relative;
          overflow: hidden;
          margin: -52px -20px 26px;
          padding: 30px 20px 26px;
          background: linear-gradient(150deg, #020b17 0%, #0b2545 55%, #15427d 100%);
          border-radius: 0 0 24px 24px;
        }
        .hero-mobile__grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          -webkit-mask-image: radial-gradient(ellipse at 25% 20%, black, transparent 78%);
          mask-image: radial-gradient(ellipse at 25% 20%, black, transparent 78%);
        }
        .hero-mobile__line {
          position: relative;
          margin: 16px 0 0;
          font-size: 19px;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
          color: #ffffff;
        }
        .brand-mobile {
          position: relative;
          margin-bottom: 0;
        }
        .brand-mobile .brand-mark {
          background: #ffffff;
        }
        .brand-mobile .brand-name {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.06em;
        }
        .brand-mobile .brand-sub {
          margin: 2px 0 0;
          font-size: 11px;
          color: #bfdbfe;
        }

        h2 {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .lead {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 26px;
          line-height: 1.55;
        }

        .field {
          margin-bottom: 16px;
        }
        .field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }
        .field input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 13.5px;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field input::placeholder {
          color: #94a3b8;
        }
        .field input:focus {
          border-color: #1e4d8f;
          box-shadow: 0 0 0 3px rgba(30, 77, 143, 0.13);
        }

        .pw {
          position: relative;
        }
        .pw input {
          padding-right: 44px;
        }
        .pw button {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: none;
          font-size: 14px;
          line-height: 1;
          padding: 8px;
          cursor: pointer;
          opacity: 0.55;
        }
        .pw button:hover {
          opacity: 1;
        }

        .note {
          color: #1e4d8f;
          font-size: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 10px;
          border-radius: 10px;
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .error {
          color: #dc2626;
          font-size: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 10px;
          border-radius: 10px;
          margin: 0 0 16px;
        }

        .submit {
          width: 100%;
          padding: 13px 16px;
          margin-top: 6px;
          border: none;
          border-radius: 10px;
          background: #1e4d8f;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .submit:hover:not(:disabled) {
          background: #16406f;
        }
        .submit:active:not(:disabled) {
          transform: translateY(1px);
        }
        .submit:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        /* Poin nilai versi layar sempit: warna netral karena berada di atas
           latar putih, bukan di atas panel gradasi. */
        .points--mobile {
          display: none;
          margin-top: 26px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }
        .points--mobile li {
          color: #64748b;
          font-size: 12px;
        }
        .points--mobile .ico {
          background: #eff6ff;
          border-color: #dbeafe;
        }

        .hint {
          text-align: center;
          font-size: 11.5px;
          color: #94a3b8;
          margin: 16px 0 0;
        }
        .foot {
          text-align: center;
          font-size: 11px;
          color: #cbd5e1;
          margin: 30px 0 0;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        /* ---------- LAYAR SEMPIT ----------
           Panel kiri disembunyikan, bukan ditumpuk di atas form: menumpuknya
           akan mendorong kolom isian jauh ke bawah layar. */
        @media (max-width: 900px) {
          .split {
            grid-template-columns: 1fr;
          }
          .panel {
            display: none;
          }
          .hero-mobile {
            display: block;
          }
          .points--mobile {
            display: flex;
          }
          .form-side {
            padding: 52px 20px 28px;
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}
