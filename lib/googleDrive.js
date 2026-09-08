import { google } from "googleapis";

/**
 * Returns an authenticated Drive client using the OAuth refresh token
 * you already generated in your other project. Only GDRIVE_ROOT_FOLDER_ID
 * needs to change for this project.
 */
export function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.DRIVE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getOAuthClient() });
}

export const UNCATEGORIZED_FOLDER = "_Tanpa Kategori";

/**
 * Strips characters that Drive dislikes and that break downloads on Windows.
 * Applied to both document names and category folder names.
 */
export function sanitizeDriveName(name) {
  return String(name || "")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds the Drive filename for a document: the human-readable name plus a
 * short slice of its UUID. Drive allows duplicate filenames within a folder,
 * so without the suffix two documents that happen to share a name would be
 * indistinguishable when browsing Drive directly.
 */
export function buildDriveFileName(namaDokumen, documentId) {
  const base = sanitizeDriveName(namaDokumen).replace(/\.pdf$/i, "").slice(0, 180) || "Dokumen";
  const suffix = String(documentId).replace(/-/g, "").slice(0, 6);
  return `${base} - ${suffix}.pdf`;
}

/**
 * Finds the category subfolder inside the root folder, creating it if needed.
 * Category names come from the app, so the folder tree mirrors the sidebar.
 *
 * Note on a race: two uploads started at the same moment with the same NEW
 * category can both find nothing and both create a folder, leaving twins.
 * We reduce the window by re-querying right after creating and keeping the
 * oldest match, which is what a later lookup would settle on anyway.
 */
export async function findOrCreateCategoryFolder(kategori) {
  const drive = getDriveClient();
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  const name = sanitizeDriveName(kategori) || UNCATEGORIZED_FOLDER;
  const escaped = name.replace(/'/g, "\\'");

  const query = [
    `name = '${escaped}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${root}' in parents`,
    "trashed = false",
  ].join(" and ");

  const existing = await drive.files.list({
    q: query,
    fields: "files(id,name,createdTime)",
    orderBy: "createdTime",
    pageSize: 10,
  });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [root],
    },
    fields: "id",
  });

  const recheck = await drive.files.list({
    q: query,
    fields: "files(id,createdTime)",
    orderBy: "createdTime",
    pageSize: 10,
  });
  const oldest = recheck.data.files && recheck.data.files[0];
  return oldest ? oldest.id : created.data.id;
}

/**
 * Renames a file and/or moves it into a different folder. Used when an admin
 * changes a document's category, so the Drive tree keeps matching the app.
 */
export async function renameAndMoveFile(fileId, { name, targetFolderId } = {}) {
  const drive = getDriveClient();
  const params = { fileId, fields: "id, name, parents" };

  if (name) params.requestBody = { name };

  if (targetFolderId) {
    const current = await drive.files.get({ fileId, fields: "parents" });
    const previousParents = (current.data.parents || []).join(",");
    params.addParents = targetFolderId;
    if (previousParents) params.removeParents = previousParents;
  }

  await drive.files.update(params);
}

/**
 * Opens a Google Drive resumable upload session for a file.
 * The browser will PUT the file bytes directly to the returned URL,
 * bypassing the Vercel serverless function body-size limit.
 */
export async function createResumableUploadSession({ fileName, mimeType, fileSize, origin, parentFolderId }) {
  const oauth2Client = getOAuthClient();
  const { token: accessToken } = await oauth2Client.getAccessToken();

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Upload-Content-Type": mimeType,
    "X-Upload-Content-Length": String(fileSize),
  };
  // Required for the browser to be able to PUT the file bytes directly to
  // the resulting session URL (cross-origin resumable upload) — without
  // this, Google never allowlists our site's origin and the browser's PUT
  // gets blocked by CORS.
  if (origin) headers["Origin"] = origin;

  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: fileName,
        parents: [parentFolderId || process.env.GDRIVE_ROOT_FOLDER_ID],
      }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to create resumable session: ${errText}`);
  }

  const resumableSessionUrl = initRes.headers.get("location");
  return resumableSessionUrl;
}

/**
 * Ensures a file is NOT publicly accessible. Removes any "anyone" permission.
 * Access is controlled entirely by the app (Document_Access table), never by
 * Drive sharing links.
 */
export async function ensureFileIsPrivate(fileId) {
  const drive = getDriveClient();
  const perms = await drive.permissions.list({ fileId, fields: "permissions(id,type)" });
  const anyonePerms = (perms.data.permissions || []).filter((p) => p.type === "anyone");
  for (const p of anyonePerms) {
    await drive.permissions.delete({ fileId, permissionId: p.id });
  }
}

/**
 * Permanently deletes a file from Drive. Used when an admin deletes a
 * document from the app after all shares to it have been ended.
 */
export async function deleteFile(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/**
 * Downloads the raw PDF bytes for a file. Used server-side only, by the
 * page-rendering endpoint — the raw file is never sent directly to the browser.
 */
export async function downloadFileBuffer(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}
