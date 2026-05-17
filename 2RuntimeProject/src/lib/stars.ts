import { getStudent, updateStudent } from "./student";
import { logActivity } from "./activity-log";

const FREEZE_EARN_INTERVAL = 10; // earn 1 freeze every 10 streak days

function getTodayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

function getYesterdayDateString(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return yesterday.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/**
 * Passive streak check on dashboard load.
 * - If active today or yesterday → streak alive, no change
 * - If missed a day AND has freezes → use 1 freeze, log it, keep streak
 * - If missed a day AND no freezes → reset streak to 0
 */
export async function checkAndResetStreak(studentId: string): Promise<void> {
  const student = await getStudent(studentId);
  if (!student) return;

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Streak still alive
  if (student.lastActiveDate === today || student.lastActiveDate === yesterday) return;
  // Never played
  if (!student.lastActiveDate) return;

  if (student.streakFreezes > 0) {
    // Use a freeze to protect the streak
    const missedDate = yesterday; // the day that was missed
    await updateStudent(studentId, {
      streakFreezes: student.streakFreezes - 1,
      lastActiveDate: yesterday, // treat yesterday as "covered" so streak stays alive
    });
    await logActivity(studentId, missedDate, "freeze_used", `Streak freeze used (streak: ${student.streakStars})`);
  } else {
    // No freezes — reset streak
    if (student.streakStars !== 0) {
      await updateStudent(studentId, { streakStars: 0 });
    }
  }
}

/**
 * Update streak when a lesson is completed.
 * - Already active today → no change
 * - Active yesterday → increment streak, check if freeze earned
 * - Otherwise → reset to 1
 * Returns the new streak count.
 */
export async function updateStreakStars(studentId: string): Promise<number> {
  const student = await getStudent(studentId);
  if (!student) throw new Error(`Student not found: ${studentId}`);

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  let newStreakStars: number;
  let newFreezes = student.streakFreezes;
  let freezeEarned = false;

  if (student.lastActiveDate === today) {
    newStreakStars = student.streakStars;
  } else if (student.lastActiveDate === yesterday) {
    newStreakStars = student.streakStars + 1;
    // Earn a freeze every FREEZE_EARN_INTERVAL days
    if (newStreakStars % FREEZE_EARN_INTERVAL === 0) {
      newFreezes = student.streakFreezes + 1;
      freezeEarned = true;
    }
  } else {
    newStreakStars = 1;
  }

  await updateStudent(studentId, {
    streakStars: newStreakStars,
    streakFreezes: newFreezes,
    lastActiveDate: today,
  });

  // Log lesson activity
  await logActivity(studentId, today, "lesson", `Streak: ${newStreakStars}`);

  // Log freeze earned if applicable
  if (freezeEarned) {
    await logActivity(studentId, today, "freeze_earned", `Earned at streak ${newStreakStars}`);
  }

  return newStreakStars;
}
