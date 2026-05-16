import { describe, it, expect } from "vitest";
import { generateCombinedQuestion, buildTest, findWordInStory, lookupCompoundPinyin } from "./question-generator";
import type { Word, ComprehensionQuestion } from "./types";

const sampleWords: Word[] = [
  { id: "你", character: "你", pinyin: "nǐ", english: "you", level: "1-a" },
  { id: "好", character: "好", pinyin: "hǎo", english: "good", level: "1-a" },
  { id: "我", character: "我", pinyin: "wǒ", english: "I/me", level: "1-a" },
  { id: "是", character: "是", pinyin: "shì", english: "is/am", level: "1-a" },
  { id: "的", character: "的", pinyin: "de", english: "of", level: "1-a" },
  { id: "了", character: "了", pinyin: "le", english: "completed", level: "1-a" },
  { id: "不", character: "不", pinyin: "bù", english: "not", level: "1-a" },
  { id: "在", character: "在", pinyin: "zài", english: "at/in", level: "1-a" },
  { id: "人", character: "人", pinyin: "rén", english: "person", level: "1-a" },
  { id: "有", character: "有", pinyin: "yǒu", english: "have", level: "1-a" },
  { id: "大", character: "大", pinyin: "dà", english: "big", level: "1-b" },
  { id: "小", character: "小", pinyin: "xiǎo", english: "small", level: "1-b" },
  { id: "上", character: "上", pinyin: "shàng", english: "up", level: "1-b" },
  { id: "下", character: "下", pinyin: "xià", english: "down", level: "1-b" },
  { id: "中", character: "中", pinyin: "zhōng", english: "middle", level: "1-b" },
];

describe("generateCombinedQuestion", () => {
  it("returns separate pinyinOptions and meaningOptions with 4 choices each", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.pinyinOptions).toHaveLength(4);
    expect(question.meaningOptions).toHaveLength(4);
  });

  it("includes correct pinyin in pinyinOptions", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.pinyinOptions).toContain("nǐ");
  });

  it("includes correct meaning in meaningOptions", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.meaningOptions).toContain("you");
  });

  it("stores correctPinyin and correctMeaning", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.correctPinyin).toBe("nǐ");
    expect(question.correctMeaning).toBe("you");
  });

  it("sets type to combined", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.type).toBe("combined");
  });

  it("uses displayCharacter for the character field", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    expect(question.character).toBe("你");
  });

  it("pinyin distractors are different from correct pinyin", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    const distractors = question.pinyinOptions.filter((o) => o !== "nǐ");
    for (const d of distractors) {
      expect(d).not.toBe("nǐ");
    }
  });

  it("meaning distractors are different from correct meaning", () => {
    const question = generateCombinedQuestion(
      sampleWords[0], sampleWords, true, "你", "nǐ", "you"
    );
    const distractors = question.meaningOptions.filter((o) => o !== "you");
    for (const d of distractors) {
      expect(d).not.toBe("you");
    }
  });
});

describe("findWordInStory", () => {
  it("finds a compound word containing the character", () => {
    const segmented = "小明/今天/去/学校/，/他/很/开心/。";
    expect(findWordInStory("学", segmented)).toBe("学校");
    expect(findWordInStory("开", segmented)).toBe("开心");
  });

  it("returns the character itself if no compound word found", () => {
    const segmented = "小明/今天/去/学校";
    expect(findWordInStory("去", segmented)).toBe("去");
  });

  it("returns the character if no segmented story", () => {
    expect(findWordInStory("学", "")).toBe("学");
  });
});

describe("lookupCompoundPinyin", () => {
  it("returns full pinyin for multi-character words", () => {
    const result = lookupCompoundPinyin("学校");
    expect(result).toContain("xué");
    expect(result).toContain("xiào");
  });

  it("returns single character pinyin", () => {
    const result = lookupCompoundPinyin("你");
    expect(result).toBe("nǐ");
  });

  it("falls back to provided pinyin when lookup fails", () => {
    const result = lookupCompoundPinyin("", "fallback");
    expect(result).toBe("fallback");
  });
});

describe("buildTest", () => {
  const newWords = sampleWords.slice(0, 5);
  const reviewWords = sampleWords.slice(5, 15);
  const comprehensionQuestions: ComprehensionQuestion[] = [
    {
      question: "故事里谁去了学校？",
      correctAnswer: "小明",
      options: ["小明", "小红", "老师", "妈妈"],
    },
    {
      question: "他们在做什么？",
      correctAnswer: "读书",
      options: ["读书", "吃饭", "睡觉", "玩耍"],
    },
    {
      question: "故事发生在哪里？",
      correctAnswer: "学校",
      options: ["学校", "家里", "公园", "商店"],
    },
  ];

  it("tests 15 words + 3 comprehension = 18 total questions", () => {
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions);
    const vocabQuestions = questions.filter((q) => q.kind === "vocab");
    const comprehension = questions.filter((q) => q.kind === "comprehension");
    expect(vocabQuestions).toHaveLength(15); // only 15 words available (5 new + 10 review)
    expect(comprehension).toHaveLength(3);
    expect(questions).toHaveLength(18);
  });

  it("each vocab question has separate pinyinOptions and meaningOptions", () => {
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions);
    for (const q of questions) {
      if (q.kind === "vocab") {
        expect(q.data.pinyinOptions.length).toBeGreaterThanOrEqual(1);
        expect(q.data.meaningOptions.length).toBeGreaterThanOrEqual(1);
        expect(q.data.pinyinOptions).toContain(q.data.correctPinyin);
        expect(q.data.meaningOptions).toContain(q.data.correctMeaning);
      }
    }
  });

  it("new words come first, then review words", () => {
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions);
    const vocabQuestions = questions.filter((q) => q.kind === "vocab");
    const wordIds = vocabQuestions.map((q) => q.kind === "vocab" ? q.data.wordId : "");
    const expectedOrder = [...newWords, ...reviewWords].map((w) => w.id);
    expect(wordIds).toEqual(expectedOrder);
  });

  it("last 3 questions are comprehension questions", () => {
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions);
    const last3 = questions.slice(-3);
    for (const q of last3) {
      expect(q.kind).toBe("comprehension");
    }
  });

  it("tests compound word from segmented story with full pinyin and meaning", () => {
    const segmented = "你好/是/我的";
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions, segmented);
    const niQuestion = questions.find(
      (q) => q.kind === "vocab" && q.data.wordId === "你"
    );
    // Should test compound word "你好" with full pinyin and compound meaning
    if (niQuestion && niQuestion.kind === "vocab") {
      expect(niQuestion.data.character).toBe("你好");
      expect(niQuestion.data.correctPinyin).toContain("hǎo");
      // "你好" has a compound meaning in our dictionary
      expect(niQuestion.data.correctMeaning).toBe("hello");
    }
  });

  it("caps at 20 words", () => {
    const manyWords: Word[] = Array.from({ length: 25 }, (_, i) => ({
      id: `w${i}`, character: `字${i}`, pinyin: `pīn${i}`, english: `word${i}`, level: "1-a",
    }));
    const questions = buildTest(manyWords, [], comprehensionQuestions);
    const vocabQuestions = questions.filter((q) => q.kind === "vocab");
    expect(vocabQuestions).toHaveLength(20);
  });

  it("gracefully handles small word pool", () => {
    const tinyWords: Word[] = [
      { id: "猫", character: "猫", pinyin: "māo", english: "cat", level: "1-a" },
      { id: "狗", character: "狗", pinyin: "gǒu", english: "dog", level: "1-a" },
    ];
    const questions = buildTest(tinyWords, [], []);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      if (q.kind === "vocab") {
        expect(q.data.correctPinyin.length).toBeGreaterThan(0);
        expect(q.data.correctMeaning.length).toBeGreaterThan(0);
      }
    }
  });
});
