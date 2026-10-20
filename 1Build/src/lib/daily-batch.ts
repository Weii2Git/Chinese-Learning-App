import { isSupabaseConfigured, getSupabaseClient } from "./supabase";

/**
 * Per-student "new words for today" batch. All lessons a student takes on the
 * same calendar day (Asia/Singapore) share the same set of new words. The batch
 * is recomputed on the first lesson of a new day.
 *
 * Supabase table `daily_word_batch` (one row per student):
 *   create table daily_word_batch (
 *     student_id uuid primary key,
 *     batch_date text not null,        -- "YYYY-MM-DD" in SGT
 *     word_ids   jsonb not null,       -- array of word id strings
 *     updated_at timestamptz not null default now()
 *   );
 *
 * All functions are defensive: if Supabase isn't configured or a query fails,
 * they no-op / return null so the lesson flow falls back to normal selection.
 */

export interface DailyBatch {
  batchDate: string;
  wordIds: string[];
}

/**
 * Read the student's stored daily batch, or null if none / on error.
 */
export async function getDailyBatch(studentId: string): Promise<DailyBatch | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("daily_word_batch")
      .select("batch_date, word_ids")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error || !data) return null;
    const wordIds = Array.isArray(data.word_ids) ? (data.word_ids as string[]) : [];
    return { batchDate: data.batch_date as string, wordIds };
  } catch {
    return null;
  }
}

/**
 * Save (upsert) the student's daily batch for the given SGT date.
 */
export async function saveDailyBatch(
  studentId: string,
  batchDate: string,
  wordIds: string[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from("daily_word_batch").upsert(
      {
        student_id: studentId,
        batch_date: batchDate,
        word_ids: wordIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" }
    );
  } catch {
    // Non-blocking: a persistence failure just means the next lesson recomputes.
  }
}
