import { useState } from "react";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

export default function AdminUploadPage() {
  const [file, setFile] = useState(null);
  const [kategori, setKategori] = useState("");
  const [emailsInput, setEmailsInput] = useState(""); // comma-separated for simplicity
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState(""); // "" | "error" | "success"
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf") {
      setStatus("Hanya file PDF yang diperbolehkan");
      setStatusType("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("Ukuran file melebihi 20MB");
      setStatusType("error");
      return;
    }

    setUploading(true);
    setStatusType("");
    try {
      setStatus("Menyiapkan sesi upload...");

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
        setStatusType("error");
        return;
      }

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
        setStatusType("error");
        return;
      }
      const driveFile = await uploadRes.json();

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
        setStatusType("error");
        return;
      }

      setStatus("Berhasil! Dokumen sudah dibagikan.");
      setStatusType("success");
      setFile(null);
      setEmailsInput("");
      setKategori("");
      e.target.reset();
    } catch (err) {
      setStatus(`Terjadi kesalahan: ${err.message || "tidak diketahui"}`);
      setStatusType("error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link href="/admin/dashboard" className="back-link">
          ← Kembali ke Dashboard
        </Link>
        <LogoutButton />
      </div>

      <h1 className="page-title">Upload Dokumen</h1>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        Dokumen akan disimpan ke Google Drive kantor dan dibagikan ke user yang dipilih.
      </p>

      <div className="card">
        <form onSubmit={handleUpload}>
          <div className="field">
            <label className="label">File PDF (maks. 20MB)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="input"
              required
            />
          </div>
          <div className="field">
            <label className="label">Kategori (opsional)</label>
            <input
              type="text"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="input"
              placeholder="mis. SOP, Surat, Denah"
            />
          </div>
          <div className="field">
            <label className="label">Bagikan ke (username, pisahkan dengan koma)</label>
            <textarea
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              rows={3}
              className="textarea"
              placeholder="qc.udin, qa.anggara"
            />
          </div>
          <button type="submit" disabled={uploading} className="btn btn-primary btn-block">
            {uploading ? <span className="spinner" /> : "Upload"}
          </button>
        </form>
        {status && (
          <p
            className={statusType === "error" ? "error-text" : "status-text"}
            style={{ marginTop: 14, marginBottom: 0 }}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
