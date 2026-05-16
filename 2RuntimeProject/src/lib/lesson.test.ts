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
  awardPerformanceStars: vi.fn(),
}));

vi.mock("./word-list", () => ({
  getWordsForLevel: vi.fn(),
  getAllWords: vi.fn(),
}));

import { readKnowledgeRecords, bulkUpdate } from "./knowledge";
import { getStudent, updateStudent, checkAndAdvanceLevel } from "./student";
import { updateStreakStars, awardPerformanceStars } from "./stars";
import { getAllWords } from "./word-list";

const mockReadKnowledgeRecords = readKnowledgeRecords as ReturnType<typeof vi.fn>;
const mockBulkUpdate = bulkUpdate as ReturnType<typeof vi.fn>;
const mockGetStudent = getStudent as ReturnType<typeof vi.fn>;
const mockUpdateStudent = updateStudent as ReturnType<typeof vi.fn>;
const mockCheckAndAdvanceLevel = checkAndAdvanceLevel as ReturnType<typeof vi.fn>;
const mockUpdateStreakStars = updateStreakStars as ReturnType<typeof vi.fn>;
const mockAwardPerformanceStars = awardPerformanceStars as ReturnType<typeof vi.fn>;
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
    type: "pinyin",
    wordId,
    character: wordId,
    correctAnswer: "correct",
    options: ["correct", "a", "b", "c"],
    isNewWord: false,
  };
  return {
    question: { kind: "vocab", data: vocabData },
    selectedAnswer: isCorrect ? "correct" : "wrong",
    isCorrect,
    elapsedMs,
    isQuick: isCorrect && elapsedMs <= 8000,
  };
}

describe("selectWordsForLesson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects up to 5 new words and up to 10 review words", async () => {
    // 10 words at level 1-a: 5 known, 5 don't know
    const words: Word[] = [];
    for (let i = 0; i < 10; i++) {
      words.push(makeWord(`w${i}`, "1-a"));
    }
    mockGetAllWords.mockResolvedValue(words);

    const knowledgeRecords: KnowledgeRecord[] = [];
    // First 5 are "known"
    for (let i = 0; i < 5; i++) {
      knowledgeRecords.push({
        studentId: "s1",
        wordId: `w${i}`,
        level: "1-a",
        state: "known",
        lastUpdated: new Date().toISOString(),
      });
    }
    // Remaining 5 have no record (default "don't know")
    mockReadKnowledgeRecords.mockResolvedValue(knowledgeRecords);

    const result = await selectWordsForLesson("s1", "1-a");

    expect(result.newWords.length).toBe(5);
    expect(result.reviewWords.length).toBe(5);
    // New words should be w5-w9 (don't know)
    expect(result.newWords.map((w) => w.id)).toEqual([
      "w5",
      "w6",
      "w7",
      "w8",
      "w9",
    ]);
    // Review words should be w0-w4 (known)
    expect(result.reviewWords.map((w) => w.id)).toEqual([
      "w0",
      "w1",
      "w2",
      "w3",
      "w4",
    ]);
  });

  it("fills remaining review slots from current level when fewer than 10 review words", async () => {
    // 15 words at level 1-a: 3 known, 5 don't know, 7 more available
    const words: Word[] = [];
    for (let i = 0; i < 15; i++) {
      words.push(makeWord(`w${i}`, "1-a"));
    }
    mockGetAllWords.mockResolvedValue(words);

    const knowledgeRecords: KnowledgeRecord[] = [
      { studentId: "s1", wordId: "w0", level: "1-a", state: "known", lastUpdated: "" },
      { studentId: "s1", wordId: "w1", level: "1-a", state: "known", lastUpdated: "" },
      { studentId: "s1", wordId: "w2", level: "1-a", state: "known", lastUpdated: "" },
    ];
    mockReadKnowledgeRecords.mockResolvedValue(knowledgeRecords);

    const result = await selectWordsForLesson("s1", "1-a");

    // 5 new words (from the "don't know" pool)
    expect(result.newWords.length).toBe(5);
    // 3 known + 7 fill from current level = 10
    expect(result.reviewWords.length).toBe(10);
    // First 3 should be the known words
    expect(result.reviewWords.slice(0, 3).map((w) => w.id)).toEqual([
      "w0",
      "w1",
      "w2",
    ]);
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
    performanceStars: 10,
    lastActiveDate: "2024-01-01",
    lessonsCompleted: 5,
  };

  it("classifies quick correct, slow correct, and wrong answers", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockAwardPerformanceStars.mockResolvedValue(11);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    mockReadKnowledgeRecords.mockResolvedValue([]);

    const results: QuestionResult[] = [
      makeVocabResult("w1", true, 5000),  // quick correct
      makeVocabResult("w2", true, 12000), // slow correct
      makeVocabResult("w3", false, 3000), // wrong
    ];

    const outcome = await completeLessonAndUpdateState("s1", results);

    expect(outcome.knowledgeUpdates).toHaveLength(3);
    expect(outcome.knowledgeUpdates[0].newState).toBe("known");
    expect(outcome.knowledgeUpdates[1].newState).toBe("learning");
    expect(outcome.knowledgeUpdates[2].newState).toBe("don't know");
    expect(outcome.performanceStarsEarned).toBe(1);
  });

  it("skips comprehension questions for knowledge updates", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockAwardPerformanceStars.mockResolvedValue(11);
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
        isQuick: true,
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
    mockAwardPerformanceStars.mockResolvedValue(10);
    mockUpdateStreakStars.mockResolvedValue(3);
    mockUpdateStudent.mockResolvedValue(mockStudent);
    mockCheckAndAdvanceLevel.mockResolvedValue({ advanced: false });

    await completeLessonAndUpdateState("s1", []);

    expect(mockUpdateStudent).toHaveBeenCalledWith("s1", {
      lessonsCompleted: 6,
    });
  });

  it("returns level advancement info when student levels up", async () => {
    mockGetStudent.mockResolvedValue(mockStudent);
    mockReadKnowledgeRecords.mockResolvedValue([]);
    mockBulkUpdate.mockResolvedValue(undefined);
    mockAwardPerformanceStars.mockResolvedValue(10);
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
    mockAwardPerformanceStars.mockResolvedValue(10);
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
});
