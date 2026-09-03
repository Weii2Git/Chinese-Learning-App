import { NextRequest, NextResponse } from "next/server";

// Admin password. Prefer the ADMIN_PASSWORD env var (set in Vercel), but fall
// back to a default so the gate works out of the box.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "3Weinerboys";

// POST: verify the admin password and set the admin_session cookie.
export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (typeof password !== "string" || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/",
  });
  return res;
}

// DELETE: clear the admin_session cookie (logout).
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
