import { useRouter } from "next/router";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <button onClick={handleLogout} disabled={loading} className="btn btn-outline btn-sm">
      {loading ? <span className="spinner" /> : "Logout"}
    </button>
  );
}
