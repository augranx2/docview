import { getCurrentSession } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getCurrentSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  return res.status(200).json({
    email: session.email,
    nama: session.nama,
    role: session.role,
  });
}

export default withErrorHandling(handler);
