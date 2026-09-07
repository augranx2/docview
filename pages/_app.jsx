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
      </Head>
      <Component {...pageProps} />
    </>
  );
}
