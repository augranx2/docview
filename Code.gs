/**
 * @OnlyCurrentDoc
 */
/**
 * Code.gs — Office Document Viewer backend
 *
 * Pola hashing & auth IDENTIK dengan EM Viable / EM Non Viable: SHA-256(password
 * + salt) via Utilities.computeDigest(), kolom PasswordBaru sebagai jalan
 * pintas isi password manual oleh admin (otomatis di-hash & dikosongkan saat
 * dipakai login berikutnya).
 *
 * Beda dengan EM Viable: sesi TIDAK disimpan di tab Sheet, karena project ini
 * pakai Redis (Vercel KV/Upstash) di sisi Node untuk session + view-token
 * sementara (auto-expire). Jadi action "login" di sini HANYA memverifikasi
 * kredensial dan mengembalikan data user (nama/role/status) — hash & salt
 * TIDAK PERNAH dikirim keluar dari Apps Script ini.
 *
 * Deploy: Extensions > Apps Script > tempel file ini > ganti WEBAPP_SECRET >
 * Deploy > New deployment > Web app > Execute as "Me" > Who has access
 * "Anyone" > Deploy. Salin URL /exec ke APPS_SCRIPT_WEB_APP_URL di .env.local.
 *
 * TAB YANG DIBUTUHKAN:
 *   Users            : Nama | Role | Username | Status | PasswordBaru | PasswordHash | Salt
 *                       (Role: Admin / Viewer — Status: Aktif / Nonaktif)
 *   Documents        : documentId | namaDokumen | kategori | driveFileId |
 *                       uploadedBy | uploadedAt | status
 *   Document_Access  : documentId | userEmail | grantedBy | grantedAt
 *                       (kolom "userEmail" diisi Username, bukan email asli,
 *                       supaya konsisten dengan login berbasis Username)
 *   Audit_Log        : timestamp | userEmail | documentId | action | detail
 */

const WEBAPP_SECRET = "rms-2026-x7Kp9qL3vN8wZmT2";

const USERS_SHEET = "Users";

// Tab yang boleh diakses lewat action CRUD generik (getRows/appendRow/updateRowByKey).
// Users SENGAJA tidak dimasukkan di sini — hash/salt tidak boleh keluar lewat
// jalur generik, hanya lewat action "login" yang sudah dikontrol ketat.
const GENERIC_SCHEMAS = {
  Documents: [
    "documentId", "namaDokumen", "kategori", "driveFileId",
    "uploadedBy", "uploadedAt", "status",
  ],
  Document_Access: ["documentId", "userEmail", "grantedBy", "grantedAt"],
  Audit_Log: ["timestamp", "userEmail", "documentId", "action", "detail"],
};

// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== WEBAPP_SECRET) return jsonOut_({ error: "Unauthorized" });

    switch (body.action) {
      case "login":
        return jsonOut_(login_(body.username, body.password));

      case "getRows":
        assertGenericTab_(body.tab);
        return jsonOut_({ rows: getAllRows_(body.tab) });

      case "appendRow":
        assertGenericTab_(body.tab);
        return jsonOut_(appendRow_(body.tab, body.data));

      case "updateRowByKey":
        assertGenericTab_(body.tab);
        return jsonOut_(updateRowByKey_(body.tab, body.keyCol, body.keyValue, body.patch));

      case "deleteRows":
        assertGenericTab_(body.tab);
        return jsonOut_(deleteRows_(body.tab, body.match));

      case "getUsersSafe":
        return jsonOut_({ users: getUsersSafe_() });

      default:
        return jsonOut_({ error: "Unknown action: " + body.action });
    }
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doGet(e) {
  return jsonOut_({ status: "ok" });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function assertGenericTab_(tab) {
  if (!GENERIC_SCHEMAS[tab]) throw new Error("Unknown or restricted tab: " + tab);
}

// ---------------------------------------------------------------------------
// AUTH — identik pola EM Viable: SHA-256(password + salt), PasswordBaru
// sebagai kolom isi-manual yang auto-hash saat dipakai.
// ---------------------------------------------------------------------------
function randomHex_(numBytes) {
  const chars = [];
  for (let i = 0; i < numBytes; i++) {
    chars.push(("0" + Math.floor(Math.random() * 256).toString(16)).slice(-2));
  }
  return chars.join("");
}
function generateSalt_() { return randomHex_(16); }
function hashPassword_(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password) + "::" + String(salt)
  );
  return digest.map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function getUsersSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sheet) throw new Error("Tab '" + USERS_SHEET + "' tidak ditemukan.");
  return sheet;
}

// Kolom Users: A Nama | B Role | C Username | D Status | E PasswordBaru | F PasswordHash | G Salt
function migratePasswords_() {
  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    const passwordBaru = values[i][4];
    if (passwordBaru !== "" && passwordBaru !== null && passwordBaru !== undefined) {
      const salt = generateSalt_();
      values[i][5] = hashPassword_(String(passwordBaru), salt);
      values[i][6] = salt;
      values[i][4] = "";
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

function findUserByUsername_(username) {
  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const target = String(username || "").trim().toLowerCase();
  if (!target) return null;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const uname = String(row[2] || "").trim().toLowerCase();
    if (uname && uname === target) {
      return {
        nama: row[0],
        role: String(row[1] || "").trim(),
        username: row[2],
        status: String(row[3] || "").trim(),
        passwordHash: row[5],
        salt: row[6],
      };
    }
  }
  return null;
}

function writeAuditLog_(userEmail, action, detail) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Audit_Log");
  if (!sheet) return;
  sheet.appendRow([new Date().toISOString(), userEmail || "", "", action, detail || ""]);
}

/**
 * Verifies credentials against the Users tab. Returns user info on success
 * (never the hash/salt) or { error } on failure. Node uses this result to
 * create the actual session in Redis — Apps Script itself stays stateless
 * for sessions.
 */
function login_(username, password) {
  if (!username || !password) return { error: "Username dan password wajib diisi." };
  migratePasswords_();

  const user = findUserByUsername_(username);
  if (!user || !user.passwordHash) {
    writeAuditLog_(username, "LOGIN_FAILED", "User tidak ditemukan");
    return { error: "Username atau password salah." };
  }
  if (user.status !== "Aktif") {
    writeAuditLog_(username, "LOGIN_FAILED", "Akun nonaktif");
    return { error: "Akun ini nonaktif. Hubungi Administrator." };
  }
  if (hashPassword_(password, user.salt) !== user.passwordHash) {
    writeAuditLog_(username, "LOGIN_FAILED", "Password salah");
    return { error: "Username atau password salah." };
  }
  if (user.role !== "Admin" && user.role !== "Viewer") {
    writeAuditLog_(username, "LOGIN_FAILED", "Role tidak valid");
    return { error: "Role akun ini belum diatur dengan benar. Hubungi Administrator." };
  }

  writeAuditLog_(user.username, "LOGIN", "");
  return { ok: true, nama: user.nama, role: user.role, username: user.username };
}

// ---------------------------------------------------------------------------
// CRUD GENERIK — Documents, Document_Access, Audit_Log
// ---------------------------------------------------------------------------
function getSheet_(tab) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (!sheet) throw new Error("Sheet tab not found: " + tab);
  return sheet;
}

function rowToObject_(tab, row) {
  const cols = GENERIC_SCHEMAS[tab];
  const obj = {};
  cols.forEach((col, i) => (obj[col] = row[i] !== undefined ? row[i] : ""));
  return obj;
}

function objectToRow_(tab, obj) {
  const cols = GENERIC_SCHEMAS[tab];
  return cols.map((col) => (obj[col] !== undefined ? obj[col] : ""));
}

function getAllRows_(tab) {
  const sheet = getSheet_(tab);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const cols = GENERIC_SCHEMAS[tab];
  const values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return values.map((row) => rowToObject_(tab, row));
}

function appendRow_(tab, obj) {
  const sheet = getSheet_(tab);
  sheet.appendRow(objectToRow_(tab, obj));
  return { success: true };
}

function updateRowByKey_(tab, keyCol, keyValue, patch) {
  const sheet = getSheet_(tab);
  const cols = GENERIC_SCHEMAS[tab];
  const keyIndex = cols.indexOf(keyCol);
  if (keyIndex === -1) throw new Error("Unknown key column: " + keyCol);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(keyValue + " not found in " + tab);

  const values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  const rowIndex = values.findIndex((r) => String(r[keyIndex]) === String(keyValue));
  if (rowIndex === -1) throw new Error(keyValue + " not found in " + tab);

  const merged = Object.assign(rowToObject_(tab, values[rowIndex]), patch);
  const sheetRowNumber = rowIndex + 2;
  sheet.getRange(sheetRowNumber, 1, 1, cols.length).setValues([objectToRow_(tab, merged)]);
  return { success: true };
}

/**
 * Deletes every row where ALL columns in `match` equal the given values
 * (e.g. { documentId: "...", userEmail: "..." } to revoke one user's access
 * to one document, or { documentId: "..." } to delete a document row).
 * Deletes bottom-to-top so row indices don't shift mid-loop.
 */
function deleteRows_(tab, match) {
  const sheet = getSheet_(tab);
  const cols = GENERIC_SCHEMAS[tab];
  const matchKeys = Object.keys(match || {});
  if (matchKeys.length === 0) throw new Error("deleteRows requires at least one match field");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, deleted: 0 };

  const values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  let deleted = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const obj = rowToObject_(tab, values[i]);
    const isMatch = matchKeys.every((k) => String(obj[k]) === String(match[k]));
    if (isMatch) {
      sheet.deleteRow(i + 2); // +1 header, +1 for 1-index
      deleted++;
    }
  }
  return { success: true, deleted };
}

/**
 * User list WITHOUT passwordHash/salt — safe to expose to Node for building
 * an "add access" dropdown on the admin dashboard.
 */
function getUsersSafe_() {
  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return values
    .filter((row) => String(row[2] || "").trim() !== "")
    .map((row) => ({
      nama: row[0],
      role: String(row[1] || "").trim(),
      username: row[2],
      status: String(row[3] || "").trim(),
    }));
}
