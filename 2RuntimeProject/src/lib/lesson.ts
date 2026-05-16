import {
  LEVELS,
  NEW_WORDS_PER_LESSON,
  QUICK_THRESHOLD_MS,
  REVIEW_WORDS_PER_LESSON,
} from "./constants";
import { readKnowledgeRecords, bulkUpdate } from "./knowledge";
import { getStudent, updateStudent, checkAndAdvanceLevel } from "./student";
import { updateStreakStars, awardPerformanceStars } from "./stars";
import { getWordsForLevel, getAllWords } from "./word-list";
import { prioritizeReviewWords, advanceInterval, resetInterval } from "./srs";
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
 * Select words for a lesson: up to 5 new words and up to 10 review words.
 *
 * New words: words with knowledge state "learning" or "don't know" from the
 * student's current level and earlier levels (current level prioritized first).
 *
 * Review words: words with knowledge state "known".
 *
 * If fewer than 10 review words are available, fill remaining slots with
 * additional words from the current level that aren't already selected.
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

  // Build a map of wordId -> knowledge state
  const knowledgeMap = new Map<string, KnowledgeState>();
  for (const record of studentRecords) {
    knowledgeMap.set(record.wordId, record.state);
  }

  // Helper to get knowledge state (defaults to "don't know")
  function getState(wordId: string): KnowledgeState {
    return knowledgeMap.get(wordId) ?? "don't know";
  }

  // Separate words into new word candidates and review word candidates
  const currentLevelWords = relevantWords.filter((w) => w.level === level);
  const earlierLevelWords = relevantWords.filter((w) => w.level !== level);

  // New words: "learning" or "don't know" — prioritize current level first
  const newWordCandidatesCurrentLevel = currentLevelWords.filter((w) => {
    const state = getState(w.id);
    return state === "learning" || state === "don't know";
  });

  const newWordCandidatesEarlierLevels = earlierLevelWords.filter((w) => {
    const state = getState(w.id);
    return state === "learning" || state === "don't know";
  });

  const newWords: Word[] = [
    ...newWordCandidatesCurrentLevel,
    ...newWordCandidatesEarlierLevels,
  ].slice(0, NEW_WORDS_PER_LESSON);

  // Review words: use SRS prioritization for "known" state words
  const knownRecords = studentRecords.filter((r) => r.state === "known");
  const now = new Date().toISOString();
  const prioritizedRecords = prioritizeReviewWords(knownRecords, now, REVIEW_WORDS_PER_LESSON);

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

  // If fewer than 10 review words, fill remaining slots from current level
  // words that aren't already selected as new or review words
  if (reviewWords.length < REVIEW_WORDS_PER_LESSON) {
    const selectedIds = new Set([
      ...newWords.map((w) => w.id),
      ...reviewWords.map((w) => w.id),
    ]);

    const fillCandidates = currentLevelWords.filter(
      (w) => !selectedIds.has(w.id)
    );

    const slotsToFill = REVIEW_WORDS_PER_LESSON - reviewWords.length;
    const fillWords = fillCandidates.slice(0, slotsToFill);
    reviewWords = [...reviewWords, ...fillWords];
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

  // Classify answers and build knowledge updates (vocab questions only)
  const knowledgeUpdates: KnowledgeUpdate[] = [];
  // Count correct answers (1 star per correct answer)
  let correctCount = 0;

  for (const result of results) {
    // Only process vocab questions for knowledge state updates
    if (result.question.kind !== "vocab") {
      continue;
    }

    const vocabData = result.question.data;
    const existingRecord = knowledgeMap.get(vocabData.wordId);
    const isReviewWord = existingRecord?.state === "known";
    let newState: KnowledgeState;

    if (result.isCorrect && result.elapsedMs <= QUICK_THRESHOLD_MS) {
      // Quick correct → "known"
      newState = "known";
      correctCount++;
    } else if (result.isCorrect && result.elapsedMs > QUICK_THRESHOLD_MS) {
      // Slow correct → "learning"
      newState = "learning";
      correctCount++;
    } else {
      // Wrong (including timer expired) → "don't know"
      newState = "don't know";
    }

    const update: KnowledgeUpdate = {
      wordId: vocabData.wordId,
      level: "", // Will be filled from word data if available
      newState,
    };

    if (isReviewWord) {
      // This is a review word (already "known")
      if (result.isCorrect) {
        // Any correct answer on review word: advance interval
        const currentStage = existingRecord.intervalStage ?? 0;
        const srsFields = advanceInterval(currentStage, now);
        update.intervalStage = srsFields.intervalStage;
        update.lastReviewedAt = srsFields.lastReviewedAt;
        update.nextDueDate = srsFields.nextDueDate;
      } else {
        // Wrong answer on review word: reset interval to stage 1
        const srsFields = resetInterval(now);
        update.intervalStage = srsFields.intervalStage;
        update.lastReviewedAt = srsFields.lastReviewedAt;
        update.nextDueDate = srsFields.nextDueDate;
      }
    } else if (newState === "known" || newState === "learning") {
      // Word transitioning to "known" or "learning" for the first time: initialize SRS at stage 1
      const srsFields = advanceInterval(0, now);
      update.intervalStage = srsFields.intervalStage;
      update.lastReviewedAt = srsFields.lastReviewedAt;
      update.nextDueDate = srsFields.nextDueDate;
    }

    knowledgeUpdates.push(update);
  }

  // Bulk update knowledge states
  await bulkUpdate(studentId, knowledgeUpdates);

  // Award performance stars: 1 per correct vocab answer
  const performanceStarsEarned = correctCount;

  // On the first lesson of the day, also add the current streak count as a bonus
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const isFirstLessonToday = student.lastActiveDate !== today;
  const streakBonus = isFirstLessonToday ? student.streakStars : 0;

  await awardPerformanceStars(studentId, performanceStarsEarned + streakBonus);

  // Update streak stars (also records active day)
  const streakStars = await updateStreakStars(studentId);

  // Increment lessonsCompleted
  await updateStudent(studentId, {
    lessonsCompleted: student.lessonsCompleted + 1,
  });

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
