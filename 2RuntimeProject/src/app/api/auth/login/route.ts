import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json();
  const correctPasscode = process.env.SITE_PASSCODE;

  if (!correctPasscode) {
    return NextResponse.json({ error: "Passcode not configured" }, { status: 500 });
  }

  if (passcode !== correctPasscode) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("site_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
