// Core data models for the Chinese Learning App

export interface Student {
  id: string;
  name: string;
  currentLevel: string;
  streakStars: number;       // current streak count (days)
  streakFreezes: number;     // available streak freezes
  performanceStars: number;  // cumulative (renamed "Bonus" in UI)
  lastActiveDate: string | null;
  lessonsCompleted: number;
}

export interface Word {
  id: string; // the character itself serves as unique key within a level
  character: string; // Simplified Chinese character(s)
  pinyin: string; // e.g. "nǐ"
  english: string; // e.g. "you"
  level: string; // e.g. "1-b"
}

export type KnowledgeState = "known" | "learning" | "don't know";

export interface KnowledgeRecord {
  studentId: string;
  wordId: string;
  level: string;
  state: KnowledgeState;
  lastUpdated: string; // ISO datetime

  // SRS fields (optional for backward compatibility)
  intervalStage?: number;      // 1-5, undefined means no SRS data yet
  lastReviewedAt?: string;     // ISO datetime of last review
  nextDueDate?: string;        // ISO datetime when next review is due
}

export interface VocabQuestion {
  type: "combined"; // combined pinyin + meaning question
  wordId: string;
  character: string;
  correctAnswer: string; // format: "pinyin|meaning" for result tracking
  correctPinyin: string;
  correctMeaning: string;
  pinyinOptions: string[]; // 4 pinyin choices
  meaningOptions: string[]; // 4 meaning choices
  options: string[]; // kept for compatibility (same as pinyinOptions)
  isNewWord: boolean;
}

export interface ComprehensionQuestion {
  question: string; // The question text in Simplified Chinese
  correctAnswer: string;
  options: string[]; // 4 options
}

export type Question =
  | { kind: "vocab"; data: VocabQuestion }
  | { kind: "comprehension"; data: ComprehensionQuestion };

export interface QuestionResult {
  question: Question;
  selectedAnswer: string | null; // null if timer expired
  isCorrect: boolean;
  elapsedMs: number;
  isQuick: boolean; // elapsedMs <= QUICK_THRESHOLD_MS
}

export interface LessonState {
  studentId: string;
  story: string;
  segmentedStory: string;
  wordMeanings: Record<string, string>;
  newWords: Word[];
  reviewWords: Word[];
  questions: Question[];
  results: QuestionResult[];
  comprehensionLoopCount: number;
  lookedUpWords: string[]; // words the user clicked/right-clicked during reading
}

export interface EnrichedWordCache {
  version: string; // hash of source file for cache invalidation
  generatedAt: string; // ISO datetime
  words: Word[];
}

export interface WordSelection {
  newWords: Word[];
  reviewWords: Word[];
}

export interface KnowledgeSummary {
  known: number;
  learning: number;
  dontKnow: number;
  total: number;
  knownPercentage: number;
}

export interface KnowledgeUpdate {
  wordId: string;
  level: string;
  newState: KnowledgeState;
  // Optional SRS fields for review updates
  intervalStage?: number;
  lastReviewedAt?: string;
  nextDueDate?: string;
}

export interface LessonOutcome {
  knowledgeUpdates: KnowledgeUpdate[];
  performanceStarsEarned: number;
  streakBonus: number;
  streakStars: number;
  leveledUp: boolean;
  newLevel?: string;
  completionMessage?: string;
}

export interface StudentWithStats extends Student {
  knowledgeSummary: KnowledgeSummary;
  currentLevelKnownPercentage: number;
}

export interface StoryParams {
  newWords: Word[];
  knownWords: Word[];
  level: string;
}

export interface ComprehensionParams {
  story: string;
  level: string;
  previousQuestions?: string[];
}

export interface ParsedLevel {
  level: string;
  characters: string[];
}

export interface ActivityLogEntry {
  id: string;
  studentId: string;
  activityDate: string; // YYYY-MM-DD
  activityType: "lesson" | "freeze_used" | "freeze_earned";
  notes?: string;
}
