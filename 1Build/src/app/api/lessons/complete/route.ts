import { completeLessonAndUpdateState } from "@/lib/lesson";
import { getStudent } from "@/lib/student";
import { getKnowledgeSummary } from "@/lib/knowledge";
import type { QuestionResult, StudentWithStats } from "@/lib/types";

/**
 * POST /api/lessons/complete
 * Records lesson completion, updates knowledge states, awards stars,
 * and checks level progression.
 *
 * Request body: { studentId: string, results: QuestionResult[] }
 * Response: { updatedStudent: StudentWithStats, knowledgeUpdates: KnowledgeUpdate[], leveledUp: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, results } = body as {
      studentId: string;
      results: QuestionResult[];
    };

    if (!studentId) {
      return Response.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const student = await getStudent(studentId);
    if (!student) {
      return Response.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const outcome = await completeLessonAndUpdateState(studentId, results);

    // Get the updated student after completion
    const updatedStudent = await getStudent(studentId);
    if (!updatedStudent) {
      return Response.json(
        { error: "Failed to retrieve updated student" },
        { status: 500 }
      );
    }

    const knowledgeSummary = await getKnowledgeSummary(
      studentId,
      updatedStudent.currentLevel
    );

    const studentWithStats: StudentWithStats = {
      ...updatedStudent,
      knowledgeSummary,
      currentLevelKnownPercentage: knowledgeSummary.knownPercentage,
    };

    return Response.json({
      updatedStudent: studentWithStats,
      knowledgeUpdates: outcome.knowledgeUpdates,
      leveledUp: outcome.leveledUp,
      streakBonus: outcome.streakBonus,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
