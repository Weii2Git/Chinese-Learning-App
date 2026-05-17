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
  const { data, error } = await supabase
    .from("knowledge_records")
    .select("word_id, compound_word, compound_meaning")
    .eq("student_id", id)
    .not("compound_word", "is", null);

  if (error || !data) return NextResponse.json([]);

  return NextResponse.json(
    data
      .filter((r) => r.compound_word && r.compound_meaning)
      .map((r) => ({
        wordId: r.word_id,
        compoundWord: r.compound_word,
        compoundMeaning: r.compound_meaning,
      }))
  );
}
