import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { weekBoundaries } from "./week";

/**
 * Per-lesson event log. Unlike lesson_activity_log (one row per day, used by
 * the streak calendar), this table stores ONE row per completed lesson with a
 * real timestamp, so we can count how many lessons were taken within a week.
 *
 * Supabase table `lesson_events`:
 *   create table lesson_events (
 *     id uuid primary key,
 *     student_id uuid not null,
 *     completed_at timestamptz not null default now()
 *   );
 *   create index lesson_events_student_time on lesson_events (student_id, completed_at);
 *
 * All functions here are defensive: if Supabase isn't configured or a query
 * fails, they no-op / return zero so lesson flow and pages never break.
 */

/**
 * Record one completed lesson. Fire-and-forget; never throws.
 */
export async function appendLessonEvent(
  studentId: string,
  completedAt: string = new Date().toISOString()
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from("lesson_events").insert({
      id: crypto.randomUUID(),
      student_id: studentId,
      completed_at: completedAt,
    });
  } catch {
    // Non-blocking: a logging failure must not affect lesson completion.
  }
}

/**
 * Count a single student's lessons in [startISO, endISO).
 */
export async function countLessonsInRange(
  studentId: string,
  startISO: string,
  endISO: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("lesson_events")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .gte("completed_at", startISO)
      .lt("completed_at", endISO);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Count a single student's lessons in the current week (Mon 00:00 SGT → now).
 */
export async function countLessonsThisWeek(studentId: string): Promise<number> {
  const { thisWeekStartISO, nextWeekStartISO } = weekBoundaries();
  return countLessonsInRange(studentId, thisWeekStartISO, nextWeekStartISO);
}

/**
 * Current- and previous-week lesson counts for EVERY student, keyed by
 * studentId. Does one query covering both weeks and buckets in JS, so the admin
 * table needs only a single round-trip. Returns {} on error / no Supabase.
 */
export async function weeklyCountsForAllStudents(): Promise<
  Record<string, { thisWeek: number; prevWeek: number }>
> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = getSupabaseClient();
    const { prevWeekStartISO, thisWeekStartISO, nextWeekStartISO } = weekBoundaries();

    // Pull every event from the start of last week up to the end of this week.
    // Paged to avoid the 1000-row cap.
    const PAGE_SIZE = 1000;
    const counts: Record<string, { thisWeek: number; prevWeek: number }> = {};

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("lesson_events")
        .select("student_id, completed_at")
        .gte("completed_at", prevWeekStartISO)
        .lt("completed_at", nextWeekStartISO)
        .order("completed_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;

      const thisWeekMs = new Date(thisWeekStartISO).getTime();
      const prevWeekMs = new Date(prevWeekStartISO).getTime();
      for (const row of data) {
        const sid = row.student_id as string;
        const ts = new Date(row.completed_at as string).getTime();
        if (Number.isNaN(ts)) continue;
        if (!counts[sid]) counts[sid] = { thisWeek: 0, prevWeek: 0 };
        if (ts >= thisWeekMs) counts[sid].thisWeek++;
        else if (ts >= prevWeekMs) counts[sid].prevWeek++;
      }

      if (data.length < PAGE_SIZE) break;
    }

    return counts;
  } catch {
    return {};
  }
}
