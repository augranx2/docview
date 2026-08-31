import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ViewerPage() {
  const router = useRouter();
  const { documentId } = router.query;
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");

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
      const me = meRes.ok ? await meRes.json() : { email: "" };

      // 1. Ask the backend for permission + a short-lived view token.
      const tokenRes = await fetch("/api/documents/request-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const tokenData = await tokenRes.json();
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

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.4 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";
        canvas.style.marginBottom = "16px";
        canvas.style.maxWidth = "100%";
        canvas.style.userSelect = "none";

        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Watermark overlay: identifies the viewer if the page is ever
        // photographed or screenshotted. This is a deterrent, not a
        // technical block — screenshots can never be fully prevented.
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#000000";
        ctx.font = "20px sans-serif";
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6);
        for (let y = -canvas.height; y < canvas.height; y += 120) {
          ctx.fillText(watermarkText, -canvas.width / 2, y);
        }
        ctx.restore();

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
    <div style={{ maxWidth: 900, margin: "24px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/viewer" style={{ textDecoration: "none", fontSize: 14 }}>
          ← Kembali ke Dokumen Saya
        </Link>
      </div>
      {status === "loading" && <p>Memuat dokumen...</p>}
      {status === "error" && <p style={{ color: "red" }}>{errorMsg}</p>}
      <div ref={containerRef} />
    </div>
  );
}
