import { NextRequest, NextResponse } from "next/server";
import { checkAndResetStreak } from "@/lib/stars";
import { getStudent } from "@/lib/student";

/**
 * POST /api/students/[id]/check-streak
 * Passively checks if the student's streak should be reset due to a missed day.
 * Called when the student dashboard loads.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await checkAndResetStreak(id);
    const student = await getStudent(id);
    return NextResponse.json({ streakStars: student?.streakStars ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
