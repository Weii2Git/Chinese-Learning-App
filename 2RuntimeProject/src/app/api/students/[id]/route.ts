import { getStudent } from "@/lib/student";
import { getKnowledgeSummary } from "@/lib/knowledge";
import type { StudentWithStats } from "@/lib/types";

/**
 * GET /api/students/[id]
 * Returns a single student with computed stats:
 * - knowledgeSummary (known, learning, dontKnow, total, knownPercentage)
 * - currentLevelKnownPercentage
 * Returns 404 if student not found.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await getStudent(id);

  if (!student) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const knowledgeSummary = await getKnowledgeSummary(id, student.currentLevel);

  const studentWithStats: StudentWithStats = {
    ...student,
    knowledgeSummary,
    currentLevelKnownPercentage: knowledgeSummary.knownPercentage,
  };

  return Response.json(studentWithStats);
}
