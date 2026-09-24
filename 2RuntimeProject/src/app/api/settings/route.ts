import { NextResponse } from "next/server";
import { getAppSettings } from "@/app/api/admin/settings/route";

/**
 * GET /api/settings
 * Public, read-only view of app settings needed by the student lesson flow
 * (question counts, star rates). Writing settings stays admin-only via
 * /api/admin/settings. This endpoint is intentionally NOT under /api/admin so
 * the admin auth gate doesn't block students from reading test configuration.
 */
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings);
}
