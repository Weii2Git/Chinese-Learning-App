import { SRS_INTERVALS_MS, SRS_MAX_STAGE, SRS_INITIAL_STAGE, SRS_RETIRED_STAGE } from "./constants";
import type { KnowledgeRecord } from "./types";

/**
 * A retired word (reached SRS_RETIRED_STAGE) is considered mastered and is no
 * longer scheduled for review.
 */
export function isRetired(stage: number | undefined): boolean {
  return (stage ?? 0) >= SRS_RETIRED_STAGE;
}

/**
 * Clamp an interval stage to the valid active range [1, SRS_MAX_STAGE].
 */
function clampStage(stage: number): number {
  return Math.max(SRS_INITIAL_STAGE, Math.min(SRS_MAX_STAGE, stage));
}

/**
 * Calculate the next due date given an interval stage and a reference timestamp.
 * Returns an ISO string of fromTimestamp + SRS_INTERVALS_MS[stage] milliseconds.
 * Retired words have no real due date; we return a far-future date as a sentinel.
 */
export function calculateDueDate(intervalStage: number, fromTimestamp: string): string {
  const fromMs = new Date(fromTimestamp).getTime();
  if (isRetired(intervalStage)) {
    // ~100 years out — effectively never due (retired words are also filtered
    // out of review selection, so this is just a safe sentinel).
    return new Date(fromMs + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  }
  const clamped = clampStage(intervalStage);
  const dueMs = fromMs + SRS_INTERVALS_MS[clamped];
  return new Date(dueMs).toISOString();
}

/**
 * Determine if a knowledge record is due for review at the given timestamp.
 * Returns true if the record has no SRS fields or nextDueDate <= now.
 */
export function isDue(record: KnowledgeRecord, now: string): boolean {
  // No SRS fields means immediately due (backward compatibility)
  if (
    record.intervalStage === undefined ||
    record.lastReviewedAt === undefined ||
    record.nextDueDate === undefined
  ) {
    return true;
  }

  // Invalid date treated as immediately due
  const dueMs = new Date(record.nextDueDate).getTime();
  if (isNaN(dueMs)) {
    return true;
  }

  const nowMs = new Date(now).getTime();
  return dueMs <= nowMs;
}

/**
 * Get the overdue duration in milliseconds.
 * Positive means overdue, negative means not yet due.
 * Records without SRS fields are treated as overdue by a large amount.
 */
export function getOverdueMs(record: KnowledgeRecord, now: string): number {
  // No SRS fields → treat as maximally overdue
  if (
    record.intervalStage === undefined ||
    record.lastReviewedAt === undefined ||
    record.nextDueDate === undefined
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Invalid date → treat as maximally overdue
  const dueMs = new Date(record.nextDueDate).getTime();
  if (isNaN(dueMs)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const nowMs = new Date(now).getTime();
  return nowMs - dueMs;
}

/**
 * Advance the interval stage after a correct answer.
 * Each correct answer moves up one stage. A correct answer at the top active
 * stage (SRS_MAX_STAGE) retires the word (SRS_RETIRED_STAGE) so it is no longer
 * scheduled for review. Already-retired words stay retired.
 */
export function advanceInterval(
  currentStage: number,
  now: string
): { intervalStage: number; lastReviewedAt: string; nextDueDate: string } {
  let nextStage: number;
  if (isRetired(currentStage)) {
    nextStage = SRS_RETIRED_STAGE;
  } else if (currentStage >= SRS_MAX_STAGE) {
    // Correct at the final active stage → retire.
    nextStage = SRS_RETIRED_STAGE;
  } else {
    nextStage = clampStage(currentStage) + 1;
  }
  return {
    intervalStage: nextStage,
    lastReviewedAt: now,
    nextDueDate: calculateDueDate(nextStage, now),
  };
}

/**
 * Reset the interval stage after an incorrect answer.
 * Returns SRS fields reset to stage 1.
 */
export function resetInterval(
  now: string
): { intervalStage: number; lastReviewedAt: string; nextDueDate: string } {
  return {
    intervalStage: SRS_INITIAL_STAGE,
    lastReviewedAt: now,
    nextDueDate: calculateDueDate(SRS_INITIAL_STAGE, now),
  };
}

/**
 * Select and sort review word candidates from knowledge records.
 * Every introduced word is reviewable — both "known" (to keep it fresh) and
 * "don't know" (to re-test until it becomes known). Sorted by priority:
 * - Overdue first (most overdue first, i.e. largest overdue duration)
 * - Then nearest upcoming due dates
 * Returns up to `limit` records.
 */
export function prioritizeReviewWords(
  records: KnowledgeRecord[],
  now: string,
  limit: number
): KnowledgeRecord[] {
  // Any introduced word is reviewable (known or don't know) EXCEPT retired
  // (mastered) words, which have graduated out of the review cycle.
  const reviewable = records.filter((r) => !isRetired(r.intervalStage));

  // Sort by overdue amount descending (most overdue first)
  const sorted = [...reviewable].sort((a, b) => {
    const overdueA = getOverdueMs(a, now);
    const overdueB = getOverdueMs(b, now);
    return overdueB - overdueA;
  });

  return sorted.slice(0, limit);
}

/**
 * Count how many records are currently overdue (excluding retired words).
 */
export function countOverdue(records: KnowledgeRecord[], now: string): number {
  return records.filter((r) => !isRetired(r.intervalStage) && isDue(r, now)).length;
}
