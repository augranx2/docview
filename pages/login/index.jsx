import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    <div className="login-bg">
      {/* Lapisan dekoratif: dua bola cahaya biru + pola titik halus.
          Murni CSS, tidak ada file gambar tambahan yang perlu di-load. */}
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="dots" />

      <div className="login-shell">
        {/* BRAND HEADER DENGAN LOGO RAMA */}
        <div className="brand">
          <div className="brand-logo">
            <img src="/logo-rama.png" alt="Logo" />
          </div>
          <h1>Sistem Dokumen Terkendali</h1>
          <p>PT. Rama Emerald Multi Sukses</p>
        </div>

        {/* KARTU FORM LOGIN */}
        <div className="card">
          <div className="card-head">
            <span className="pill">🔒 Akses Terbatas</span>
            <h2>Masuk ke akun Anda</h2>
            <p>Gunakan username dan password yang diberikan Administrator.</p>
          </div>

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
                placeholder="Masukkan username Anda..."
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
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
                  className="peek"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && <p className="error">⚠️ {error}</p>}

            <button type="submit" className="submit" disabled={loading}>
              {loading ? "Memproses..." : "Masuk Sistem"}
            </button>
          </form>
        </div>

        <p className="foot">
          Dokumen di sistem ini bersifat terkendali. Setiap aktivitas login, akses, dan
          unduh tercatat dalam audit log.
        </p>
      </div>

      <style jsx>{`
        .login-bg {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(160deg, #010810 0%, #0b2545 45%, #15427d 100%);
        }

        /* Bola cahaya — memberi kedalaman tanpa membuat teks sulit dibaca. */
        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }
        .glow-a {
          width: 460px;
          height: 460px;
          top: -160px;
          right: -120px;
          background: rgba(59, 130, 246, 0.38);
        }
        .glow-b {
          width: 420px;
          height: 420px;
          bottom: -180px;
          left: -140px;
          background: rgba(37, 99, 235, 0.28);
        }

        /* Pola titik halus, memudar ke bawah supaya tidak mengganggu kartu. */
        .dots {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
          background-size: 26px 26px;
          -webkit-mask-image: linear-gradient(to bottom, black, transparent 70%);
          mask-image: linear-gradient(to bottom, black, transparent 70%);
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
        }

        .brand {
          text-align: center;
          margin-bottom: 22px;
        }
        .brand-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 68px;
          height: 68px;
          padding: 14px;
          margin-bottom: 14px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 24px rgba(2, 11, 23, 0.45);
        }
        .brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }
        .brand h1 {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .brand p {
          font-size: 13px;
          color: #bfdbfe;
          margin: 0;
        }

        .card {
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 22px;
          padding: 28px 26px;
          box-shadow: 0 24px 48px -12px rgba(1, 8, 16, 0.55);
        }
        .card-head {
          margin-bottom: 20px;
        }
        .pill {
          display: inline-block;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e4d8f;
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .card-head h2 {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
        }
        .card-head p {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }

        .field {
          margin-bottom: 16px;
        }
        .field label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .field input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 13px;
          background: #f8fafc;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .field input::placeholder {
          color: #94a3b8;
        }
        .field input:focus {
          border-color: #1e4d8f;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(30, 77, 143, 0.15);
        }

        .password-wrap {
          position: relative;
        }
        .password-wrap input {
          padding-right: 44px;
        }
        .peek {
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
          opacity: 0.6;
        }
        .peek:hover {
          opacity: 1;
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
          padding: 12px 16px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #1e4d8f 0%, #2563eb 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(30, 77, 143, 0.35);
          transition: transform 0.12s, box-shadow 0.15s, filter 0.15s;
        }
        .submit:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: 0 8px 20px rgba(30, 77, 143, 0.45);
        }
        .submit:active:not(:disabled) {
          transform: translateY(1px);
        }
        .submit:disabled {
          background: #94a3b8;
          box-shadow: none;
          cursor: not-allowed;
        }

        .foot {
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
          color: rgba(191, 219, 254, 0.75);
          margin: 18px auto 0;
          max-width: 330px;
        }

        /* Di layar pendek, kurangi padding supaya kartu tidak terpotong. */
        @media (max-height: 700px) {
          .brand {
            margin-bottom: 14px;
          }
          .brand-logo {
            width: 56px;
            height: 56px;
            margin-bottom: 10px;
          }
          .foot {
            margin-top: 12px;
          }
        }
      `}</style>
    </div>
  );
}
