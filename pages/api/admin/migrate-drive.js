import { requireAdmin } from "../../../lib/auth";
import { getAllRows, logAudit } from "../../../lib/sheets";
import {
  getDriveClient,
  findOrCreateCategoryFolder,
  buildDriveFileName,
} from "../../../lib/googleDrive";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Renames and re-folders documents that were uploaded before the naming and
 * category-folder scheme existed (files named with a raw UUID, all piled in
 * the root folder).
 *
 * Runs in small batches driven by the browser rather than one long server
 * job: a Vercel function is killed after a few seconds, so a 394-file loop
 * would never finish. The client calls this repeatedly with the nextIndex it
 * gets back until `done` is true.
 *
 * Safe to re-run: files already carrying the right name in the right folder
 * are skipped, and only Drive metadata is touched — file contents and
 * driveFileId never change, so the app keeps working throughout.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const startIndex = Math.max(0, Number(req.body?.startIndex) || 0);
  const batchSize = Math.min(25, Math.max(1, Number(req.body?.batchSize) || 5));
  const dryRun = !!req.body?.dryRun;

  const allDocs = await getAllRows("Documents");
  const docs = allDocs.filter((d) => d.status === "active" && d.driveFileId);
  const total = docs.length;

  const drive = getDriveClient();
  const folderCache = new Map();
  const log = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const slice = docs.slice(startIndex, startIndex + batchSize);

  for (const doc of slice) {
    const targetName = buildDriveFileName(doc.namaDokumen, doc.documentId);
    const kategori = String(doc.kategori || "").trim();

    try {
      let folderId = folderCache.get(kategori);
      if (!folderId) {
        // Empty category resolves to the "_Tanpa Kategori" folder inside the
        // helper, so old rows without a category still land somewhere tidy.
        folderId = await findOrCreateCategoryFolder(kategori);
        folderCache.set(kategori, folderId);
      }

      const current = await drive.files.get({
        fileId: doc.driveFileId,
        fields: "id, name, parents",
      });
      const parents = current.data.parents || [];
      const nameOk = current.data.name === targetName;
      const folderOk = parents.length === 1 && parents[0] === folderId;

      if (nameOk && folderOk) {
        skipped++;
        continue;
      }

      if (dryRun) {
        log.push(`${kategori || "_Tanpa Kategori"}/${targetName}`);
        processed++;
        continue;
      }

      const params = { fileId: doc.driveFileId, fields: "id" };
      if (!nameOk) params.requestBody = { name: targetName };
      if (!folderOk) {
        params.addParents = folderId;
        const toRemove = parents.filter((p) => p !== folderId);
        if (toRemove.length > 0) params.removeParents = toRemove.join(",");
      }
      await drive.files.update(params);

      processed++;
    } catch (err) {
      failed++;
      log.push(`GAGAL: ${doc.namaDokumen} — ${err.message}`);
    }
  }

  const nextIndex = startIndex + slice.length;
  const done = nextIndex >= total;

  if (done && !dryRun && startIndex > 0) {
    await logAudit({
      userEmail: session.email,
      action: "DRIVE_MIGRATION",
      detail: `Selesai merapikan ${total} dokumen`,
    });
  }

  return res.status(200).json({
    total,
    nextIndex,
    done,
    processed,
    skipped,
    failed,
    log,
  });
}

export default withErrorHandling(handler);
