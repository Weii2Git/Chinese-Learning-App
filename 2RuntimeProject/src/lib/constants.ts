export const QUICK_THRESHOLD_MS = 10000; // 10 seconds
export const QUESTION_TIMER_MS = 15000; // 15 seconds per question
export const VOCAB_QUESTIONS_COUNT = 20;
export const COMPREHENSION_QUESTIONS_COUNT = 3;
export const NEW_WORDS_PER_LESSON = 5;
export const REVIEW_WORDS_PER_LESSON = 15;
export const MAX_STREAK_STARS = 5;
export const LEVEL_ADVANCE_THRESHOLD = 0.9; // 90%
export const STORY_MIN_CHARS = 300;
export const STORY_MAX_CHARS = 550;
export const STORY_PROMPT_MIN_CHARS = 350;
export const STORY_PROMPT_MAX_CHARS = 500;

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
};

export const SRS_MAX_STAGE = 5;
export const SRS_INITIAL_STAGE = 1;

export const DATA_DIR = "data";
export const ENRICHED_WORDS_CACHE_FILE = "data/enriched-words.json";
export const STUDENTS_FILE = "data/students.json";
export const KNOWLEDGE_FILE = "data/knowledge.json";
export const WORD_LIST_FILE = "Characters list.txt";
