import { NextRequest, NextResponse } from "next/server";
import { getStudent, updateStudent } from "@/lib/student";
import { readLogForStudent, appendStarLog } from "@/app/api/admin/adjust-stars/route";

// GET — return star log for this student
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = await readLogForStudent(id);
  return NextResponse.json(log);
}

// POST — student deducts their own stars
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { deductAmount, reason } = await req.json();

    if (!reason?.trim()) {
      return NextResponse.json({ error: "Please provide a reason." }, { status: 400 });
    }
    if (typeof deductAmount !== "number" || deductAmount <= 0 || !Number.isInteger(deductAmount)) {
      return NextResponse.json({ error: "Deduct amount must be a positive integer." }, { status: 400 });
    }

    const student = await getStudent(id);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const previousValue = student.performanceStars;
    const newValue = Math.max(0, previousValue - deductAmount);
    const actualDelta = newValue - previousValue; // will be negative

    await updateStudent(id, { performanceStars: newValue });

    await appendStarLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      studentId: id,
      studentName: student.name,
      starType: "performanceStars",
      previousValue,
      newValue,
      delta: actualDelta,
      reason: reason.trim(),
      source: "admin", // student self-deduction treated same as admin
    });

    return NextResponse.json({ newValue, delta: actualDelta });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
