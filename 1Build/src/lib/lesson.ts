import {
  LEVELS,
  NEW_WORDS_PER_LESSON,
  REVIEW_WORDS_PER_LESSON,
  REVIEW_WORDS_BUFFER,
  MAX_STREAK_BONUS,
} from "./constants";
import { readKnowledgeRecords, bulkUpdate } from "./knowledge";
import { getStudent, updateStudent, checkAndAdvanceLevel } from "./student";
import { updateStreakStars } from "./stars";
import { getWordsForLevel, getAllWords } from "./word-list";
import { prioritizeReviewWords, countOverdue, advanceInterval, resetInterval, isRetired } from "./srs";
import { appendStarLog } from "@/app/api/admin/adjust-stars/route";
import { getAppSettings } from "@/app/api/admin/settings/route";
import { appendLessonEvent } from "./lesson-events";
import type {
  Word,
  WordSelection,
  QuestionResult,
  KnowledgeUpdate,
  LessonOutcome,
  KnowledgeState,
  KnowledgeRecord,
} from "./types";

/**
 * Select words for a lesson: up to 5 new words and a batch of review words.
 *
 * New words: the next words in the current level's authored order that have
 * NEVER been introduced (no knowledge record yet). We walk the level list in
 * order, so each lesson advances through the level. If the current level is
 * fully introduced, we fall back to earlier levels' not-yet-introduced words.
 *
 * Review words: every word that HAS been introduced (any knowledge record,
 * whether "known" or "don't know"), prioritized by the SRS schedule. "Don't
 * know" words keep coming back until they are answered correctly (→ "known").
 */
export async function selectWordsForLesson(
  studentId: string,
  level: string
): Promise<WordSelection> {
  const currentLevelIndex = LEVELS.indexOf(level);
  if (currentLevelIndex === -1) {
    throw new Error(`Invalid level: ${level}`);
  }

  // Get levels up to and including the current level
  const relevantLevels = LEVELS.slice(0, currentLevelIndex + 1);

  // Load all words for relevant levels
  const allWords = await getAllWords();
  const relevantWords = allWords.filter((w) =>
    relevantLevels.includes(w.level)
  );

  // Load knowledge records for this student
  const knowledgeRecords = await readKnowledgeRecords();
  const studentRecords = knowledgeRecords.filter(
    (r) => r.studentId === studentId
  );

  // Set of wordIds the student has already been introduced to (has a record).
  // "Introduced" is based on record EXISTENCE, not state — a word answered
  // wrong (state "don't know") has still been introduced and must not be
  // offered again as a brand-new word.
  const introducedIds = new Set<string>();
  for (const record of studentRecords) {
    introducedIds.add(record.wordId);
  }

  // Separate words into current level vs earlier levels, preserving the
  // authored order from the word list (getWordsForLevel/getAllWords return
  // words in document order).
  const currentLevelWords = relevantWords.filter((w) => w.level === level);
  const earlierLevelWords = relevantWords.filter((w) => w.level !== level);

  // New words: walk the current level IN ORDER and take the next words that
  // have never been introduced; then fall back to earlier levels if needed.
  const newWordCandidatesCurrentLevel = currentLevelWords.filter(
    (w) => !introducedIds.has(w.id)
  );
  const newWordCandidatesEarlierLevels = earlierLevelWords.filter(
    (w) => !introducedIds.has(w.id)
  );

  const allNewWordCandidates: Word[] = [
    ...newWordCandidatesCurrentLevel,
    ...newWordCandidatesEarlierLevels,
  ];

  let newWords: Word[] = allNewWordCandidates.slice(0, NEW_WORDS_PER_LESSON);

  // Review words: every introduced word is reviewable (known or don't know),
  // prioritized by SRS.
  const reviewableRecords = studentRecords;
  const now = new Date().toISOString();
  
  // Check for backlog — if overdue words exist, allow up to 10 extra review slots (max 30 total)
  const overdueCount = countOverdue(reviewableRecords, now);
  const extraSlots = Math.min(overdueCount > REVIEW_WORDS_PER_LESSON ? 10 : 0, overdueCount - REVIEW_WORDS_PER_LESSON);
  const reviewLimit = REVIEW_WORDS_PER_LESSON + REVIEW_WORDS_BUFFER + Math.max(0, extraSlots);
  
  const prioritizedRecords = prioritizeReviewWords(reviewableRecords, now, reviewLimit);

  // Map prioritized records back to Word objects
  const wordMap = new Map<string, Word>();
  for (const w of relevantWords) {
    wordMap.set(w.id, w);
  }
  // Also include all words in case records reference words from other levels
  for (const w of allWords) {
    if (!wordMap.has(w.id)) {
      wordMap.set(w.id, w);
    }
  }

  let reviewWords: Word[] = prioritizedRecords
    .map((r) => {
      // Check if word exists in the word map
      const existing = wordMap.get(r.wordId);
      if (existing) return existing;
      // For looked-up words (lookup:xxx), create a Word object from the record
      if (r.wordId.startsWith("lookup:")) {
        const character = r.wordId.replace("lookup:", "");
        return {
          id: r.wordId,
          character,
          pinyin: "", // Will be computed by pinyin-pro during test
          english: "",
          level: r.level || level,
        } as Word;
      }
      return undefined;
    })
    .filter((w): w is Word => w !== undefined);

  // If fewer than needed review words, fill remaining slots from current level
  if (reviewWords.length < reviewLimit) {
    const selectedIds = new Set([
      ...newWords.map((w) => w.id),
      ...reviewWords.map((w) => w.id),
    ]);
    // Don't pull retired (mastered) words back into review as filler.
    const retiredIds = new Set(
      studentRecords.filter((r) => isRetired(r.intervalStage)).map((r) => r.wordId)
    );

    const fillCandidates = currentLevelWords.filter(
      (w) => !selectedIds.has(w.id) && !retiredIds.has(w.id)
    );

    const slotsToFill = reviewLimit - reviewWords.length;
    const fillWords = fillCandidates.slice(0, slotsToFill);
    reviewWords = [...reviewWords, ...fillWords];
  }

  // If total (new + review) is still less than target, increase new words to fill the gap
  const totalTarget = NEW_WORDS_PER_LESSON + reviewLimit;
  const totalSelected = newWords.length + reviewWords.length;
  if (totalSelected < totalTarget && allNewWordCandidates.length > newWords.length) {
    const extraNeeded = totalTarget - totalSelected;
    const extraNew = allNewWordCandidates
      .slice(newWords.length)
      .filter((w) => !reviewWords.some((r) => r.id === w.id))
      .slice(0, extraNeeded);
    newWords = [...newWords, ...extraNew];
  }

  return { newWords, reviewWords };
}

/**
 * Complete a lesson and update all relevant state:
 * - Classify answers and update knowledge states
 * - Award performance stars for quick correct answers
 * - Update streak stars
 * - Check for level advancement
 * - Increment lessonsCompleted
 */
export async function completeLessonAndUpdateState(
  studentId: string,
  results: QuestionResult[]
): Promise<LessonOutcome> {
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  // Load existing knowledge records to identify review words (already "known")
  const allRecords = await readKnowledgeRecords();
  const studentRecords = allRecords.filter((r) => r.studentId === studentId);
  const knowledgeMap = new Map<string, KnowledgeRecord>();
  for (const record of studentRecords) {
    knowledgeMap.set(record.wordId, record);
  }

  const now = new Date().toISOString();

  // Load dynamic settings for star awards
  const settings = await getAppSettings();

  // Classify answers and build knowledge updates (vocab questions only)
  const knowledgeUpdates: KnowledgeUpdate[] = [];
  // Count stars based on settings
  let starsEarned = 0;
  let correctCount = 0; // actual number of correct answers (for logging)

  for (const result of results) {
    // Count comprehension correct answers for stars
    if (result.question.kind === "comprehension") {
      if (result.isCorrect) {
        correctCount++;
        starsEarned += settings.starsPerCorrect;
      }
      continue;
    }

    // Vocab questions: update knowledge state AND count stars.
    // Classification is purely answer-based (time no longer matters):
    //   correct → "known", wrong/unanswered → "don't know".

    const vocabData = result.question.data;
    const existingRecord = knowledgeMap.get(vocabData.wordId);
    // Any word with an existing record is a review word (it has been
    // introduced before, whether it was known or not).
    const isReviewWord = !!existingRecord;
    let newState: KnowledgeState;

    if (result.isCorrect) {
      newState = "known";
      correctCount++;
      starsEarned += settings.starsPerCorrect;
    } else {
      newState = "don't know";
    }

    const update: KnowledgeUpdate = {
      wordId: vocabData.wordId,
      // Extract level from wordId (format: "level:character") or fall back to existing record
      level: existingRecord?.level || (vocabData.wordId.includes(":") ? vocabData.wordId.split(":")[0] : student.currentLevel),
      newState,
    };

    // Compound context (Option A — one compound per character, refreshed on use):
    //  - If this lesson tested the character inside a compound word, store that
    //    compound + meaning (overwriting any previous one).
    //  - If this lesson tested the bare character (no new compound), keep the
    //    previously stored compound so it's still used in future tests.
    // "Tested as a compound" = the displayed character is multi-character
    // (either a single list-char shown within a compound, e.g. 店 -> 糖果店, or a
    // multi-character word tested directly).
    const testedAsCompound = vocabData.character.length > 1;
    if (testedAsCompound) {
      // New compound shown this lesson → store/overwrite.
      update.compoundWord = vocabData.character;
      update.compoundMeaning = vocabData.correctMeaning;
    } else if (existingRecord?.compoundWord && existingRecord?.compoundMeaning) {
      // No new compound this lesson → preserve the previously stored one.
      // (Carried forward explicitly so the upsert never blanks it.)
      update.compoundWord = existingRecord.compoundWord;
      update.compoundMeaning = existingRecord.compoundMeaning;
    }

    // SRS scheduling. Every introduced word gets SRS fields so it flows through
    // the review pipeline. Correct answers advance the interval; wrong answers
    // reset to stage 1 so the word comes back soon and keeps being re-tested
    // until it is answered correctly.
    if (result.isCorrect) {
      const currentStage = isReviewWord ? (existingRecord.intervalStage ?? 0) : 0;
      const srsFields = advanceInterval(currentStage, now);
      update.intervalStage = srsFields.intervalStage;
      update.lastReviewedAt = srsFields.lastReviewedAt;
      update.nextDueDate = srsFields.nextDueDate;
    } else {
      const srsFields = resetInterval(now);
      update.intervalStage = srsFields.intervalStage;
      update.lastReviewedAt = srsFields.lastReviewedAt;
      update.nextDueDate = srsFields.nextDueDate;
    }

    knowledgeUpdates.push(update);
  }

  // Bulk update knowledge states
  await bulkUpdate(studentId, knowledgeUpdates);

  // Award performance stars based on dynamic settings
  const performanceStarsEarned = Math.floor(starsEarned);

  // On the first lesson of the day, also add the current streak count as a bonus
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const isFirstLessonToday = student.lastActiveDate !== today;
  const streakBonus = isFirstLessonToday ? Math.min(student.streakStars, MAX_STREAK_BONUS) : 0;
  const totalStarsToAdd = performanceStarsEarned + streakBonus;

  // Run all independent updates in parallel
  const [, streakStars] = await Promise.all([
    // Award stars + increment lessons in one update
    updateStudent(studentId, {
      performanceStars: student.performanceStars + totalStarsToAdd,
      lessonsCompleted: student.lessonsCompleted + 1,
    }),
    // Update streak (records active day)
    updateStreakStars(studentId),
  ]);

  // Log the star award (non-blocking — don't await, fire and forget)
  const logReason = streakBonus > 0
    ? `${correctCount} correct answers + ${streakBonus} streak bonus`
    : `${correctCount} correct answers`;
  appendStarLog({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    studentId,
    studentName: student.name,
    starType: "performanceStars",
    previousValue: student.performanceStars,
    newValue: student.performanceStars + totalStarsToAdd,
    delta: totalStarsToAdd,
    reason: logReason,
    source: "lesson",
  }).catch(() => {}); // don't block on logging

  // Record a per-lesson event for weekly counts (non-blocking, separate from
  // the day-granular lesson_activity_log used by the streak calendar).
  appendLessonEvent(studentId).catch(() => {});

  // Check for level advancement
  const advanceResult = await checkAndAdvanceLevel(studentId);

  return {
    knowledgeUpdates,
    performanceStarsEarned,
    streakBonus,
    streakStars,
    leveledUp: advanceResult.advanced,
    newLevel: advanceResult.newLevel,
    completionMessage: advanceResult.completionMessage,
  };
}
