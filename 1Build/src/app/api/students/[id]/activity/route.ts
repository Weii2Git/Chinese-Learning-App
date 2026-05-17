import { NextRequest, NextResponse } from "next/server";
import { getActivityLog } from "@/lib/activity-log";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const entries = await getActivityLog(id, from, to);
  return NextResponse.json(entries);
}
