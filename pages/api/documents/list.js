import { requireSession } from "../../../lib/auth";
import { findRows, getAllRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  // Admins see everything they've uploaded; regular users only see what
  // was explicitly granted to them via Document_Access.
  if (session.role === "Admin") {
    const docs = await findRows("Documents", (d) => d.status === "active");
    return res.status(200).json({ documents: docs });
  }

  const access = await findRows("Document_Access", (a) => a.userEmail === session.email);
  const allowedIds = new Set(access.map((a) => a.documentId));
  const allDocs = await getAllRows("Documents");
  const docs = allDocs.filter((d) => d.status === "active" && allowedIds.has(d.documentId));

  return res.status(200).json({ documents: docs });
}

export default withErrorHandling(handler);
