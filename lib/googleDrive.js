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

/**
 * Opens a Google Drive resumable upload session for a file.
 * The browser will PUT the file bytes directly to the returned URL,
 * bypassing the Vercel serverless function body-size limit.
 */
export async function createResumableUploadSession({ fileName, mimeType, fileSize, origin }) {
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
        parents: [process.env.GDRIVE_ROOT_FOLDER_ID],
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
