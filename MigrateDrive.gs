/**
 * ============================================================================
 * SKRIP MIGRASI SEKALI JALAN — SIDOK
 * ============================================================================
 *
 * Merapikan file-file yang SUDAH terlanjur ter-upload dengan nama UUID acak:
 *   1. Rename file di Drive mengikuti kolom `namaDokumen` di tab Documents,
 *      ditambah 6 karakter dari documentId sebagai pembeda.
 *   2. Memindahkan file ke subfolder sesuai kolom `kategori`. Folder dibuat
 *      otomatis kalau belum ada. Dokumen tanpa kategori masuk ke
 *      "_Tanpa Kategori".
 *
 * Isi file TIDAK disentuh dan driveFileId TIDAK berubah, jadi aplikasi tetap
 * berjalan normal selama maupun sesudah migrasi.
 *
 * ---------------------------------------------------------------------------
 * CARA PAKAI
 * ---------------------------------------------------------------------------
 *   1. BACKUP DULU: duplikat tab `Documents` di spreadsheet (klik kanan tab →
 *      Duplicate). Ini jaring pengaman kalau ada yang meleset.
 *   2. Isi ROOT_FOLDER_ID di bawah dengan ID folder induk SIDOK di Drive
 *      (nilainya sama dengan GDRIVE_ROOT_FOLDER_ID di Vercel).
 *   3. Jalankan fungsi `dryRunMigrasi` lebih dulu. Ini TIDAK mengubah apa pun,
 *      hanya mencetak 20 contoh hasil rename ke Execution log supaya Anda bisa
 *      memastikan formatnya sudah benar.
 *   4. Kalau sudah cocok, jalankan `migrasiDriveFiles`.
 *   5. Kalau berhenti karena batas waktu 6 menit, JALANKAN LAGI fungsi yang
 *      sama — progres tersimpan dan skrip melanjutkan dari file terakhir,
 *      bukan mengulang dari nol.
 *   6. Selesai (log menulis "MIGRASI SELESAI"), jalankan `resetProgresMigrasi`
 *      kalau suatu saat mau menjalankan ulang dari awal.
 *
 * CATATAN: skrip ini harus dijalankan dari akun Google yang sama dengan
 * pemilik folder Drive tersebut.
 * ============================================================================
 */

var ROOT_FOLDER_ID = "ISI_DENGAN_ID_FOLDER_INDUK";
var SHEET_DOCUMENTS = "Documents";
var UNCATEGORIZED = "_Tanpa Kategori";

// Berhenti sebelum batas keras 6 menit Apps Script, supaya progres sempat
// disimpan dengan rapi alih-alih dipotong di tengah jalan.
var BATAS_WAKTU_MS = 4.5 * 60 * 1000;

/** Membuang karakter yang bermasalah di Drive dan saat file dibuka di Windows. */
function bersihkanNama_(nama) {
  return String(nama || "")
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/** Menyusun nama file akhir: "<nama dokumen> - <6 karakter uuid>.pdf" */
function namaFileBaru_(namaDokumen, documentId) {
  var dasar = bersihkanNama_(namaDokumen).replace(/\.pdf$/i, "").slice(0, 180) || "Dokumen";
  var akhiran = String(documentId).replace(/-/g, "").slice(0, 6);
  return dasar + " - " + akhiran + ".pdf";
}

/**
 * Mencari subfolder kategori di dalam folder induk, membuatnya kalau belum
 * ada. Hasil pencarian di-cache dalam satu kali jalan supaya tidak memanggil
 * Drive berulang kali untuk kategori yang sama.
 */
function dapatkanFolderKategori_(rootFolder, kategori, cache) {
  var nama = bersihkanNama_(kategori) || UNCATEGORIZED;
  if (cache[nama]) return cache[nama];

  var iter = rootFolder.getFoldersByName(nama);
  var folder = iter.hasNext() ? iter.next() : rootFolder.createFolder(nama);
  cache[nama] = folder;
  return folder;
}

/** Membaca tab Documents sebagai array objek. */
function bacaDocuments_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DOCUMENTS);
  if (!sheet) throw new Error('Tab "' + SHEET_DOCUMENTS + '" tidak ditemukan');

  var nilai = sheet.getDataRange().getValues();
  var header = nilai[0];
  var hasil = [];
  for (var i = 1; i < nilai.length; i++) {
    var obj = {};
    for (var j = 0; j < header.length; j++) obj[header[j]] = nilai[i][j];
    hasil.push(obj);
  }
  return hasil;
}

/**
 * Pratinjau tanpa mengubah apa pun. Jalankan ini lebih dulu.
 */
function dryRunMigrasi() {
  var docs = bacaDocuments_();
  var aktif = docs.filter(function (d) {
    return d.status === "active" && d.driveFileId;
  });

  Logger.log("Total baris: %s | Aktif & punya driveFileId: %s", docs.length, aktif.length);
  Logger.log("--- 20 contoh hasil ---");

  var contoh = aktif.slice(0, 20);
  for (var i = 0; i < contoh.length; i++) {
    var d = contoh[i];
    var folder = bersihkanNama_(d.kategori) || UNCATEGORIZED;
    Logger.log("%s/%s", folder, namaFileBaru_(d.namaDokumen, d.documentId));
  }

  var tanpaKategori = aktif.filter(function (d) {
    return !String(d.kategori || "").trim();
  }).length;
  Logger.log("--- Dokumen tanpa kategori (akan masuk %s): %s", UNCATEGORIZED, tanpaKategori);
  Logger.log("Tidak ada yang diubah. Jalankan migrasiDriveFiles() untuk mengeksekusi.");
}

/**
 * Migrasi sesungguhnya. Aman dijalankan berulang kali: file yang namanya dan
 * foldernya sudah benar akan dilewati, jadi menjalankan ulang tidak merusak
 * hasil sebelumnya.
 */
function migrasiDriveFiles() {
  if (ROOT_FOLDER_ID === "ISI_DENGAN_ID_FOLDER_INDUK") {
    throw new Error("ROOT_FOLDER_ID belum diisi di baris atas skrip ini.");
  }

  var mulai = new Date().getTime();
  var props = PropertiesService.getScriptProperties();
  var mulaiDari = Number(props.getProperty("MIGRASI_INDEX") || 0);

  var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var docs = bacaDocuments_().filter(function (d) {
    return d.status === "active" && d.driveFileId;
  });

  var cacheFolder = {};
  var diproses = 0;
  var dilewati = 0;
  var gagal = 0;
  var i = mulaiDari;

  Logger.log("Mulai dari indeks %s dari %s dokumen.", mulaiDari, docs.length);

  for (; i < docs.length; i++) {
    if (new Date().getTime() - mulai > BATAS_WAKTU_MS) {
      props.setProperty("MIGRASI_INDEX", String(i));
      Logger.log(
        "BERHENTI SEMENTARA di indeks %s (batas waktu). Jalankan lagi fungsi ini untuk melanjutkan.",
        i
      );
      Logger.log("Diproses: %s | Dilewati: %s | Gagal: %s", diproses, dilewati, gagal);
      return;
    }

    var d = docs[i];
    try {
      var file = DriveApp.getFileById(d.driveFileId);
      var targetNama = namaFileBaru_(d.namaDokumen, d.documentId);
      var targetFolder = dapatkanFolderKategori_(rootFolder, d.kategori, cacheFolder);

      var perluRename = file.getName() !== targetNama;

      // Cek apakah file sudah berada di folder tujuan.
      var sudahDiFolder = false;
      var parents = file.getParents();
      var parentLama = [];
      while (parents.hasNext()) {
        var p = parents.next();
        parentLama.push(p);
        if (p.getId() === targetFolder.getId()) sudahDiFolder = true;
      }

      if (!perluRename && sudahDiFolder && parentLama.length === 1) {
        dilewati++;
        continue;
      }

      if (perluRename) file.setName(targetNama);

      if (!sudahDiFolder) targetFolder.addFile(file);
      for (var k = 0; k < parentLama.length; k++) {
        if (parentLama[k].getId() !== targetFolder.getId()) {
          parentLama[k].removeFile(file);
        }
      }

      diproses++;
    } catch (err) {
      gagal++;
      Logger.log("GAGAL pada %s (%s): %s", d.namaDokumen, d.driveFileId, err.message);
    }
  }

  props.deleteProperty("MIGRASI_INDEX");
  Logger.log("MIGRASI SELESAI.");
  Logger.log("Diproses: %s | Dilewati (sudah benar): %s | Gagal: %s", diproses, dilewati, gagal);
}

/** Menghapus penanda progres, supaya migrasi bisa dijalankan ulang dari awal. */
function resetProgresMigrasi() {
  PropertiesService.getScriptProperties().deleteProperty("MIGRASI_INDEX");
  Logger.log("Progres direset. migrasiDriveFiles() akan mulai dari awal.");
}
