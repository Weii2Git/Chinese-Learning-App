import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import type { ActivityLogEntry } from "./types";

/**
 * Log an activity entry for a student.
 * Uses Supabase in production, silently skips in local dev (no file fallback needed).
 */
export async function logActivity(
  studentId: string,
  activityDate: string, // YYYY-MM-DD
  activityType: "lesson" | "freeze_used" | "freeze_earned",
  notes?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  // Use upsert with ignore on conflict — one entry per student/date/type
  await supabase.from("lesson_activity_log").upsert(
    {
      student_id: studentId,
      activity_date: activityDate,
      activity_type: activityType,
      notes: notes ?? null,
    },
    { onConflict: "student_id,activity_date,activity_type", ignoreDuplicates: true }
  );
}

/**
 * Get activity log entries for a student, optionally filtered by date range.
 * Returns entries ordered by date descending.
 */
export async function getActivityLog(
  studentId: string,
  fromDate?: string, // YYYY-MM-DD
  toDate?: string    // YYYY-MM-DD
): Promise<ActivityLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseClient();
  const PAGE_SIZE = 1000;
  const rows: Array<Record<string, unknown>> = [];

  // PostgREST caps a single response at 1000 rows, so page through with
  // .range() until a short page is returned. The id tiebreaker keeps the
  // ordering stable across pages (dates can repeat within a day).
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("lesson_activity_log")
      .select("*")
      .eq("student_id", studentId)
      .order("activity_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (fromDate) query = query.gte("activity_date", fromDate);
    if (toDate) query = query.lte("activity_date", toDate);

    const { data, error } = await query;
    if (error || !data) return []; // preserve all-or-nothing contract on error

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows.map(toEntry);
}

function toEntry(r: Record<string, unknown>): ActivityLogEntry {
  return {
    id: r.id as string,
    studentId: r.student_id as string,
    activityDate: r.activity_date as string,
    activityType: r.activity_type as ActivityLogEntry["activityType"],
    notes: (r.notes as string | null) ?? undefined,
  };
}
