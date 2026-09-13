import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

const IDLE_MS = 30 * 60 * 1000; // 30 menit tanpa aktivitas
const PERIKSA_MS = 30 * 1000; // seberapa sering kondisi diperiksa

/**
 * Mengeluarkan pengguna setelah 30 menit tanpa aktivitas.
 *
 * Server sudah menegakkan batas yang sama, tetapi tanpa penanganan di sisi
 * peramban pengguna baru menyadarinya ketika menekan sesuatu dan mendapat
 * penolakan. Di sini sesi ditutup lebih dulu dan halaman dialihkan ke layar
 * masuk dengan keterangan sebabnya.
 *
 * Waktu aktivitas terakhir disimpan di localStorage agar terbagi antar tab:
 * bekerja di satu tab menjaga tab lain tetap hidup.
 */
export default function useIdleLogout() {
  const router = useRouter();
  const keluarRef = useRef(false);

  useEffect(() => {
    const KUNCI = "sidok:aktivitas-terakhir";

    function tandaiAktif() {
      try {
        localStorage.setItem(KUNCI, String(Date.now()));
      } catch {
        /* mode privat sebagian peramban melarang penulisan — abaikan */
      }
    }

    function terakhir() {
      try {
        return Number(localStorage.getItem(KUNCI) || Date.now());
      } catch {
        return Date.now();
      }
    }

    tandaiAktif();

    const peristiwa = ["mousedown", "keydown", "scroll", "touchstart", "visibilitychange"];
    peristiwa.forEach((e) => window.addEventListener(e, tandaiAktif, { passive: true }));

    const jam = setInterval(async () => {
      if (keluarRef.current) return;
      if (Date.now() - terakhir() < IDLE_MS) return;

      keluarRef.current = true;
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* sesi tetap hangus di server meski permintaan ini gagal */
      }
      router.push("/login?sebab=idle");
    }, PERIKSA_MS);

    return () => {
      peristiwa.forEach((e) => window.removeEventListener(e, tandaiAktif));
      clearInterval(jam);
    };
  }, [router]);
}
