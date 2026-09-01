import { requireAdmin } from "../../../lib/auth";
import { getUsersSafe } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const users = await getUsersSafe();
  const activeUsers = users.filter((u) => u.status === "Aktif");

  return res.status(200).json({ users: activeUsers });
}

export default withErrorHandling(handler);
