import { NextRequest, NextResponse } from "next/server";
import { getStudent, updateStudent } from "@/lib/student";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { promises as fs } from "fs";
import path from "path";

const LOG_FILE = path.resolve(process.cwd(), "data/star-adjustments.json");
export const MAX_LOG_PER_STUDENT = 20;

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
  source: "admin" | "lesson" | "student";
}

// --- Shared log helpers (used by this route AND lesson completion) ---

export async function readLogForStudent(studentId: string): Promise<StarAdjustmentEntry[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("star_adjustment_log")
      .select("*")
      .eq("student_id", studentId)
      .order("timestamp", { ascending: false })
      .limit(MAX_LOG_PER_STUDENT);
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
      source: r.source ?? "admin",
    }));
  }
  // Local file fallback — filter by studentId
  try {
    const content = await fs.readFile(LOG_FILE, "utf-8");
    const all: StarAdjustmentEntry[] = JSON.parse(content);
    return all.filter((e) => e.studentId === studentId).slice(0, MAX_LOG_PER_STUDENT);
  } catch {
    return [];
  }
}

export async function appendStarLog(entry: StarAdjustmentEntry): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    // Insert new entry
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
      source: entry.source,
    });
    // Prune: keep only the latest 20 per student
    const supabase2 = getSupabaseClient();
    const { data: rows } = await supabase2
      .from("star_adjustment_log")
      .select("id, timestamp")
      .eq("student_id", entry.studentId)
      .order("timestamp", { ascending: false });
    if (rows && rows.length > MAX_LOG_PER_STUDENT) {
      const toDelete = rows.slice(MAX_LOG_PER_STUDENT).map((r: { id: string }) => r.id);
      await supabase2.from("star_adjustment_log").delete().in("id", toDelete);
    }
    return;
  }
  // Local file fallback
  try {
    const content = await fs.readFile(LOG_FILE, "utf-8");
    const all: StarAdjustmentEntry[] = JSON.parse(content);
    // Keep latest 20 per student, plus all other students' entries
    const others = all.filter((e) => e.studentId !== entry.studentId);
    const thisStudent = all.filter((e) => e.studentId === entry.studentId);
    const updated = [entry, ...thisStudent].slice(0, MAX_LOG_PER_STUDENT);
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.writeFile(LOG_FILE, JSON.stringify([...updated, ...others], null, 2), "utf-8");
  } catch {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.writeFile(LOG_FILE, JSON.stringify([entry], null, 2), "utf-8");
  }
}

// GET /api/admin/adjust-stars?studentId=xxx — return log for a student
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json([]);
  const log = await readLogForStudent(studentId);
  return NextResponse.json(log);
}

// POST — apply an admin star adjustment
export async function POST(req: NextRequest) {
  try {
    const { studentId, starType, newValue, reason } = await req.json();

    if (!studentId || !starType || newValue === undefined || !reason?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (starType !== "performanceStars") {
      return NextResponse.json({ error: "Only performanceStars can be adjusted by admin" }, { status: 400 });
    }
    if (typeof newValue !== "number" || !Number.isInteger(newValue)) {
      return NextResponse.json({ error: "newValue must be an integer" }, { status: 400 });
    }

    const student = await getStudent(studentId);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

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
      source: "admin",
    };
    await appendStarLog(entry);

    return NextResponse.json({ student: updated, entry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
