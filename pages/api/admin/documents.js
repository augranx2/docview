import { requireAdmin } from "../../../lib/auth";
import { getAllRows, findRows } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const [documents, access] = await Promise.all([
    getAllRows("Documents"),
    getAllRows("Document_Access"),
  ]);

  const activeDocuments = documents.filter((d) => d.status === "active");

  const result = activeDocuments.map((doc) => ({
    ...doc,
    sharedTo: access
      .filter((a) => a.documentId === doc.documentId)
      .map((a) => a.userEmail),
  }));

  return res.status(200).json({ documents: result });
}
