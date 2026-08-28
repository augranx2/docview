import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function DocumentListPage() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
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
      .catch(() => setError("Gagal memuat daftar dokumen"));
  }, [router]);

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Dokumen Saya</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {docs.map((doc) => (
          <li
            key={doc.documentId}
            style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              marginBottom: 8,
              cursor: "pointer",
            }}
            onClick={() => router.push(`/viewer/${doc.documentId}`)}
          >
            <strong>{doc.namaDokumen}</strong>
            {doc.kategori && <span style={{ color: "#888" }}> · {doc.kategori}</span>}
          </li>
        ))}
        {docs.length === 0 && !error && <p>Belum ada dokumen yang dibagikan ke Anda.</p>}
      </ul>
    </div>
  );
}
