import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";

export type LlmProvider = "gemini" | "deepseek";

export interface AppSettings {
  vocabQuestionsCount: number;
  comprehensionQuestionsCount: number;
  starsPerCorrect: number;
  llmProvider: LlmProvider;
}

const DEFAULTS: AppSettings = {
  vocabQuestionsCount: 20,
  comprehensionQuestionsCount: 5,
  starsPerCorrect: 1,
  llmProvider: "gemini",
};

export async function getAppSettings(): Promise<AppSettings> {
  if (!isSupabaseConfigured()) return DEFAULTS;

  const supabase = getSupabaseClient();
  const { data } = await supabase.from("app_settings").select("key, value");

  if (!data || data.length === 0) return DEFAULTS;

  const map = new Map(data.map((r) => [r.key, r.value]));
  // Single star rate. Fall back to the legacy "fast" key (then "slow") so
  // existing data keeps working until the migration collapses the keys.
  const starRate =
    map.get("stars_per_correct") ??
    map.get("stars_per_correct_fast") ??
    map.get("stars_per_correct_slow") ??
    "1";
  const provider = map.get("llm_provider") === "deepseek" ? "deepseek" : "gemini";
  return {
    vocabQuestionsCount: parseInt(map.get("vocab_questions_count") || "20", 10),
    comprehensionQuestionsCount: parseInt(map.get("comprehension_questions_count") || "5", 10),
    starsPerCorrect: parseFloat(starRate || "1"),
    llmProvider: provider,
  };
}

// GET — return current settings
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings);
}

// POST — update settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vocabQuestionsCount, comprehensionQuestionsCount, starsPerCorrect, llmProvider } = body;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = getSupabaseClient();
    const updates = [
      { key: "vocab_questions_count", value: String(vocabQuestionsCount) },
      { key: "comprehension_questions_count", value: String(comprehensionQuestionsCount) },
      { key: "stars_per_correct", value: String(starsPerCorrect) },
    ];
    // Only persist the provider when a valid value is supplied, so partial
    // updates from older clients don't wipe it.
    if (llmProvider === "gemini" || llmProvider === "deepseek") {
      updates.push({ key: "llm_provider", value: llmProvider });
    }

    for (const { key, value } of updates) {
      await supabase.from("app_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
