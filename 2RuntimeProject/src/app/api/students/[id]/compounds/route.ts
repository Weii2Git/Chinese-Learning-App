import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/students/[id]/compounds
 * Returns saved compound word context for all of a student's knowledge records.
 * Used by the test builder to show review words in their original compound form.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json([]);
  }

  const supabase = getSupabaseClient();
  // Return ALL of the student's records (word_id + SRS stage + any compound
  // context). The test builder uses compound context to show review words in
  // their original compound form, and uses interval_stage to avoid probing
  // words the student already knows well.
  const { data, error } = await supabase
    .from("knowledge_records")
    .select("word_id, compound_word, compound_meaning, interval_stage")
    .eq("student_id", id);

  if (error || !data) return NextResponse.json([]);

  return NextResponse.json(
    data.map((r) => ({
      wordId: r.word_id,
      compoundWord: r.compound_word ?? undefined,
      compoundMeaning: r.compound_meaning ?? undefined,
      intervalStage: r.interval_stage ?? undefined,
    }))
  );
}
