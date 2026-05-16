import { type NextRequest } from "next/server";
import { selectWordsForLesson } from "@/lib/lesson";
import { getStudent } from "@/lib/student";

/**
 * GET /api/words/selection?studentId=X
 * Returns word selections for a lesson: 5 new words + review words.
 * Returns 400 if studentId query param is missing.
 * Returns 404 if student not found.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return Response.json(
      { error: "studentId query parameter is required" },
      { status: 400 }
    );
  }

  const student = await getStudent(studentId);

  if (!student) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const selection = await selectWordsForLesson(studentId, student.currentLevel);
  return Response.json(selection);
}
