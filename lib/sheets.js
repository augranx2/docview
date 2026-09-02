/**
 * Talks to the Code.gs Apps Script Web App (deployed on the spreadsheet)
 * instead of calling the Google Sheets API directly — same pattern used in
 * the EM Viable project. No service account setup needed; just deploy
 * Code.gs as a Web App and put its /exec URL + shared secret in .env.local.
 */

const WEB_APP_URL = process.env.APPS_SCRIPT_WEB_APP_URL;
const SECRET = process.env.APPS_SCRIPT_SECRET;

async function callAppsScriptRaw(payload) {
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SECRET, ...payload }),
  });
  return res.json();
}

async function callAppsScript(payload) {
  const data = await callAppsScriptRaw(payload);
  if (data.error) throw new Error(`Apps Script error: ${data.error}`);
  return data;
}

/**
 * Login failures (wrong password, inactive account, etc.) are expected,
 * everyday outcomes — not exceptions — so this returns { error } directly
 * instead of throwing, unlike the other Apps Script calls above.
 */
export async function loginViaAppsScript(username, password) {
  return callAppsScriptRaw({ action: "login", username, password });
}

/**
 * Old-password verification and the new hash/salt write both happen inside
 * Code.gs — this just relays the request and returns { ok } or { error }
 * without throwing, same pattern as loginViaAppsScript.
 */
export async function changePasswordViaAppsScript(username, oldPassword, newPassword) {
  return callAppsScriptRaw({ action: "changePassword", username, oldPassword, newPassword });
}

export async function getAllRows(tab) {
  const data = await callAppsScript({ action: "getRows", tab });
  return data.rows;
}

export async function appendRow(tab, obj) {
  await callAppsScript({ action: "appendRow", tab, data: obj });
}

/**
 * Appends multiple rows in one Apps Script call — used for granting a
 * document's access to many users at once ("share to all") instead of one
 * request per user.
 */
export async function appendRows(tab, rows) {
  if (rows.length === 0) return 0;
  const data = await callAppsScript({ action: "appendRows", tab, rows });
  return data.added;
}

/**
 * Finds a row by matching a key column's value and overwrites it in place.
 * Needed for updating a Document's status (pending -> active) after upload.
 */
export async function updateRowByKey(tab, keyCol, keyValue, patch) {
  await callAppsScript({ action: "updateRowByKey", tab, keyCol, keyValue, patch });
}

export async function findRows(tab, predicate) {
  const rows = await getAllRows(tab);
  return rows.filter(predicate);
}

/**
 * Deletes every row in `tab` where all fields in `match` equal the given
 * values. Returns the number of rows deleted.
 */
export async function deleteRows(tab, match) {
  const data = await callAppsScript({ action: "deleteRows", tab, match });
  return data.deleted;
}

/**
 * Deletes every row in `tab` matching ANY of the given match objects in one
 * call — used for bulk actions (delete many documents, revoke many users'
 * access to one document) instead of one request per row.
 */
export async function deleteRowsBatch(tab, matches) {
  if (matches.length === 0) return 0;
  const data = await callAppsScript({ action: "deleteRowsBatch", tab, matches });
  return data.deleted;
}

/**
 * User list without passwordHash/salt — safe to use for admin-facing
 * dropdowns (e.g. "grant access to user").
 */
export async function getUsersSafe() {
  const data = await callAppsScript({ action: "getUsersSafe" });
  return data.users;
}

export async function logAudit({ userEmail, documentId = "", action, detail = "" }) {
  await appendRow("Audit_Log", {
    timestamp: new Date().toISOString(),
    userEmail,
    documentId,
    action,
    detail,
  });
}
