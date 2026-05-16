import { generateComprehensionQuestions } from "@/lib/gemini";
import type { ComprehensionParams } from "@/lib/types";

/**
 * POST /api/generate-comprehension
 * Generates comprehension questions via Gemini API.
 * Request body: { story: string, level: string, previousQuestions?: string[] }
 * Returns: { questions: ComprehensionQuestion[] }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ComprehensionParams;

    const { story, level, previousQuestions } = body;

    if (!story || !level) {
      return Response.json(
        { error: "story and level are required" },
        { status: 400 }
      );
    }

    const questions = await generateComprehensionQuestions({
      story,
      level,
      previousQuestions,
    });

    return Response.json({ questions });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate comprehension questions";
    return Response.json({ error: message }, { status: 500 });
  }
}
