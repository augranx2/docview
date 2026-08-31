import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import LogoutButton from "../../components/LogoutButton";

export default function DocumentListPage() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
  }, [router]);

  // Group by kategori so the list reads cleanly when there are many documents.
  const grouped = docs.reduce((acc, doc) => {
    const key = doc.kategori || "Lainnya";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Dokumen Saya</h2>
          <p style={{ color: "#888", marginTop: 0, fontSize: 14 }}>
            Dokumen yang telah dibagikan kepada Anda.
          </p>
        </div>
        <LogoutButton />
      </div>

      {loading && <p>Memuat...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading &&
        Object.entries(grouped).map(([kategori, items]) => (
          <div key={kategori} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: "bold",
                color: "#888",
                textTransform: "uppercase",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              {kategori}
            </div>
            {items.map((doc) => (
              <div
                key={doc.documentId}
                onClick={() => router.push(`/viewer/${doc.documentId}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fafafa";
                  e.currentTarget.style.borderColor = "#ccc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "#e5e5e5";
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden>
                  📄
                </span>
                <span style={{ fontWeight: 500 }}>{doc.namaDokumen}</span>
              </div>
            ))}
          </div>
        ))}

      {!loading && docs.length === 0 && !error && (
        <p style={{ color: "#888" }}>Belum ada dokumen yang dibagikan ke Anda.</p>
      )}
    </div>
  );
}
