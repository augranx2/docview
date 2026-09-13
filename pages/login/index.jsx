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

      <div className="lg-split">
        {/* ================= PANEL KIRI: IDENTITAS & NILAI SISTEM ================= */}
        <aside className="lg-panel">
          <div className="lg-grid-overlay" />
          <div className="lg-glow" />

          <div className="lg-brand">
            <div className="lg-brand-mark">
              <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" />
            </div>
            <div>
              <p className="lg-brand-name">PT. Rama Emerald Multi Sukses</p>
              <p className="lg-brand-sub">SIDOK — Sistem Dokumen Terkendali</p>
            </div>
          </div>

          <div className="lg-headline">
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

          <ul className="lg-points">
            <li>
              <span className="lg-ico">👁</span> Hanya bisa dibaca — izin unduh diberikan per dokumen
            </li>
            <li>
              <span className="lg-ico">🔖</span> Watermark identitas pengguna di setiap halaman
            </li>
            <li>
              <span className="lg-ico">🕘</span> Audit trail mencatat akses, unduh, dan perubahan hak
            </li>
          </ul>
        </aside>

        {/* ================= PANEL KANAN: FORM ================= */}
        <main className="lg-form-side">
          <div className="lg-form-wrap">
            {/* Pita gradasi — hanya tampil saat panel kiri disembunyikan di layar sempit,
                supaya warna tema tetap hadir tanpa mendorong kolom isian ke bawah. */}
            <div className="lg-hero-mobile">
              <div className="lg-hero-mobile__grid" />
              <div className="lg-brand-mobile">
                <div className="lg-brand-mark">
                  <img src="/logo-rama.png" alt="Logo" />
                </div>
                <div>
                  <p className="lg-brand-name">PT. Rama Emerald Multi Sukses</p>
                  <p className="lg-brand-sub">SIDOK — Sistem Dokumen Terkendali</p>
                </div>
              </div>
              <p className="lg-hero-mobile__line">Dokumen mutu, terkendali sampai ke pengguna.</p>
            </div>

            <h2>Masuk ke SIDOK</h2>
            <p className="lg-lead">
              Gunakan username dan password yang diberikan Administrator sistem.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="lg-field">
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

              <div className="lg-field">
                <label htmlFor="password">Password</label>
                <div className="lg-pw">
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
                <p className="lg-note">
                  Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk
                  kembali.
                </p>
              )}

              {error && <p className="lg-error">⚠️ {error}</p>}

              <button type="submit" className="lg-submit" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <p className="lg-hint">Lupa password? Hubungi Administrator sistem untuk direset.</p>

            <ul className="lg-points lg-points--mobile">
              <li>
                <span className="lg-ico">👁</span> Hanya bisa dibaca — izin unduh diberikan per dokumen
              </li>
              <li>
                <span className="lg-ico">🔖</span> Watermark identitas pengguna di setiap halaman
              </li>
              <li>
                <span className="lg-ico">🕘</span> Audit trail mencatat akses, unduh, dan perubahan hak
              </li>
            </ul>

            <p className="lg-foot">Aktivitas login, akses, dan unduh tercatat dalam audit trail.</p>
          </div>
        </main>
      </div>

      {/* Penegasan tanpa efek samping: hanya menghapus margin bawaan peramban dan
          menyamakan warna latar. Tidak mengubah tata letak, tidak menimbulkan
          batang gulir. */}
      <style jsx global>{`
        /* Halaman masuk mengambil alih seluruh viewport.

           Catatan penyebab: sudut membulat dan celah gelap di tepi panel kiri
           dahulu berasal dari kelas .panel di styles/globals.css yang kebetulan
           bernama sama dengan kelas di halaman ini — aturan globalnya membawa
           margin-top dan border-radius. Seluruh kelas halaman ini kini diberi
           awalan lg- sehingga tabrakan nama tidak mungkin terjadi lagi. */
        html,
        body,
        #__next {
          margin: 0 !important;
          padding: 0 !important;
          border-radius: 0 !important;
          height: 100%;
          background: #020b17;
        }

        @media (min-width: 901px) {
          html,
          body {
            overflow: hidden;
          }
        }
      `}</style>

      <style jsx>{`
        /* Ditambatkan ke viewport, bukan mengikuti aliran dokumen. Dengan
           begitu tidak ada margin, padding, atau sudut membulat di tingkat
           halaman yang dapat menyisakan bingkai di tepi layar.
           Tidak ada overflow: auto di mana pun, jadi batang gulir tidak
           mungkin muncul di dalam panel. */
        .lg-split {
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* ---------- PANEL KIRI ---------- */
        .lg-panel {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 46px 52px;
          color: #ffffff;
          background: linear-gradient(150deg, #020b17 0%, #0b2545 52%, #15427d 100%);
        }
        /* Garis kisi tipis — memberi tekstur tanpa mengganggu keterbacaan teks */
        .lg-grid-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 46px 46px;
          -webkit-mask-image: radial-gradient(ellipse at 30% 40%, black, transparent 75%);
          mask-image: radial-gradient(ellipse at 30% 40%, black, transparent 75%);
        }
        .lg-glow {
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

        .lg-brand,
        .lg-brand-mobile {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lg-brand-mark {
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
        .lg-brand-mark img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .lg-brand .lg-brand-name {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .lg-brand .lg-brand-sub {
          margin: 2px 0 0;
          font-size: 11px;
          color: #bfdbfe;
        }

        .lg-headline {
          position: relative;
          max-width: 460px;
        }
        .lg-headline h1 {
          font-size: 40px;
          line-height: 1.14;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
        }
        .lg-headline h1 span {
          color: #60a5fa;
        }
        .lg-headline p {
          font-size: 14px;
          line-height: 1.65;
          color: #cbd5e1;
          margin: 0;
        }

        .lg-points {
          position: relative;
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lg-points li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          color: #dbeafe;
        }
        .lg-ico {
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
        .lg-form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          background: #ffffff;
        }
        .lg-form-wrap {
          width: 100%;
          max-width: 370px;
        }

        /* Pita gradasi untuk layar sempit */
        .lg-hero-mobile {
          display: none;
          position: relative;
          overflow: hidden;
          margin: -52px -20px 26px;
          padding: 30px 20px 26px;
          background: linear-gradient(150deg, #020b17 0%, #0b2545 55%, #15427d 100%);
          border-radius: 0 0 24px 24px;
        }
        .lg-hero-mobile__grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          -webkit-mask-image: radial-gradient(ellipse at 25% 20%, black, transparent 78%);
          mask-image: radial-gradient(ellipse at 25% 20%, black, transparent 78%);
        }
        .lg-hero-mobile__line {
          position: relative;
          margin: 16px 0 0;
          font-size: 19px;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
          color: #ffffff;
        }
        .lg-brand-mobile {
          position: relative;
          margin-bottom: 0;
        }
        .lg-brand-mobile .lg-brand-name {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #ffffff;
        }
        .lg-brand-mobile .lg-brand-sub {
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
        .lg-lead {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 26px;
          line-height: 1.55;
        }

        .lg-field {
          margin-bottom: 16px;
        }
        .lg-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }
        .lg-field input {
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
        .lg-field input::placeholder {
          color: #94a3b8;
        }
        .lg-field input:focus {
          border-color: #1e4d8f;
          box-shadow: 0 0 0 3px rgba(30, 77, 143, 0.13);
        }

        .lg-pw {
          position: relative;
        }
        .lg-pw input {
          padding-right: 44px;
        }
        .lg-pw button {
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
        .lg-pw button:hover {
          opacity: 1;
        }

        .lg-note {
          color: #1e4d8f;
          font-size: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 10px;
          border-radius: 10px;
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .lg-error {
          color: #dc2626;
          font-size: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 10px;
          border-radius: 10px;
          margin: 0 0 16px;
        }

        .lg-submit {
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
        .lg-submit:hover:not(:disabled) {
          background: #16406f;
        }
        .lg-submit:active:not(:disabled) {
          transform: translateY(1px);
        }
        .lg-submit:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        /* Poin nilai versi layar sempit: warna netral karena berada di atas
           latar putih, bukan di atas panel gradasi. */
        .lg-points--mobile {
          display: none;
          margin-top: 26px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }
        .lg-points--mobile li {
          color: #64748b;
          font-size: 12px;
        }
        .lg-points--mobile .lg-ico {
          background: #eff6ff;
          border-color: #dbeafe;
        }

        .lg-hint {
          text-align: center;
          font-size: 11.5px;
          color: #94a3b8;
          margin: 16px 0 0;
        }
        .lg-foot {
          text-align: center;
          font-size: 11px;
          color: #cbd5e1;
          margin: 30px 0 0;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        /* ---------- LAYAR SEMPIT ----------
           Panel kiri disembunyikan, digantikan pita gradasi di atas form:
           menumpuk panel penuh akan mendorong kolom isian jauh ke bawah layar. */
        @media (max-width: 900px) {
          /* Di layar sempit halaman kembali mengikuti aliran dokumen supaya
             isinya dapat digulir bila papan ketik virtual muncul. */
          .lg-split {
            position: static;
            min-height: 100vh;
            grid-template-columns: 1fr;
          }
          .lg-panel {
            display: none;
          }
          .lg-hero-mobile {
            display: block;
          }
          .lg-points--mobile {
            display: flex;
          }
          .lg-form-side {
            padding: 52px 20px 28px;
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}
