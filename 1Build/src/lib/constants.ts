export const QUESTION_TIMER_MS = 15000; // 15 seconds per question
// Default normal test size when the admin setting isn't available.
export const VOCAB_QUESTIONS_COUNT = 20;
export const COMPREHENSION_QUESTIONS_COUNT = 5;
// New words introduced per lesson (always tested). Review words tested =
// vocabQuestionsCount - NEW_WORDS_PER_LESSON.
export const NEW_WORDS_PER_LESSON = 5;
// Legacy constant kept for backward compatibility / tests. The actual review
// count is now derived from the admin vocabQuestionsCount at runtime.
export const REVIEW_WORDS_PER_LESSON = 15;
// Extra review words added to the ARTICLE/prompt only (not the test count), so
// enough review words land in the story to hit the test target even if the AI
// can't weave them all in.
export const REVIEW_WORDS_BUFFER = 5;
// When a student has a review backlog, the test may grow beyond the normal size
// by up to this many extra review questions...
export const REVIEW_BACKLOG_BOOST = 10;
// ...but the total vocab test is never larger than this.
export const MAX_VOCAB_QUESTIONS = 30;
export const MAX_STREAK_BONUS = 10; // streak bonus stars are capped at this (the raw streak count itself is uncapped)
export const LEVEL_ADVANCE_THRESHOLD = 0.9; // 90%
// Validation window — a story is accepted if its Chinese-char count is in here.
export const STORY_MIN_CHARS = 300;
export const STORY_MAX_CHARS = 550;
// Prompt target — kept tight and centered inside the validation window so that
// even when the model drifts by ±100 chars, it still lands within 300-550.
export const STORY_PROMPT_MIN_CHARS = 400;
export const STORY_PROMPT_MAX_CHARS = 450;

export const LEVELS = [
  "1-a",
  "1-b",
  "2-a",
  "2-b",
  "3-a",
  "3-b",
  "4-a",
  "4-b",
  "5-a",
  "5-b",
  "6-a",
  "6-b",
];

// SRS (Spaced Repetition System) interval durations in milliseconds for each stage
export const SRS_INTERVALS_MS: Record<number, number> = {
  1: 1 * 24 * 60 * 60 * 1000,   // 1 day
  2: 3 * 24 * 60 * 60 * 1000,   // 3 days
  3: 7 * 24 * 60 * 60 * 1000,   // 7 days
  4: 30 * 24 * 60 * 60 * 1000,  // 30 days
  5: 90 * 24 * 60 * 60 * 1000,  // 90 days
  6: 120 * 24 * 60 * 60 * 1000, // 120 days
  7: 180 * 24 * 60 * 60 * 1000, // 180 days
  8: 270 * 24 * 60 * 60 * 1000, // 270 days
};

export const SRS_INITIAL_STAGE = 1;
// Highest active review stage. A correct answer at this stage retires the word.
export const SRS_MAX_STAGE = 8;
// Sentinel stage for a "mastered / retired" word: never selected for review again.
export const SRS_RETIRED_STAGE = 9;

export const DATA_DIR = "data";
export const ENRICHED_WORDS_CACHE_FILE = "data/enriched-words.json";
export const STUDENTS_FILE = "data/students.json";
export const KNOWLEDGE_FILE = "data/knowledge.json";
export const WORD_LIST_FILE = "Characters list.txt";
