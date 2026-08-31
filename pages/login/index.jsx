import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        
        {/* BRAND HEADER DENGAN LOGO RAMA */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #000000 0%, #1a0307 50%, #6b1826 100%)", boxShadow: "0 4px 12px rgba(106,24,38,0.2)", marginBottom: 14, padding: 12 }}>
            <img src="/logo-rama.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Sistem Dokumen Terkendali</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>PT. Rama Emerald Multi Sukses</p>
        </div>

        {/* KARTU FORM LOGIN */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 10px 25px -5px rgba(15,23,42,0.08)", padding: "32px 28px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Username</label>
              <input
                type="text"
                style={{ width: "100%", padding: "11px 14px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, outline: "none", background: "#f8fafc", color: "#0f172a" }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Masukkan username Anda..."
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Password</label>
              <input
                type="password"
                style={{ width: "100%", padding: "11px 14px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 13, outline: "none", background: "#f8fafc", color: "#0f172a" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", padding: 10, borderRadius: 10, border: "1px solid #fecaca", marginBottom: 16 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px 16px", borderRadius: 12, background: "#8a1f2f", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(138,31,47,0.3)", transition: "background 0.15s" }}
            >
              {loading ? "Memproses..." : "Masuk Sistem"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}