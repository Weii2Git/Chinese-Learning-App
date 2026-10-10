import { getAllStudents } from "@/lib/student";
import { weeklyCountsForAllStudents } from "@/lib/lesson-events";
import { weekBoundaries } from "@/lib/week";

/**
 * GET /api/admin/weekly-lessons
 * Admin-only (gated by middleware under /api/admin). Returns each student's
 * lesson counts for the current and previous week (weeks start Monday 00:00
 * Asia/Singapore). Students with no lessons show zeros.
 */
export async function GET() {
  const [students, counts] = await Promise.all([
    getAllStudents(),
    weeklyCountsForAllStudents(),
  ]);

  const { prevWeekStartISO, thisWeekStartISO } = weekBoundaries();

  const rows = students
    .map((s) => {
      const c = counts[s.id] ?? { thisWeek: 0, prevWeek: 0 };
      return {
        id: s.id,
        name: s.name,
        currentLevel: s.currentLevel,
        thisWeek: c.thisWeek,
        prevWeek: c.prevWeek,
      };
    })
    .sort((a, b) => b.thisWeek - a.thisWeek || a.name.localeCompare(b.name));

  return Response.json({
    weekStart: thisWeekStartISO,
    prevWeekStart: prevWeekStartISO,
    students: rows,
  });
}
