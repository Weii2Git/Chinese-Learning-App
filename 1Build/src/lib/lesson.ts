import {
  LEVELS,
  NEW_WORDS_PER_LESSON,
  QUICK_THRESHOLD_MS,
  REVIEW_WORDS_PER_LESSON,
  REVIEW_WORDS_BUFFER,
} from "./constants";
import { readKnowledgeRecords, bulkUpdate } from "./knowledge";
import { getStudent, updateStudent, checkAndAdvanceLevel } from "./student";
import { updateStreakStars } from "./stars";
import { getWordsForLevel, getAllWords } from "./word-list";
import { prioritizeReviewWords, advanceInterval, resetInterval } from "./srs";
import { appendStarLog } from "@/app/api/admin/adjust-stars/route";
import { getAppSettings } from "@/app/api/admin/settings/route";
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

  // New words: only "don't know" (never introduced) — prioritize current level first
  // "learning" words go to the review pool instead
  const newWordCandidatesCurrentLevel = currentLevelWords.filter((w) => {
    const state = getState(w.id);
    return state === "don't know";
  });

  const newWordCandidatesEarlierLevels = earlierLevelWords.filter((w) => {
    const state = getState(w.id);
    return state === "don't know";
  });

  const allNewWordCandidates: Word[] = [
    ...newWordCandidatesCurrentLevel,
    ...newWordCandidatesEarlierLevels,
  ];

  let newWords: Word[] = allNewWordCandidates.slice(0, NEW_WORDS_PER_LESSON);

  // Review words: use SRS prioritization for "known" state words
  const knownRecords = studentRecords.filter((r) => r.state === "known");
  const now = new Date().toISOString();
  const prioritizedRecords = prioritizeReviewWords(knownRecords, now, REVIEW_WORDS_PER_LESSON + REVIEW_WORDS_BUFFER);

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

  // If fewer than 20 review words, fill remaining slots from current level
  if (reviewWords.length < REVIEW_WORDS_PER_LESSON + REVIEW_WORDS_BUFFER) {
    const selectedIds = new Set([
      ...newWords.map((w) => w.id),
      ...reviewWords.map((w) => w.id),
    ]);

    const fillCandidates = currentLevelWords.filter(
      (w) => !selectedIds.has(w.id)
    );

    const slotsToFill = (REVIEW_WORDS_PER_LESSON + REVIEW_WORDS_BUFFER) - reviewWords.length;
    const fillWords = fillCandidates.slice(0, slotsToFill);
    reviewWords = [...reviewWords, ...fillWords];
  }

  // If total (new + review) is still less than 25, increase new words to fill the gap
  const totalTarget = NEW_WORDS_PER_LESSON + REVIEW_WORDS_PER_LESSON + REVIEW_WORDS_BUFFER; // 25
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
        starsEarned += result.elapsedMs <= QUICK_THRESHOLD_MS
          ? settings.starsPerCorrectFast
          : settings.starsPerCorrectSlow;
      }
      continue;
    }

    // Vocab questions: update knowledge state AND count stars

    const vocabData = result.question.data;
    const existingRecord = knowledgeMap.get(vocabData.wordId);
    const isReviewWord = existingRecord?.state === "known";
    let newState: KnowledgeState;

    if (result.isCorrect && result.elapsedMs <= QUICK_THRESHOLD_MS) {
      // Quick correct → "known"
      newState = "known";
      correctCount++;
      starsEarned += settings.starsPerCorrectFast;
    } else if (result.isCorrect && result.elapsedMs > QUICK_THRESHOLD_MS) {
      // Slow correct → "learning"
      newState = "learning";
      correctCount++;
      starsEarned += settings.starsPerCorrectSlow;
    } else {
      // Wrong (including timer expired) → "don't know"
      newState = "don't know";
    }

    const update: KnowledgeUpdate = {
      wordId: vocabData.wordId,
      // Extract level from wordId (format: "level:character") or fall back to existing record
      level: existingRecord?.level || (vocabData.wordId.includes(":") ? vocabData.wordId.split(":")[0] : student.currentLevel),
      newState,
    };

    // Save compound context when first learning a word (character ≠ compound means it was tested as a compound)
    const isNewlyLearned = !isReviewWord && (newState === "known" || newState === "learning");
    if (isNewlyLearned && vocabData.character !== vocabData.wordId.split(":").pop()) {
      // The question was tested as a compound word
      update.compoundWord = vocabData.character;
      update.compoundMeaning = vocabData.correctMeaning;
    } else if (isNewlyLearned && vocabData.character.length > 1) {
      // Multi-character word tested directly
      update.compoundWord = vocabData.character;
      update.compoundMeaning = vocabData.correctMeaning;
    }

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

  // Award performance stars based on dynamic settings
  const performanceStarsEarned = Math.floor(starsEarned);

  // On the first lesson of the day, also add the current streak count as a bonus
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const isFirstLessonToday = student.lastActiveDate !== today;
  const streakBonus = isFirstLessonToday ? Math.min(student.streakStars, 5) : 0;
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
