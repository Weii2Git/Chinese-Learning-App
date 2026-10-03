import { generateWordMeanings } from "@/lib/gemini";

/**
 * POST /api/word-meanings
 * Body: { words: string[] }
 * Returns: { meanings: Record<string, string> }
 *
 * Targeted gap-fill: translate compound words that the story generator didn't
 * provide a meaning for, so a vocab question never shows a compound with the
 * bare single-character meaning. Never 500s on a translation miss — returns
 * whatever could be translated (missing words simply absent).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { words?: unknown };
    const words = Array.isArray(body.words)
      ? body.words.filter((w): w is string => typeof w === "string")
      : [];

    if (words.length === 0) {
      return Response.json({ meanings: {} });
    }

    const meanings = await generateWordMeanings(words);
    return Response.json({ meanings });
  } catch {
    // Gap-fill is best-effort; never block the test on failure.
    return Response.json({ meanings: {} });
  }
}
