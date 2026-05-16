import { type NextRequest } from "next/server";
import { getWordsForLevel } from "@/lib/word-list";

/**
 * GET /api/words?level=X
 * Returns enriched words for a given level.
 * Returns 400 if level query param is missing.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const level = searchParams.get("level");

  if (!level) {
    return Response.json(
      { error: "level query parameter is required" },
      { status: 400 }
    );
  }

  const words = await getWordsForLevel(level);
  return Response.json(words);
}
