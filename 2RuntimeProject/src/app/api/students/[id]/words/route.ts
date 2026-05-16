import { NextRequest, NextResponse } from "next/server";
import { getStudent } from "@/lib/student";
import { readKnowledgeRecords } from "@/lib/knowledge";
import { getAllWords } from "@/lib/word-list";

// GET /api/students/[id]/words?state=known|learning
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const state = req.nextUrl.searchParams.get("state") as "known" | "learning" | null;

    if (!state || (state !== "known" && state !== "learning")) {
      return NextResponse.json({ error: "state must be 'known' or 'learning'" }, { status: 400 });
    }

    const student = await getStudent(id);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const [allRecords, allWords] = await Promise.all([
      readKnowledgeRecords(),
      getAllWords(),
    ]);

    const wordMap = new Map(allWords.map((w) => [w.id, w]));
    const studentRecords = allRecords.filter(
      (r) => r.studentId === id && r.state === state
    );

    const words = studentRecords
      .map((r) => {
        const word = wordMap.get(r.wordId);
        if (!word) return null;
        return {
          character: word.character,
          pinyin: word.pinyin,
          english: word.english,
          level: word.level,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.level > b!.level ? 1 : a!.level < b!.level ? -1 : 0));

    return NextResponse.json(words);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
