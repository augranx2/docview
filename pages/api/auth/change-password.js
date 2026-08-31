import { requireSession } from "../../../lib/auth";
import { getAllRows, updateRowByKey } from "../../../lib/sheets";

// Catatan: Mengikuti pola hashing SHA-256 yang sudah ada di Code.gs
import crypto from "crypto";

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(String(password) + "::" + String(salt)).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Password lama dan baru wajib diisi" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password baru minimal 6 karakter" });
  }

  try {
    const users = await getAllRows("Users");
    const userRow = users.find((u) => String(u.username || "").toLowerCase() === String(session.email).toLowerCase());
    
    if (!userRow) {
      return res.status(404).json({ error: "User tidak ditemukan" });
    }

    const testHash = hashPassword(oldPassword, userRow.Salt);
    if (testHash !== userRow.PasswordHash) {
      return res.status(400).json({ error: "Password lama salah" });
    }

    // Generate salt baru dan hash password baru
    const newSalt = crypto.randomBytes(8).toString("hex");
    const newHash = hashPassword(newPassword, newSalt);

    await updateRowByKey("Users", "Username", userRow.Username, {
      PasswordHash: newHash,
      Salt: newSalt,
      PasswordBaru: "",
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Gagal memperbarui password" });
  }
}