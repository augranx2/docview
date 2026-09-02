# Office Document Viewer

Web app internal untuk upload PDF resmi kantor ke Google Drive, dan membagikannya
ke user tertentu yang harus login dan hanya bisa **melihat** (bukan download/print) —
lihat catatan penting di bagian "Batasan" di bawah.

## Setup

1. `npm install`
2. Buat spreadsheet dengan 4 tab dan header sesuai skema di bawah.
3. Buka spreadsheet itu → Extensions > Apps Script → hapus isi default →
   tempel isi `Code.gs` dari folder ini → ganti `WEBAPP_SECRET` dengan string
   acak yang panjang → Deploy > New deployment > tipe "Web app" >
   Execute as "Me" > Who has access "Anyone" > Deploy → salin URL `/exec`
   yang dihasilkan.
4. Salin `.env.local.example` menjadi `.env.local`, isi semua variabel:
   - `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `DRIVE_REFRESH_TOKEN` — reuse dari project lain
   - `GDRIVE_ROOT_FOLDER_ID` — **ganti ke folder baru** khusus project ini (folder harus
     bisa diakses oleh akun Google pemilik refresh token)
   - `APPS_SCRIPT_WEB_APP_URL` — URL `/exec` dari langkah 3
   - `APPS_SCRIPT_SECRET` — harus sama persis dengan `WEBAPP_SECRET` di `Code.gs`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — dari dashboard Upstash
5. `npm run dev` untuk coba lokal, lalu deploy ke Vercel dan set env vars yang sama
   di Vercel dashboard.

## Skema Google Sheets

Pola hash password IDENTIK dengan EM Viable/EM Non Viable: SHA-256(password + salt)
lewat `Utilities.computeDigest()` di Apps Script — bukan bcrypt. Hash & salt
tidak pernah keluar dari Apps Script; Node hanya kirim username+password mentah
lewat HTTPS ke action `login`, dan Apps Script yang membalas cocok/tidak.

**Users**
`Nama | Role | Username | Status | PasswordBaru | PasswordHash | Salt`
- `Role`: `Admin` atau `Viewer`
- `Status`: `Aktif` atau `Nonaktif`
- Cara tambah user baru: isi `Nama`, `Role`, `Username`, `Status` = `Aktif`,
  lalu ketik password polos di `PasswordBaru`. Begitu ada yang login (siapa saja),
  Apps Script otomatis hash password itu ke `PasswordHash` + `Salt` dan
  mengosongkan `PasswordBaru` — tidak perlu jalankan script apa pun secara manual.
- Kolom `PasswordHash` dan `Salt` JANGAN diisi/diedit manual.

**Documents**
`documentId | namaDokumen | kategori | driveFileId | uploadedBy | uploadedAt | status`
- `status`: `pending` (baru dibuat, belum selesai upload) atau `active`

**Document_Access**
`documentId | userEmail | grantedBy | grantedAt`
- Satu baris = satu izin akses user ke satu dokumen
- Kolom `userEmail` diisi **Username** (bukan alamat email asli), supaya konsisten
  dengan login berbasis Username

**Audit_Log**
`timestamp | userEmail | documentId | action | detail`
- `action`: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `UPLOAD`, `VIEW`, `DOWNLOAD`, `ACCESS_DENIED`, `ACCESS_GRANTED`, `ACCESS_REVOKED`, `DOCUMENT_DELETED`, `DOCUMENT_UPDATED`, `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`
- Baris `LOGIN`/`LOGIN_FAILED` ditulis langsung oleh Apps Script (di dalam action `login`)

## Alur

**Dashboard Admin (`/admin/dashboard`)** — halaman awal setelah login sebagai Admin:
- Lihat semua dokumen yang sudah diupload beserta daftar user yang punya akses ke masing-masing
- Tambah akses: pilih user dari dropdown → "Tambah Akses"
- Akhiri akses: klik "×" di sebelah nama user pada dokumen tsb
- Hapus dokumen: hanya bisa kalau dokumen itu sudah tidak dibagikan ke siapa pun (0 akses) — hapus file dari Drive + baris di sheet `Documents` sekaligus
- Semua aksi ini tercatat di `Audit_Log` (`ACCESS_GRANTED`, `ACCESS_REVOKED`, `DOCUMENT_DELETED`)

1. Admin login → `/admin/upload` → pilih file + user yang diberi akses
2. Upload file dikirim **langsung ke Google Drive** dari browser (resumable session),
   tidak lewat body Vercel — supaya tidak kena limit ukuran
3. Setelah selesai, file di-set private, akses dicatat ke `Document_Access`
4. User Viewer login → `/viewer` → lihat daftar dokumen yang dibagikan ke dia
5. Buka dokumen → backend cek akses → keluarkan token sementara (10 menit) →
   frontend render tiap halaman PDF ke `<canvas>` pakai pdf.js + watermark
   username/timestamp

## Watermark file download

Saat Admin/Downloader men-download file asli (bukan lewat viewer canvas), cap
`public/watermark-controlled.png` otomatis ditempel ke setiap halaman PDF
(semi-transparan, di tengah halaman) sebelum dikirim ke browser — file asli
di Google Drive **tidak diubah**, watermark cuma ditempel pada salinan yang
dikirim saat itu. Ini terpisah dari watermark teks dinamis (nama+waktu) yang
muncul di viewer canvas.

## Batasan penting (baca sebelum deploy)

**Tidak ada cara mencegah screenshot/foto layar 100%** — begitu konten dirender di
layar, secara teknis selalu bisa difoto (screenshot OS, kamera HP dari layar).
Yang diterapkan di sini adalah:
- Render ke canvas (bukan file PDF native) → mencegah "Save As" & drag-file biasa
- Watermark username + timestamp di setiap halaman → kalau tetap difoto, sumbernya
  tetap terlacak
- Blokir klik-kanan, Ctrl+P/S/C, PrintScreen → deterrent untuk pengguna awam,
  bukan proteksi teknis kuat (bisa dilewati dengan devtools browser)
- Token akses sementara (10 menit) → link tidak bisa dipakai ulang setelah expired
- Audit log tiap VIEW → tahu siapa buka dokumen apa dan kapan

Kalau butuh proteksi lebih kuat dari ini, opsinya biasanya keluar dari ranah web app
biasa (misal DRM khusus dokumen, aplikasi desktop terkontrol, dsb) — bisa didiskusikan
lebih lanjut kalau levelnya perlu setinggi itu.
