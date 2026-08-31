import { useState } from "react";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

export default function AdminUploadPage() {
  const [file, setFile] = useState(null);
  const [kategori, setKategori] = useState("");
  const [emailsInput, setEmailsInput] = useState(""); // comma-separated for simplicity
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf") {
      setStatus("Hanya file PDF yang diperbolehkan");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("Ukuran file melebihi 20MB");
      return;
    }

    try {
      setStatus("Menyiapkan sesi upload...");

      // 1. Init upload: creates a pending Documents row + Drive resumable session
      const initRes = await fetch("/api/documents/init-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          kategori,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        setStatus(initData.error || "Gagal memulai upload");
        return;
      }

      // 2. Upload the file bytes directly to Google Drive (bypasses Vercel body limit)
      setStatus("Mengunggah file ke Google Drive...");
      const uploadRes = await fetch(initData.resumableSessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
        },
        body: file,
      });
      if (!uploadRes.ok) {
        setStatus("Upload ke Google Drive gagal");
        return;
      }
      const driveFile = await uploadRes.json();

      // 3. Complete upload: set private permission, grant access, log audit
      setStatus("Menyelesaikan proses...");
      const accessUserEmails = emailsInput
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const completeRes = await fetch("/api/documents/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: initData.documentId,
          driveFileId: driveFile.id,
          accessUserEmails,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        setStatus(completeData.error || "Gagal menyelesaikan upload");
        return;
      }

      setStatus("Berhasil! Dokumen sudah dibagikan.");
      setFile(null);
      setEmailsInput("");
      setKategori("");
    } catch (err) {
      console.error(err);
      setStatus(`Terjadi kesalahan: ${err.message || "tidak diketahui"}`);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/admin/dashboard">← Kembali ke Dashboard</Link>
        <LogoutButton />
      </div>
      <h2>Upload Dokumen</h2>
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: 12 }}>
          <label>File PDF (maks. 20MB)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ display: "block", marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Kategori (opsional)</label>
          <input
            type="text"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Bagikan ke (username, pisahkan dengan koma)</label>
          <textarea
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 8 }}
            placeholder="qc.udin, qa.anggara"
          />
        </div>
        <button type="submit" style={{ padding: "8px 16px" }}>
          Upload
        </button>
      </form>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </div>
  );
}
