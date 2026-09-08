import { requireAdmin } from "../../../lib/auth";
import { getAllRows } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Distinct category list, used to populate the upload and edit dropdowns.
 * A dropdown instead of free text is what keeps "Protap QA", "protap QA" and
 * "Protap QA " from becoming three separate categories in the sidebar — and
 * three separate folders in Drive.
 */
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const docs = await getAllRows("Documents");
  const seen = new Map();
  for (const doc of docs) {
    if (doc.status !== "active") continue;
    const name = String(doc.kategori || "").trim();
    if (!name) continue;
    // Deduplicate case-insensitively but keep the first spelling as canonical.
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }

  const categories = [...seen.values()].sort((a, b) => a.localeCompare(b, "id"));
  return res.status(200).json({ categories });
}

export default withErrorHandling(handler);
