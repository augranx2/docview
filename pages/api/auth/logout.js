import { getCurrentSession, clearSessionCookie } from "../../../lib/auth";
import { destroySession } from "../../../lib/redis";
import { logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getCurrentSession(req);
  if (session) {
    await destroySession(session.token);
    await logAudit({ userEmail: session.email, action: "LOGOUT" });
  }
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
