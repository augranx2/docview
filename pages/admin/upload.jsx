import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB total per upload action

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export default function UploadPage() {
  const [files, setFiles] = useState([]); // [{ id, file, kategori, allowedUsers, status, progress, errorMsg }]
  const [uploading, setUploading] = useState(false);
  const [overallLabel, setOverallLabel] = useState("");
  const [error, setError] = useState("");
  const [doneSummary, setDoneSummary] = useState(null); // { success, failed }

  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);

  function handleFilesPicked(fileList) {
    setError("");
    setDoneSummary(null);
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;

    const rejected = [];
    const accepted = [];
    let runningTotal = totalBytes;

    for (const f of picked) {
      if (f.type !== "application/pdf") {
        rejected.push(`${f.name} (bukan PDF)`);
        continue;
      }
      if (runningTotal + f.size > MAX_TOTAL_BYTES) {
        rejected.push(`${f.name} (melebihi total 20MB)`);
        continue;
      }
      runningTotal += f.size;
      accepted.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        kategori: "",
        allowedUsers: "",
        allowDownload: false,
        status: "pending", // pending | uploading | done | error
        progress: 0,
        errorMsg: "",
      });
    }

    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    if (rejected.length > 0) {
      setError(`Tidak ditambahkan: ${rejected.join(", ")}`);
    }

    // Reset the raw <input> so picking the same file again re-triggers onChange
    const input = document.getElementById("file-input");
    if (input) input.value = "";
  }

  function updateFile(id, patch) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // Uploads one file directly to the Google Drive resumable session URL
  // using XMLHttpRequest (not fetch) because only XHR exposes real upload
  // progress events — fetch has no equivalent.
  function uploadToDriveWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Respons Google Drive tidak valid"));
          }
        } else {
          reject(new Error("Upload ke Google Drive gagal"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload ke Google Drive gagal (jaringan terputus)"));

      xhr.send(file);
    });
  }

  async function uploadOneFile(entry) {
    updateFile(entry.id, { status: "uploading", progress: 0, errorMsg: "" });

    // 1. Minta sesi upload resumable ke Google Drive.
    const initRes = await fetch("/api/documents/init-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: entry.file.name,
        mimeType: entry.file.type,
        fileSize: entry.file.size,
        kategori: entry.kategori,
      }),
    });
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error || "Gagal memulai upload");

    // 2. Upload file LANGSUNG dari browser ke Google Drive.
    const driveFile = await uploadToDriveWithProgress(
      initData.resumableSessionUrl,
      entry.file,
      (pct) => updateFile(entry.id, { progress: pct })
    );

    // 3. Selesaikan proses: set permission private, catat akses share.
    const accessUserEmails = entry.allowedUsers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const completeRes = await fetch("/api/documents/complete-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: initData.documentId,
        driveFileId: driveFile.id,
        accessUserEmails,
        allowDownload: entry.allowDownload,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error || "Gagal menyelesaikan upload");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Pilih minimal 1 file PDF terlebih dahulu");
      return;
    }

    setUploading(true);
    setError("");
    setDoneSummary(null);

    const successNames = [];
    const failedNames = [];

    // Sequential (not parallel) on purpose — keeps Apps Script call load
    // predictable and makes per-file progress easy to show clearly.
    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status === "done") {
        successNames.push(entry.file.name);
        continue; // already uploaded in a previous attempt, skip
      }
      setOverallLabel(`Mengunggah file ${i + 1} dari ${files.length}: ${entry.file.name}`);
      try {
        await uploadOneFile(entry);
        updateFile(entry.id, { status: "done", progress: 100 });
        successNames.push(entry.file.name);
      } catch (err) {
        updateFile(entry.id, { status: "error", errorMsg: err.message });
        failedNames.push(`${entry.file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    setOverallLabel("");
    setDoneSummary({ success: successNames, failed: failedNames });

    // Keep only the failed ones in the list so they're easy to retry;
    // successful uploads clear out.
    setFiles((prev) => prev.filter((f) => f.status === "error"));
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #e6eefb 0%, #eef3fb 180px, #f4f7fc 380px)", backgroundAttachment: "fixed", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", paddingBottom: 60 }}>

      {/* HEADER BAR */}
      <header style={{ height: 64, borderBottom: "1px solid #e2e8f0", background: "rgba(255,255,255,0.72)", backdropFilter: "blur(10px)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-rama.png" alt="Logo" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0 }}>PT. Rama Emerald Multi Sukses</p>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>Sistem Dokumen Terkendali</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/admin/dashboard"
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
          >
            ← Kembali ke Dashboard
          </Link>
          <button
            onClick={handleLogout}
            style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>

        {/* KOP HEADER BERGRADASI */}
        <div style={{ overflow: "hidden", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #000000 0%, #020b17 50%, #15427d 100%)", padding: "28px 24px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                📤
              </div>
              <div>
                <span style={{ display: "inline-block", background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#bfdbfe", marginBottom: 6 }}>
                  Administrator Only
                </span>
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Upload Dokumen Baru</h1>
                <p style={{ fontSize: 12, color: "#bfdbfe", margin: "4px 0 0" }}>
                  Bisa pilih beberapa file sekaligus — tiap file bisa diatur kategori & akses berbagi masing-masing
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM UPLOAD */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* INPUT FILE */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Tambah File PDF
              </label>
              <div style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: 20, textAlign: "center", background: "#f8fafc", cursor: "pointer", position: "relative" }}>
                <input
                  id="file-input"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => handleFilesPicked(e.target.files)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
                <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                  Klik atau seret satu/beberapa file PDF ke sini
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Total gabungan semua file maksimal 20MB per proses upload
                </div>
              </div>

              {/* INDIKATOR TOTAL UKURAN */}
              {files.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    <span>{files.length} file dipilih</span>
                    <span style={{ fontWeight: 700, color: totalBytes > MAX_TOTAL_BYTES * 0.9 ? "#dc2626" : "#334155" }}>
                      {formatMB(totalBytes)} / 20 MB
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100)}%`,
                        background: totalBytes > MAX_TOTAL_BYTES * 0.9 ? "#dc2626" : "#1e4d8f",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* DAFTAR FILE */}
            {files.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                  background: entry.status === "error" ? "#fef2f2" : "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.file.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatMB(entry.file.size)} MB</div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFile(entry.id)}
                      style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}
                      title="Hapus dari daftar"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Kategori (opsional)"
                    value={entry.kategori}
                    disabled={uploading}
                    onChange={(e) => updateFile(entry.id, { kategori: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, outline: "none" }}
                  />
                  <input
                    type="text"
                    placeholder="Bagikan ke (username, koma)"
                    value={entry.allowedUsers}
                    disabled={uploading}
                    onChange={(e) => updateFile(entry.id, { allowedUsers: e.target.value })}
                    style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, outline: "none" }}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, color: "#475569", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={entry.allowDownload}
                    disabled={uploading}
                    onChange={(e) => updateFile(entry.id, { allowDownload: e.target.checked })}
                  />
                  Izinkan user di atas <strong>men-download file asli</strong> (default: lihat saja)
                </label>

                {entry.status === "uploading" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 5, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${entry.progress}%`, background: "#1e4d8f", borderRadius: 999, transition: "width 0.2s ease" }} />
                    </div>
                  </div>
                )}
                {entry.status === "done" && (
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6, fontWeight: 600 }}>✓ Selesai</div>
                )}
                {entry.status === "error" && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>⚠️ {entry.errorMsg}</div>
                )}
              </div>
            ))}

            {/* NOTIFIKASI */}
            {error && (
              <div style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
                ⚠️ {error}
              </div>
            )}
            {doneSummary && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doneSummary.success.length > 0 && (
                  <div style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
                    ✓ {doneSummary.success.length} dokumen berhasil diunggah: {doneSummary.success.join(", ")}
                  </div>
                )}
                {doneSummary.failed.length > 0 && (
                  <div style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
                    ⚠️ {doneSummary.failed.length} gagal — perbaiki lalu upload ulang: {doneSummary.failed.join("; ")}
                  </div>
                )}
              </div>
            )}

            {/* LABEL PROGRESS KESELURUHAN */}
            {uploading && (
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{overallLabel}</div>
            )}

            {/* TOMBOL SUBMIT */}
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              style={{ padding: "12px", borderRadius: 12, background: uploading || files.length === 0 ? "#cbd5e1" : "#1e4d8f", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: uploading || files.length === 0 ? "not-allowed" : "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}
            >
              {uploading
                ? "Mengunggah..."
                : files.length > 0
                ? `Upload ${files.length} Dokumen (${formatMB(totalBytes)} MB)`
                : "Upload Sekarang"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
