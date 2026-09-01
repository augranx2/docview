/**
 * Wraps an API route handler so any uncaught exception inside it returns a
 * proper JSON error response, instead of Vercel's generic HTML crash page.
 * Without this, one unexpected error anywhere (a flaky Apps Script call, a
 * Drive API hiccup, etc.) breaks every frontend fetch().json() call with
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" — because the
 * frontend gets an HTML page back where it expected JSON.
 */
export function withErrorHandling(handler) {
  return async function wrapped(req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Terjadi kesalahan pada server" });
      }
    }
  };
}
