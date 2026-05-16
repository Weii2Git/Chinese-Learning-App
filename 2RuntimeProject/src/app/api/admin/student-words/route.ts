import { type NextRequest } from "next/server";
import { readKnowledgeRecords } from "@/lib/knowledge";
import { getAllStudents } from "@/lib/student";
import { selectWordsForLesson } from "@/lib/lesson";
import { getAllWords } from "@/lib/word-list";

/**
 * GET /api/admin/student-words?studentId=X
 * Returns the student's known words, learning words, and next planned words.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    // Return all students list
    const students = await getAllStudents();
    return Response.json({ students });
  }

  const students = await getAllStudents();
  const student = students.find((s) => s.id === studentId);
  if (!student) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const allRecords = await readKnowledgeRecords();
  const studentRecords = allRecords.filter((r) => r.studentId === studentId);
  const allWords = await getAllWords();

  // Build word maps
  const wordMap = new Map(allWords.map((w) => [w.id, w]));

  const knownWords = studentRecords
    .filter((r) => r.state === "known")
    .map((r) => ({
      wordId: r.wordId,
      character: wordMap.get(r.wordId)?.character ?? r.wordId,
      pinyin: wordMap.get(r.wordId)?.pinyin ?? "",
      english: wordMap.get(r.wordId)?.english ?? "",
      level: r.level || (wordMap.get(r.wordId)?.level ?? ""),
      intervalStage: r.intervalStage,
      nextDueDate: r.nextDueDate,
    }));

  const learningWords = studentRecords
    .filter((r) => r.state === "learning")
    .map((r) => ({
      wordId: r.wordId,
      character: wordMap.get(r.wordId)?.character ?? r.wordId,
      pinyin: wordMap.get(r.wordId)?.pinyin ?? "",
      english: wordMap.get(r.wordId)?.english ?? "",
      level: r.level || (wordMap.get(r.wordId)?.level ?? ""),
    }));

  // Get next planned words (new + review that would be sent to Gemini)
  let nextNewWords: { character: string; pinyin: string; english: string; level: string }[] = [];
  let nextReviewWords: { character: string; pinyin: string; english: string; level: string }[] = [];
  try {
    const selection = await selectWordsForLesson(studentId, student.currentLevel);
    nextNewWords = selection.newWords.map((w) => ({
      character: w.character,
      pinyin: w.pinyin,
      english: w.english,
      level: w.level,
    }));
    nextReviewWords = selection.reviewWords.map((w) => ({
      character: w.character,
      pinyin: w.pinyin,
      english: w.english,
      level: w.level,
    }));
  } catch {
    // If word selection fails, return empty
  }

  return Response.json({
    student: { id: student.id, name: student.name, level: student.currentLevel },
    knownWords,
    learningWords,
    nextNewWords,
    nextReviewWords,
  });
}
