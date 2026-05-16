import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getStudent, updateStudent } from "@/lib/student";

const LOG_FILE = path.resolve(process.cwd(), "data/star-adjustments.json");
const MAX_LOG_ENTRIES = 10;

export interface StarAdjustmentEntry {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  starType: "streakStars" | "performanceStars";
  previousValue: number;
  newValue: number;
  delta: number;
  reason: string;
}

async function readLog(): Promise<StarAdjustmentEntry[]> {
  try {
    const content = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeLog(entries: StarAdjustmentEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.writeFile(LOG_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

// GET — return the adjustment log
export async function GET() {
  const log = await readLog();
  return NextResponse.json(log);
}

// POST — apply a star adjustment
export async function POST(req: NextRequest) {
  try {
    const { studentId, starType, newValue, reason } = await req.json();

    if (!studentId || !starType || newValue === undefined || !reason?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (starType !== "performanceStars") {
      return NextResponse.json({ error: "Only performanceStars can be adjusted by admin" }, { status: 400 });
    }

    if (typeof newValue !== "number" || newValue < 0 || !Number.isInteger(newValue)) {
      return NextResponse.json({ error: "newValue must be a non-negative integer" }, { status: 400 });
    }

    const student = await getStudent(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const previousValue = student[starType];
    const delta = newValue - previousValue;

    // Apply the update
    const updated = await updateStudent(studentId, { [starType]: newValue });

    // Append to log, keep last 10
    const log = await readLog();
    const entry: StarAdjustmentEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      studentId,
      studentName: student.name,
      starType,
      previousValue,
      newValue,
      delta,
      reason: reason.trim(),
    };
    const newLog = [entry, ...log].slice(0, MAX_LOG_ENTRIES);
    await writeLog(newLog);

    return NextResponse.json({ student: updated, entry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
