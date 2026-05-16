import { NextRequest, NextResponse } from "next/server";
import { getStudent, updateStudent } from "@/lib/student";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { promises as fs } from "fs";
import path from "path";

const LOG_FILE = path.resolve(process.cwd(), "data/star-adjustments.json");
const MAX_LOG_ENTRIES = 10;

export interface StarAdjustmentEntry {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  starType: "performanceStars";
  previousValue: number;
  newValue: number;
  delta: number;
  reason: string;
}

// --- Log read/write: Supabase in production, file in local dev ---

async function readLog(): Promise<StarAdjustmentEntry[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("star_adjustment_log")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(MAX_LOG_ENTRIES);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      studentId: r.student_id,
      studentName: r.student_name,
      starType: r.star_type,
      previousValue: r.previous_value,
      newValue: r.new_value,
      delta: r.delta,
      reason: r.reason,
    }));
  }
  // Local file fallback
  try {
    const content = await fs.readFile(LOG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function appendLog(entry: StarAdjustmentEntry): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    await supabase.from("star_adjustment_log").insert({
      id: entry.id,
      timestamp: entry.timestamp,
      student_id: entry.studentId,
      student_name: entry.studentName,
      star_type: entry.starType,
      previous_value: entry.previousValue,
      new_value: entry.newValue,
      delta: entry.delta,
      reason: entry.reason,
    });
    return;
  }
  // Local file fallback
  const log = await readLog();
  const newLog = [entry, ...log].slice(0, MAX_LOG_ENTRIES);
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.writeFile(LOG_FILE, JSON.stringify(newLog, null, 2), "utf-8");
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

    const previousValue = student[starType as keyof typeof student] as number;
    const delta = newValue - previousValue;

    const updated = await updateStudent(studentId, { [starType]: newValue });

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

    await appendLog(entry);

    return NextResponse.json({ student: updated, entry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
