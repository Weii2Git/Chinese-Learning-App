import { SRS_INTERVALS_MS, SRS_MAX_STAGE, SRS_INITIAL_STAGE } from "./constants";
import type { KnowledgeRecord } from "./types";

/**
 * Clamp an interval stage to the valid range [1, SRS_MAX_STAGE].
 */
function clampStage(stage: number): number {
  return Math.max(SRS_INITIAL_STAGE, Math.min(SRS_MAX_STAGE, stage));
}

/**
 * Calculate the next due date given an interval stage and a reference timestamp.
 * Returns an ISO string of fromTimestamp + SRS_INTERVALS_MS[stage] milliseconds.
 */
export function calculateDueDate(intervalStage: number, fromTimestamp: string): string {
  const clamped = clampStage(intervalStage);
  const fromMs = new Date(fromTimestamp).getTime();
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
 * Returns updated SRS fields with min(stage+1, SRS_MAX_STAGE).
 */
export function advanceInterval(
  currentStage: number,
  now: string
): { intervalStage: number; lastReviewedAt: string; nextDueDate: string } {
  const nextStage = Math.min(clampStage(currentStage) + 1, SRS_MAX_STAGE);
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
 * Filters to "known" and "learning" records, sorts by priority:
 * - Overdue first (most overdue first, i.e. largest overdue duration)
 * - Then nearest upcoming due dates
 * Returns up to `limit` records.
 */
export function prioritizeReviewWords(
  records: KnowledgeRecord[],
  now: string,
  limit: number
): KnowledgeRecord[] {
  // Filter to "known" and "learning" records (learning words need review too)
  const reviewable = records.filter((r) => r.state === "known" || r.state === "learning");

  // Sort by overdue amount descending (most overdue first)
  const sorted = [...reviewable].sort((a, b) => {
    const overdueA = getOverdueMs(a, now);
    const overdueB = getOverdueMs(b, now);
    return overdueB - overdueA;
  });

  return sorted.slice(0, limit);
}

/**
 * Count how many records are currently overdue.
 */
export function countOverdue(records: KnowledgeRecord[], now: string): number {
  return records.filter((r) => (r.state === "known" || r.state === "learning") && isDue(r, now)).length;
}
