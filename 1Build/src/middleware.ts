import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Admin login page + the auth endpoint must stay reachable without an admin session.
const ADMIN_PUBLIC_PATHS = ["/admin/login", "/api/admin/auth"];

function isLocalhost(req: NextRequest): boolean {
  const host = req.headers.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets and framework internals straight through.
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico";

  // ── Admin protection (applies everywhere, including localhost) ──
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isAdminPublic = ADMIN_PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isAdminArea && !isAdminPublic && !isStatic) {
    const adminSession = req.cookies.get("admin_session")?.value;
    if (adminSession !== "authenticated") {
      // API calls get a 401; page navigations get redirected to the admin login.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      return NextResponse.redirect(loginUrl);
    }
    // A valid admin session is sufficient for admin routes — don't also require
    // the site passcode (otherwise admins get bounced to /login).
    return NextResponse.next();
  }

  // ── Site passcode protection ──
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    isAdminPublic ||
    isStatic
  ) {
    return NextResponse.next();
  }

  // Skip the site passcode on localhost (dev environment).
  if (isLocalhost(req)) {
    return NextResponse.next();
  }

  const session = req.cookies.get("site_session")?.value;
  if (session === "authenticated") {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
