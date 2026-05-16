import { getStudent, updateStudent } from "./student";

/**
 * Determine the date string (YYYY-MM-DD) for today in Singapore time (UTC+8).
 */
function getTodayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/**
 * Determine the date string (YYYY-MM-DD) for yesterday in Singapore time (UTC+8).
 */
function getYesterdayDateString(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/**
 * Check if the streak should be reset due to a missed day, and reset it if so.
 * Called when the student dashboard loads (passive check).
 *
 * - If lastActiveDate is today or yesterday → streak is still valid, no change
 * - If lastActiveDate is anything else (or null) → reset streak to 0
 */
export async function checkAndResetStreak(studentId: string): Promise<void> {
  const student = await getStudent(studentId);
  if (!student) return;

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Streak is still alive if they were active today or yesterday
  if (student.lastActiveDate === today || student.lastActiveDate === yesterday) {
    return;
  }

  // Missed a day (or never played) — reset streak to 0
  if (student.streakStars !== 0) {
    await updateStudent(studentId, { streakStars: 0 });
  }
}

/**
 * Update a student's streak count when they complete a lesson.
 *
 * Logic:
 * - If lastActiveDate is today → already completed a lesson today, keep streak unchanged
 * - If lastActiveDate is yesterday → consecutive day, increment streak by 1
 * - Anything else → start fresh at 1
 *
 * Also updates lastActiveDate to today.
 * Returns the updated streak count.
 */
export async function updateStreakStars(studentId: string): Promise<number> {
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  let newStreakStars: number;

  if (student.lastActiveDate === today) {
    // Already completed a lesson today — keep streak unchanged
    newStreakStars = student.streakStars;
  } else if (student.lastActiveDate === yesterday) {
    // Consecutive day — increment streak (no cap)
    newStreakStars = student.streakStars + 1;
  } else {
    // Gap in activity (or first lesson ever) — start at 1
    newStreakStars = 1;
  }

  await updateStudent(studentId, {
    streakStars: newStreakStars,
    lastActiveDate: today,
  });

  return newStreakStars;
}

/**
 * Award performance stars to a student based on the number of quick correct answers.
 *
 * Performance stars are cumulative and never decremented.
 * Each quick correct answer earns 1 performance star.
 *
 * Returns the updated total performance star count.
 */
export async function awardPerformanceStars(
  studentId: string,
  quickCorrectCount: number
): Promise<number> {
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const newPerformanceStars = student.performanceStars + quickCorrectCount;

  await updateStudent(studentId, {
    performanceStars: newPerformanceStars,
  });

  return newPerformanceStars;
}
