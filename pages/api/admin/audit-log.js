import { requireSession } from "../../../lib/auth";
import { getAllRows, logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

const AUDIT_COLUMNS = ["timestamp", "userEmail", "documentId", "action", "detail"];

/**
 * Escapes one CSV field. Audit details are free text typed by admins and can
 * contain commas, quotes, or newlines — any of which would otherwise shift
 * every column after it, silently corrupting the whole export.
 */
function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== "Admin") {
    return res.status(403).json({ error: "Forbidden - Admin only" });
  }

  try {
    const logs = await getAllRows("Audit_Log");
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // CSV export gets the COMPLETE log, not the 200 most recent rows the modal
    // shows — the point of downloading it is to have the full record for audit
    // or archiving purposes.
    if (req.query.format === "csv") {
      const rows = [
        AUDIT_COLUMNS.join(","),
        ...logs.map((log) => AUDIT_COLUMNS.map((col) => csvField(log[col])).join(",")),
      ];
      // Leading BOM so Excel reads the file as UTF-8 and doesn't mangle
      // accented characters in document names.
      const csv = "\uFEFF" + rows.join("\r\n");

      const stamp = new Date()
        .toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" })
        .replace(/[: ]/g, "-");
      const filename = `audit-log-${stamp}.csv`;

      await logAudit({
        userEmail: session.email,
        action: "AUDIT_LOG_EXPORTED",
        detail: `${logs.length} baris`,
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json({ logs: logs.slice(0, 200), total: logs.length });
  } catch (err) {
    return res.status(500).json({ error: "Gagal memuat audit log" });
  }
}

export default withErrorHandling(handler);
