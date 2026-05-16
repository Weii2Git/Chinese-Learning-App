import { generateStory } from "@/lib/gemini";
import type { StoryParams } from "@/lib/types";

/**
 * POST /api/generate-story
 * Generates a reading exercise story via Gemini API.
 * Request body: { newWords: Word[], knownWords: Word[], level: string }
 * Returns: { story: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StoryParams;

    const { newWords, knownWords, level } = body;

    if (!newWords || !knownWords || !level) {
      return Response.json(
        { error: "newWords, knownWords, and level are required" },
        { status: 400 }
      );
    }

    const result = await generateStory({ newWords, knownWords, level });

    return Response.json({ story: result.story, segmented: result.segmented, wordMeanings: result.wordMeanings });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate story";
    return Response.json({ error: message }, { status: 500 });
  }
}
