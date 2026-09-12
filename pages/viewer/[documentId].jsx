import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DownloadButton from "../../components/DownloadButton";

export default function ViewerPage() {
  const router = useRouter();
  const { documentId } = router.query;
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const [canDownload, setCanDownload] = useState(false);
  const [namaDokumen, setNamaDokumen] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const [copied, setCopied] = useState(false);
  // Kanvas tiap halaman disimpan di ref, bukan state: dipakai untuk scroll dan
  // untuk mendeteksi halaman yang sedang terlihat, keduanya tidak perlu render ulang.
  const pageCanvasesRef = useRef([]);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;

    async function loadAndRender() {
      // pdf.js is loaded dynamically because it relies on browser APIs
      // (no SSR) and needs its worker file set up.
      const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
      // Use whatever version actually got installed (npm may resolve a
      // newer patch than what's pinned in package.json) so the worker file
      // always matches the API version exactly — a mismatch here is a hard
      // error in pdf.js.
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      // 0. Get current user email for the watermark.
      const meRes = await fetch("/api/auth/me");
      const me = meRes.ok ? await meRes.json() : { email: "", role: "" };

      // 1. Ask the backend for permission + a short-lived view token.
      const tokenRes = await fetch("/api/documents/request-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const tokenData = await tokenRes.json();
      // The same call tells us whether this user may download THIS document
      // (Admin always, a Viewer only if the Admin ticked the download box).
      if (!cancelled) {
        setCanDownload(!!tokenData.canDownload);
        setNamaDokumen(tokenData.namaDokumen || "");
      }
      if (!tokenRes.ok) {
        setStatus("error");
        setErrorMsg(tokenData.error || "Tidak bisa membuka dokumen");
        return;
      }

      // 2. Fetch the PDF bytes via the token-protected stream endpoint.
      const pdfRes = await fetch(`/api/documents/stream?token=${tokenData.viewToken}`);
      if (!pdfRes.ok) {
        setStatus("error");
        setErrorMsg("Gagal memuat file dokumen");
        return;
      }
      const arrayBuffer = await pdfRes.arrayBuffer();

      // 3. Render every page onto a <canvas>. The browser only ever holds
      //    rendered pixels here, not a native PDF object it can "Save As".
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      if (cancelled) return;
      const container = containerRef.current;
      container.innerHTML = "";

      const watermarkText = `${me.email || ""}  ${new Date().toLocaleString("id-ID")}`;

      if (!cancelled) setNumPages(pdf.numPages);
      pageCanvasesRef.current = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // Base scale controls the on-screen size; outputScale multiplies
        // the actual pixel density on top of that so pages stay sharp when
        // zoomed in, instead of blurring past their rendered resolution.
        const baseScale = 1.8;
        const outputScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: baseScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = "auto"; // keeps aspect ratio correct when maxWidth shrinks the display width
        canvas.style.display = "block";
        canvas.style.marginBottom = "20px";

        canvas.style.userSelect = "none";
        canvas.style.borderRadius = "8px";
        canvas.style.boxShadow = "0 1px 3px rgba(15,23,42,0.1), 0 4px 12px rgba(15,23,42,0.08)";
        canvas.style.border = "1px solid #e2e8f0";

        const ctx = canvas.getContext("2d");
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        await page.render({ canvasContext: ctx, viewport, transform }).promise;

        // Watermark overlay: identifies the viewer if the page is ever
        // photographed or screenshotted. This is a deterrent, not a
        // technical block — screenshots can never be fully prevented.
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#000000";
        ctx.font = `${20 * outputScale}px sans-serif`;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6);
        for (let y = -canvas.height; y < canvas.height; y += 120 * outputScale) {
          ctx.fillText(watermarkText, -canvas.width / 2, y);
        }
        ctx.restore();

        canvas.dataset.pageNumber = String(pageNum);
        // Kelas ini membawa bingkai, bayangan, dan scroll-margin agar halaman
        // tidak tertutup bilah yang menempel di atas saat digulir ke sana.
        canvas.className = "reader__page";
        pageCanvasesRef.current.push(canvas);

        container.appendChild(canvas);
      }

      if (!cancelled) setStatus("ready");
    }

    loadAndRender().catch((err) => {
      console.error(err);
      if (!cancelled) {
        setStatus("error");
        setErrorMsg(`Terjadi kesalahan saat memuat dokumen: ${err.message || err}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Melompat ke halaman tertentu. Semua halaman sudah dirender bertumpuk,
  // jadi "pindah halaman" berarti menggulir ke kanvas yang bersangkutan.
  function gotoPage(n) {
    const target = Math.min(Math.max(1, Math.round(Number(n))), numPages || 1);
    const canvas = pageCanvasesRef.current[target - 1];
    if (!canvas) return;
    canvas.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(target);
  }

  function submitPageInput(e) {
    e.preventDefault();
    const n = Number(pageInput);
    if (!pageInput.trim() || Number.isNaN(n)) return;
    gotoPage(n);
    setPageInput("");
  }

  // Menyalin tautan yang langsung membuka di halaman ini — dipakai saat
  // mengarahkan penerima dokumen ke halaman tertentu.
  async function copyPageLink() {
    const url = `${window.location.origin}${window.location.pathname}?hal=${currentPage}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin tautan ini:", url);
    }
  }

  // Setelah semua halaman selesai dirender, langsung lompat ke ?hal=N bila ada.
  useEffect(() => {
    if (status !== "ready" || !numPages) return;
    const target = Number(router.query.hal);
    if (target >= 1 && target <= numPages) {
      // Sedikit jeda supaya tata letak sudah final sebelum digulir.
      const t = setTimeout(() => gotoPage(target), 150);
      return () => clearTimeout(t);
    }
  }, [status, numPages, router.query.hal]);

  // Melacak halaman yang sedang dilihat, supaya kotak nomor halaman ikut
  // bergerak saat pengguna menggulir secara manual.
  useEffect(() => {
    if (status !== "ready") return;
    function onScroll() {
      const canvases = pageCanvasesRef.current;
      if (canvases.length === 0) return;
      const acuan = window.innerHeight * 0.35;
      let terlihat = 1;
      for (let i = 0; i < canvases.length; i++) {
        if (canvases[i].getBoundingClientRect().top <= acuan) terlihat = i + 1;
        else break;
      }
      setCurrentPage(terlihat);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [status, numPages]);

  useEffect(() => {
    // Deterrents only — none of these can fully stop a determined user,
    // but they block casual copy/print/save and make intent obvious.
    function blockContextMenu(e) {
      e.preventDefault();
    }
    function blockKeys(e) {
      const key = e.key.toLowerCase();
      const blockedCombo =
        (e.ctrlKey || e.metaKey) && ["p", "s", "c", "u"].includes(key);
      if (blockedCombo || key === "printscreen") {
        e.preventDefault();
      }
    }
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Baca Dokumen — SIDOK</title>
      </Head>
      <div className="reader">
      {/* Bilah menempel di atas layar: tombol kembali dan navigasi halaman
          selalu terjangkau tanpa menggulir ke puncak dokumen. */}
      <div className="reader__bar">
        <div className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
          <Link href="/viewer" className="btn btn--back" title="Kembali ke daftar dokumen">
            ← Dokumen saya
          </Link>

          <div className="grow truncate">
            <p className="truncate" title={namaDokumen || ""} style={{ fontSize: 13, fontWeight: 700 }}>
              {namaDokumen || "Dokumen"}
            </p>
            {status === "ready" && numPages > 0 && (
              <p className="hint">
                Halaman {currentPage} dari {numPages}
              </p>
            )}
          </div>

          {canDownload && documentId && (
            <DownloadButton
              documentId={documentId}
              namaDokumen={namaDokumen}
              label="Unduh berkas asli"
              className="btn btn--primary btn--sm"
            />
          )}
        </div>

        {status === "ready" && numPages > 0 && (
          <div className="reader__nav">
            <button
              className="btn btn--sm btn--icon"
              onClick={() => gotoPage(currentPage - 1)}
              disabled={currentPage <= 1}
              title="Halaman sebelumnya"
            >
              ↑
            </button>
            <button
              className="btn btn--sm btn--icon"
              onClick={() => gotoPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              title="Halaman berikutnya"
            >
              ↓
            </button>
            <button
              className="btn btn--sm btn--icon"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              title="Kembali ke halaman pertama"
            >
              ⤒
            </button>

            <form onSubmit={submitPageInput} className="row" style={{ gap: 6, marginLeft: "auto", flexWrap: "nowrap" }}>
              <input
                className="input"
                style={{ width: 96, padding: "6px 10px", fontSize: 12 }}
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                placeholder="Ke halaman"
                aria-label="Nomor halaman yang dituju"
              />
              <button type="submit" className="btn btn--primary btn--sm">
                Buka
              </button>
              <button
                type="button"
                className={`btn btn--sm${copied ? " btn--ok" : ""}`}
                onClick={copyPageLink}
                title="Salin tautan yang langsung membuka halaman ini"
              >
                {copied ? "Tersalin" : "Salin tautan"}
              </button>
            </form>
          </div>
        )}
      </div>

      {status === "loading" && (
        <p className="muted">
          <span className="spinner" style={{ marginRight: 8 }} />
          Memuat dokumen...
        </p>
      )}
      {status === "error" && <p className="error-text">{errorMsg}</p>}

      <div ref={containerRef} />
    </div>
    </>
  );
}
