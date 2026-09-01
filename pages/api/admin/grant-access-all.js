import { requireAdmin } from "../../../lib/auth";
import { findRows, appendRows, getUsersSafe, logAudit } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  const [allUsers, existingAccess] = await Promise.all([
    getUsersSafe(),
    findRows("Document_Access", (a) => a.documentId === documentId),
  ]);

  const alreadyShared = new Set(existingAccess.map((a) => a.userEmail));
  const targets = allUsers.filter(
    (u) => u.status === "Aktif" && !alreadyShared.has(u.username)
  );

  if (targets.length === 0) {
    return res.status(200).json({ success: true, added: 0 });
  }

  const now = new Date().toISOString();
  const rows = targets.map((u) => ({
    documentId,
    userEmail: u.username,
    grantedBy: session.email,
    grantedAt: now,
  }));

  const added = await appendRows("Document_Access", rows);

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "ACCESS_GRANTED",
    detail: `to all (${added} user)`,
  });

  return res.status(200).json({ success: true, added });
}
