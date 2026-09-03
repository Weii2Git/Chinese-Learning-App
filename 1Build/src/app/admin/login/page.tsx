"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">🔒 Admin Settings</h1>
          <p className="text-slate-400">Enter the admin password to continue</p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-400 mb-2">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors text-center text-lg tracking-widest"
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-base font-semibold text-white transition-colors"
            >
              {loading ? "Checking..." : "Unlock"}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
