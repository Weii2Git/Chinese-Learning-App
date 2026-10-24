import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectWordsForLesson, completeLessonAndUpdateState } from "./lesson";
import type {
  Word,
  KnowledgeRecord,
  QuestionResult,
  VocabQuestion,
  Student,
} from "./types";

// Mock dependencies
vi.mock("./knowledge", () => ({
  readKnowledgeRecords: vi.fn(),
  bulkUpdate: vi.fn(),
}));

vi.mock("./student", () => ({
  getStudent: vi.fn(),
  updateStudent: vi.fn(),
  checkAndAdvanceLevel: vi.fn(),
}));

vi.mock("./stars", () => ({
  updateStreakStars: vi.fn(),
}));

vi.mock("./word-list", () => ({
  getWordsForLevel: vi.fn(),
  getAllWords: vi.fn(),
}));

import { readKnowledgeRecords, bulkUpdate } from "./knowledge";
import { getStudent, updateStudent, checkAndAdvanceLevel } from "./student";
import { updateStreakStars } from "./stars";
import { getAllWords } from "./word-list";

const mockReadKnowledgeRecords = readKnowledgeRecords as ReturnType<typeof vi.fn>;
const mockBulkUpdate = bulkUpdate as ReturnType<typeof vi.fn>;
const mockGetStudent = getStudent as ReturnType<typeof vi.fn>;
const mockUpdateStudent = updateStudent as ReturnType<typeof vi.fn>;
const mockCheckAndAdvanceLevel = checkAndAdvanceLevel as ReturnType<typeof vi.fn>;
const mockUpdateStreakStars = updateStreakStars as ReturnType<typeof vi.fn>;
const mockGetAllWords = getAllWords as ReturnType<typeof vi.fn>;

function makeWord(id: string, level: string): Word {
  return {
    id,
    character: id,
    pinyin: `pinyin-${id}`,
    english: `english-${id}`,
    level,
  };
}

function makeVocabResult(
  wordId: string,
  isCorrect: boolean,
  elapsedMs: number
): QuestionResult {
  const vocabData: VocabQuestion = {
    type: "combined",
    wordId,
    character: wordId,
    correctAnswer: "correct|correct",
    correctPinyin: "correct",
    correctMeaning: "correct",
    pinyinOptions: ["correct", "a", "b", "c"],
    meaningOptions: ["correct", "a", "b", "c"],
    options: ["correct", "a", "b", "c"],
    isNewWord: false,
  };
  return {
    question: { kind: "vocab", data: vocabData },
    selectedAnswer: isCorrect ? "correct" : "wrong",
    isCorrect,
    elapsedMs,
  };
}

describe("selectWordsForLesson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("introduces the next never-seen words and reviews already-introduced ones", async () => {
    // 10 words at level 1-a: w0-w4 already introduced (have records), w5-w9 never seen
    const words: Word[] = [];
    for (let i = 0; i < 10; i++) {
      words.push(makeWord(`w${i}`, "1-a"));
    }
    mockGetAllWords.mockResolvedValue(words);

    const knowledgeRecords: KnowledgeRecord[] = [];
    // First 5 have a record (introduced) — mix of known and don't know
    for (let i = 0; i < 5; i++) {
      knowledgeRecords.push({
        studentId: "s1",
        wordId: `w${i}`,
        level: "1-a",
        state: i < 3 ? "known" : "don't know",
        lastUpdated: new Date().toISOString(),
      });
    }
    // Remaining 5 (w5-w9) have NO record → never introduced
    mockReadKnowledgeRecords.mockResolvedValue(knowledgeRecords);

    const result = await selectWordsForLesson("s1", "1-a");

    // New words = next 5 never-introduced, in order: w5-w9
    expect(result.newWords.map((w) => w.id)).toEqual([
      "w5",
      "w6",
      "w7",
      "w8",
      "w9",
    ]);
    // Review words include the 5 already-introduced records (known OR don't know)
    expect(result.reviewWords.map((w) => w.id).slice(0, 5).sort()).toEqual([
      "w0",
      "w1",
      "w2",
      "w3",
      "w4",
    ]);
  });

  it("reviews only the due records and no longer pads with current-level words", async () => {
    // 25 words at level 1-a: 3 introduced (known, due — no SRS fields), rest new.
    const words: Word[] = [];
    for (let i = 0; i < 25; i++) {
      words.push(makeWord(`w${i}`, "1-a"));
    }
    mockGetAllWords.mockResolvedValue(words);

    // Records with no SRS fields are treated as due (backward-compat), so they
    // still appear as reviews; what must NOT happen is extra current-level
    // words being appended to pad the review list.
    const knowledgeRecords: KnowledgeRecord[] = [
      { studentId: "s1", wordId: "w0", level: "1-a", state: "known", lastUpdated: "" },
      { studentId: "s1", wordId: "w1", level: "1-a", state: "known", lastUpdated: "" },
      { studentId: "s1", wordId: "w2", level: "1-a", state: "known", lastUpdated: "" },
    ];
    mockReadKnowledgeRecords.mockResolvedValue(knowledgeRecords);

    const result = await selectWordsForLesson("s1", "1-a");

    // Review list is exactly the 3 due records — no current-level padding.
    expect(result.reviewWords.map((w) => w.id).sort()).toEqual(["w0", "w1", "w2"]);
    // The shortfall is filled by extra NEW words instead (never-introduced).
    expect(result.newWords.length).toBeGreaterThan(5);
    expect(result.newWords.every((w) => !["w0", "w1", "w2"].includes(w.id))).toBe(true);
  });

  it("excludes not-yet-due review words from selection", async () => {
    const words: Word[] = [];
    for (let i = 0; i < 25; i++) words.push(makeWord(`w${i}`, "1-a"));
    mockGetAllWords.mockResolvedValue(words);

    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const pastReview = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const knowledgeRecords: KnowledgeRecord[] = [
      // Due (next_due in the past) → should appear
      { studentId: "s1", wordId: "w0", level: "1-a", state: "known", lastUpdated: pastReview, intervalStage: 3, lastReviewedAt: pastReview, nextDueDate: pastDue },
      // Not due (next_due in the future) → should NOT appear
      { studentId: "s1", wordId: "w1", level: "1-a", state: "known", lastUpdated: pastReview, intervalStage: 3, lastReviewedAt: pastReview, nextDueDate: future },
    ];
    mockReadKnowledgeRecords.mockResolvedValue(knowledgeRecords);

    const result = await selectWordsForLesson("s1", "1-a");

    expect(result.reviewWords.map((w) => w.id)).toContain("w0");
    expect(result.reviewWords.map((w) => w.id)).not.toContain("w1");
  });

  it("prioritizes current level words over earlier level words for new words", async () => {
    const words: Word[] = [
      makeWord("earlier1", "1-a"),
      makeWord("earlier2", "1-a"),
      makeWord("current1", "1-b"),
      makeWord("current2", "1-b"),
      makeWord("current3", "1-b"),
    ];
    mockGetAllWords.mockResolvedValue(words);
    mockReadKnowledgeRecords.mockResolvedValue([]);

    const result = await selectWordsForLesson("s1", "1-b");

    // Current level words should come first
    expect(result.newWords[0].id).toBe("current1");
    expect(result.newWords[1].id).toBe("current2");
    expect(result.newWords[2].id).toBe("current3");
    expect(result.newWords[3].id).toBe("earlier1");
    expect(result.newWords[4].id).toBe("earlier2");
  });

  it("throws for invalid level", async () => {
    await expect(selectWordsForLesson("s1", "invalid")).rejects.toThrow(
      "Invalid level: invalid"
    );
  });

  it("returns fewer than 5 new words if not enough available (Req 4.11)", async () => {
    const words: Word[] = [
      makeWord("w1", "1-a"),
      makeWord("w2", "1-a"),
    ];
    mockGetAllWords.mockResolvedValue(words);
    mockReadKnowledgeRecords.mockResolvedValue([]);

    const result = await selectWordsForLesson("s1", "1-a");

    expect(result.newWords.length).toBe(2);
  });

  it("sets vocabTestTarget to the normal size (20) when there is no backlog", async () => {
    const words: Word[] = [];
    for (let i = 0; i < 40; i++) words.push(makeWord(`w${i}`, "1-a"));
    mockGetAllWords.mockResolvedValue(words);

    // A few introduced words, all NOT due (far-future due date) → no backlog.
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recs: KnowledgeRecord[] = [];
    for (let i = 0; i < 3; i++) {
      recs.push({ studentId: "s1", wordId: `w${i}`, level: "1-a", state: "known", lastUpdated: past, intervalStage: 2, lastReviewedAt: past, nextDueDate: future });
    }
    mockReadKnowledgeRecords.mockResolvedValue(recs);

    const result = await selectWordsForLesson("s1", "1-a");
    // Default admin vocabQuestionsCount is 20 in tests (no Supabase → DEFAULTS).
    expect(result.vocabTestTarget).toBe(20);
  });

  it("grows vocabTestTarget above 20 (capped at 30) when many review words are overdue", async () => {
    const words: Word[] = [];
    for (let i = 0; i < 60; i++) words.push(makeWord(`w${i}`, "1-a"));
    mockGetAllWords.mockResolvedValue(words);

    // 40 overdue review words (due in the past) → large backlog. Normal review
    // tested = 15; backlog boost adds up to 10 → review tested 25 → total 30.
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const recs: KnowledgeRecord[] = [];
    for (let i = 0; i < 40; i++) {
      recs.push({ studentId: "s1", wordId: `w${i}`, level: "1-a", state: "known", lastUpdated: past, intervalStage: 2, lastReviewedAt: past, nextDueDate: past });
    }
    mockReadKnowledgeRecords.mockResolvedValue(recs);

    const result = await selectWordsForLesson("s1", "1-a");
    expect(result.vocabTestTarget).toBe(30);
  });
});

describe("completeLessonAndUpdateState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStudent: Student = {
    id: "s1",
    name: "Test",
    currentLevel: "1-a",
    streakStars: 2,
    streakFreezes: 0,
    performanceStars: 10,
    lastActiveDate: "2024-01-01",
    lessonsCompleted: 5,
  };

  it("classifies correct answers as known and wrong answers as don't know (time ignored)", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    mockReadKnowledgeRecords.mockResolvedValue([]);

    const results: QuestionResult[] = [
      makeVocabResult("w1", true, 5000),  // fast correct → known
      makeVocabResult("w2", true, 12000), // slow correct → still known (time ignored)
      makeVocabResult("w3", false, 3000), // wrong → don't know
    ];

    const outcome = await completeLessonAndUpdateState("s1", results);

    expect(outcome.knowledgeUpdates).toHaveLength(3);
    expect(outcome.knowledgeUpdates[0].newState).toBe("known");
    expect(outcome.knowledgeUpdates[1].newState).toBe("known");
    expect(outcome.knowledgeUpdates[2].newState).toBe("don't know");
    // Two correct answers at the default single rate (1 star each)
    expect(outcome.performanceStarsEarned).toBe(2);
  });

  it("skips comprehension questions for knowledge updates", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    const results: QuestionResult[] = [
      makeVocabResult("w1", true, 5000),
      {
        question: {
          kind: "comprehension",
          data: {
            question: "What happened?",
            correctAnswer: "A",
            options: ["A", "B", "C", "D"],
          },
        },
        selectedAnswer: "A",
        isCorrect: true,
        elapsedMs: 3000,
      },
    ];

    const outcome = await completeLessonAndUpdateState("s1", results);

    // Only 1 knowledge update (vocab question), comprehension is skipped
    expect(outcome.knowledgeUpdates).toHaveLength(1);
    expect(outcome.knowledgeUpdates[0].wordId).toBe("w1");
  });

  it("increments lessonsCompleted", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    await completeLessonAndUpdateState("s1", []);

    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ lessonsCompleted: 6 })
    );
  });

  it("returns level advancement info when student levels up", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({
      advanced: true,
      newLevel: "1-b",
    });

    const outcome = await completeLessonAndUpdateState("s1", []);

    expect(outcome.leveledUp).toBe(true);
    expect(outcome.newLevel).toBe("1-b");
  });

  it("returns completion message when student finishes 6-b", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(5);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({
      advanced: false,
      completionMessage: "Congratulations! You have completed all levels of the Chinese learning program!",
    });

    const outcome = await completeLessonAndUpdateState("s1", []);

    expect(outcome.leveledUp).toBe(false);
    expect(outcome.completionMessage).toBe(
      "Congratulations! You have completed all levels of the Chinese learning program!"
    );
  });

  it("throws if student not found", async () => {
    mockGetStudent.mockResolvedValue(null);

    await expect(
      completeLessonAndUpdateState("nonexistent", [])
    ).rejects.toThrow("Student not found: nonexistent");
  });

  it("does NOT advance the SRS stage when a correct word is tested early (not yet due)", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    // Word reviewed just now, due far in the future (stage 4). Testing it again
    // now is "early" — the stage and due date must be held.
    const now = new Date();
    const futureDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const existing: KnowledgeRecord = {
      studentId: "s1",
      wordId: "3-a:萝",
      level: "3-a",
      state: "known",
      lastUpdated: now.toISOString(),
      intervalStage: 4,
      lastReviewedAt: now.toISOString(),
      nextDueDate: futureDue.toISOString(),
    };
    mockReadKnowledgeRecords.mockResolvedValue([existing]);

    const outcome = await completeLessonAndUpdateState("s1", [
      makeVocabResult("3-a:萝", true, 4000),
    ]);

    const update = outcome.knowledgeUpdates.find((u) => u.wordId === "3-a:萝");
    expect(update).toBeDefined();
    expect(update!.newState).toBe("known");
    // Stage stays at 4; due date unchanged so it returns on its original date.
    expect(update!.intervalStage).toBe(4);
    expect(update!.lastReviewedAt).toBe(existing.lastReviewedAt);
    expect(update!.nextDueDate).toBe(existing.nextDueDate);
  });

  it("holds a looked-up word's schedule when re-tested early the same day", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    // A lookup word tested earlier today, next due tomorrow (stage 2). A second
    // correct answer the same day must NOT advance it (the old inflation bug).
    const now = new Date();
    const dueTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const existing: KnowledgeRecord = {
      studentId: "s1",
      wordId: "lookup:赶紧",
      level: "lookup",
      state: "known",
      lastUpdated: now.toISOString(),
      intervalStage: 2,
      lastReviewedAt: now.toISOString(),
      nextDueDate: dueTomorrow.toISOString(),
    };
    mockReadKnowledgeRecords.mockResolvedValue([existing]);

    const outcome = await completeLessonAndUpdateState("s1", [
      makeVocabResult("lookup:赶紧", true, 4000),
    ]);

    const update = outcome.knowledgeUpdates.find((u) => u.wordId === "lookup:赶紧");
    expect(update).toBeDefined();
    expect(update!.intervalStage).toBe(2);
    expect(update!.nextDueDate).toBe(existing.nextDueDate);
  });

  it("DOES advance the SRS stage when the word was last reviewed on a previous day", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    // Word last reviewed well before today (stage 4) → a correct answer today
    // should advance it to stage 5.
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const existing: KnowledgeRecord = {
      studentId: "s1",
      wordId: "3-a:萝",
      level: "3-a",
      state: "known",
      lastUpdated: longAgo.toISOString(),
      intervalStage: 4,
      lastReviewedAt: longAgo.toISOString(),
      nextDueDate: longAgo.toISOString(),
    };
    mockReadKnowledgeRecords.mockResolvedValue([existing]);

    const outcome = await completeLessonAndUpdateState("s1", [
      makeVocabResult("3-a:萝", true, 4000),
    ]);

    const update = outcome.knowledgeUpdates.find((u) => u.wordId === "3-a:萝");
    expect(update).toBeDefined();
    expect(update!.intervalStage).toBe(5);
    expect(update!.lastReviewedAt).not.toBe(existing.lastReviewedAt);
  });

  it("advances a brand-new word to stage 1 (not 2) on the first correct answer", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    // No existing record → brand-new word. First correct answer must land on
    // stage 1, not skip to stage 2.
    mockReadKnowledgeRecords.mockResolvedValue([]);

    const outcome = await completeLessonAndUpdateState("s1", [
      makeVocabResult("4-a:律", true, 4000),
    ]);

    const update = outcome.knowledgeUpdates.find((u) => u.wordId === "4-a:律");
    expect(update).toBeDefined();
    expect(update!.newState).toBe("known");
    expect(update!.intervalStage).toBe(1);
  });
});
