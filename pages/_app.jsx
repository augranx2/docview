import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Judul & favicon default; tiap halaman boleh menimpanya dengan
            <Head> sendiri. Sebelumnya tidak ada <title> sama sekali, sehingga
            tab browser hanya menampilkan URL mentah. */}
        <title>SIDOK — Sistem Dokumen Terkendali</title>
        <meta
          name="description"
          content="Sistem Dokumen Terkendali PT. Rama Emerald Multi Sukses"
        />
        <meta name="theme-color" content="#15427d" />
        <link rel="icon" href="/logo-rama.png" />
        {/* Satu keluarga huruf untuk seluruh aplikasi; bobot 400-800 mencakup
            teks isi hingga judul. preconnect memangkas waktu tunggu. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
