import Head from "next/head";
import { useState, useEffect } from "react";
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
  const [categories, setCategories] = useState([]);

  const router = useRouter();

  // Daftar kategori diambil dari dokumen yang sudah ada, supaya admin memilih
  // ulang kategori lama alih-alih mengetiknya sedikit berbeda tiap kali.
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]));
  }, []);

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
        kategoriBaru: false,
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
    // Kategori menentukan folder tujuan di Drive, jadi divalidasi di sini juga
    // supaya admin tidak menunggu upload berjalan hanya untuk ditolak server.
    const tanpaKategori = files.filter((f) => !f.kategori.trim());
    if (tanpaKategori.length > 0) {
      setError(
        `Kategori wajib dipilih untuk semua file. Belum diisi: ${tanpaKategori
          .map((f) => f.file.name)
          .join(", ")}`
      );
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
    <>
      <Head>
        <title>Unggah Dokumen — SIDOK</title>
      </Head>

      <div className="main" style={{ minHeight: "100vh" }}>
        <header className="appbar">
          <Link href="/admin/dashboard" className="btn btn--sm">
            ← Kembali
          </Link>
          <div className="grow" />
          <button className="btn btn--sm" onClick={handleLogout}>
            Keluar
          </button>
        </header>

        <div className="sheet" style={{ maxWidth: 760 }}>
          <div className="pagehead">
            <div>
              <h1>Unggah dokumen</h1>
              <p>
                Pilih satu atau beberapa berkas PDF sekaligus. Kategori menentukan folder
                penyimpanan di Google Drive, jadi wajib diisi.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
            {/* ---------- AREA PILIH BERKAS ---------- */}
            <label
              htmlFor="pdf-input"
              className="card"
              style={{
                display: "block",
                padding: "30px 20px",
                textAlign: "center",
                borderStyle: "dashed",
                borderColor: "var(--blue-100)",
                background: "linear-gradient(180deg, #fbfdff, #f4f9ff)",
                cursor: uploading ? "not-allowed" : "pointer",
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }} aria-hidden="true">
                📄
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                Klik atau seret berkas PDF ke sini
              </div>
              <p className="hint" style={{ marginTop: 4 }}>
                Maksimal {formatMB(MAX_TOTAL_BYTES)} MB untuk seluruh berkas dalam satu kali unggah
              </p>
              <input
                id="pdf-input"
                type="file"
                accept="application/pdf"
                multiple
                disabled={uploading}
                onChange={(e) => handleFilesPicked(e.target.files)}
                style={{ display: "none" }}
              />
            </label>

            {files.length > 0 && (
              <div>
                <div className="row row--between" style={{ marginBottom: 6 }}>
                  <span className="hint">{files.length} berkas dipilih</span>
                  <span className="hint" style={{ fontWeight: 700, color: totalBytes > MAX_TOTAL_BYTES ? "var(--danger)" : "var(--ink-2)" }}>
                    {formatMB(totalBytes)} / {formatMB(MAX_TOTAL_BYTES)} MB
                  </span>
                </div>
                <div className="bar">
                  <div
                    style={{
                      width: `${Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100)}%`,
                      background:
                        totalBytes > MAX_TOTAL_BYTES ? "var(--danger)" : undefined,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ---------- DAFTAR BERKAS ---------- */}
            {files.map((entry) => (
              <div key={entry.id} className="card card--pad">
                <div className="card__head" style={{ marginBottom: 10 }}>
                  <div className="grow">
                    <div className="card__title" style={{ wordBreak: "break-word" }}>
                      {entry.file.name}
                    </div>
                    <div className="card__sub">{formatMB(entry.file.size)} MB</div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      className="x"
                      onClick={() => removeFile(entry.id)}
                      aria-label={`Buang ${entry.file.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="file-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="label">Kategori</label>
                    <select
                      className={`select${entry.kategori.trim() ? "" : " input--bad"}`}
                      value={entry.kategoriBaru ? "__new__" : entry.kategori}
                      disabled={uploading}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__new__") updateFile(entry.id, { kategoriBaru: true, kategori: "" });
                        else updateFile(entry.id, { kategoriBaru: false, kategori: v });
                      }}
                    >
                      <option value="">Pilih kategori</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__new__">Buat kategori baru</option>
                    </select>
                    {entry.kategoriBaru && (
                      <input
                        className="input"
                        style={{ marginTop: 6 }}
                        type="text"
                        placeholder="Nama kategori baru"
                        value={entry.kategori}
                        disabled={uploading}
                        autoFocus
                        onChange={(e) => updateFile(entry.id, { kategori: e.target.value })}
                      />
                    )}
                  </div>

                  <div>
                    <label className="label">Bagikan ke</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="username, pisahkan dengan koma"
                      value={entry.allowedUsers}
                      disabled={uploading}
                      onChange={(e) => updateFile(entry.id, { allowedUsers: e.target.value })}
                    />
                  </div>
                </div>

                <label className="check" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={entry.allowDownload}
                    disabled={uploading}
                    onChange={(e) => updateFile(entry.id, { allowDownload: e.target.checked })}
                  />
                  <span>
                    Izinkan penerima mengunduh berkas asli. Bila tidak dicentang, mereka hanya bisa
                    membacanya.
                  </span>
                </label>

                {entry.status === "uploading" && (
                  <div style={{ marginTop: 10 }}>
                    <div className="bar">
                      <div style={{ width: `${entry.progress}%` }} />
                    </div>
                    <p className="hint" style={{ marginTop: 5 }}>Mengunggah {entry.progress}%</p>
                  </div>
                )}
                {entry.status === "done" && (
                  <p className="notice notice--ok" style={{ marginTop: 10 }}>Berhasil diunggah</p>
                )}
                {entry.status === "error" && (
                  <p className="notice notice--bad" style={{ marginTop: 10 }}>{entry.errorMsg}</p>
                )}
              </div>
            ))}

            {error && <p className="notice notice--bad">{error}</p>}

            {doneSummary && (
              <p className={`notice ${doneSummary.failed > 0 ? "notice--warn" : "notice--ok"}`}>
                {doneSummary.success} berkas berhasil diunggah
                {doneSummary.failed > 0 && `, ${doneSummary.failed} gagal`}.
              </p>
            )}

            {overallLabel && <p className="hint">{overallLabel}</p>}

            <button
              type="submit"
              className="btn btn--primary btn--block"
              style={{ padding: "12px 18px", fontSize: 13.5 }}
              disabled={uploading || files.length === 0}
            >
              {uploading
                ? "Mengunggah..."
                : files.length === 0
                ? "Pilih berkas terlebih dahulu"
                : `Unggah ${files.length} dokumen (${formatMB(totalBytes)} MB)`}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
