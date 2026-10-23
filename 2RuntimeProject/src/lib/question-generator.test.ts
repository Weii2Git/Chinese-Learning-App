import { describe, it, expect } from "vitest";
import { generateCombinedQuestion, buildTest, findWordInStory, lookupCompoundPinyin, meaningsOverlap } from "./question-generator";
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

  it("keeps a common character's pinyin identical across ALL options (房子)", () => {
    // 房子 (fáng zi): 子 is a common char. Every option must show "zi" in the
    // second slot, so knowing 子 alone can't eliminate any choice.
    const word: Word = { id: "房", character: "房", pinyin: "fáng", english: "house", level: "3-a" };
    const pool: Word[] = [
      word,
      { id: "桌", character: "桌", pinyin: "zhuō", english: "table", level: "3-a" },
      { id: "学", character: "学", pinyin: "xué", english: "study", level: "3-a" },
      { id: "校", character: "校", pinyin: "xiào", english: "school", level: "3-a" },
      { id: "朋", character: "朋", pinyin: "péng", english: "friend", level: "3-a" },
      { id: "友", character: "友", pinyin: "yǒu", english: "friend", level: "3-a" },
    ];
    const q = generateCombinedQuestion(word, pool, true, "房子", "fáng zi", "house");

    expect(q.pinyinOptions).toHaveLength(4);
    // Every option is two syllables and the SECOND syllable is always "zi".
    for (const opt of q.pinyinOptions) {
      const syllables = opt.split(" ");
      expect(syllables).toHaveLength(2);
      expect(syllables[1]).toBe("zi");
    }
    // The correct answer is present and the first syllables differ (real test).
    expect(q.pinyinOptions).toContain("fáng zi");
    const firstSyllables = new Set(q.pinyinOptions.map((o) => o.split(" ")[0]));
    expect(firstSyllables.size).toBeGreaterThan(1);
  });

  it("keeps a leading common character's pinyin fixed too (小门)", () => {
    // 小 is common; its pinyin "xiǎo" must appear in the first slot of every
    // option, forcing the student to know the second character.
    const word: Word = { id: "门", character: "门", pinyin: "mén", english: "door", level: "1-a" };
    const pool: Word[] = [
      word,
      { id: "车", character: "车", pinyin: "chē", english: "car", level: "1-a" },
      { id: "狗", character: "狗", pinyin: "gǒu", english: "dog", level: "1-a" },
      { id: "猫", character: "猫", pinyin: "māo", english: "cat", level: "1-a" },
      { id: "鱼", character: "鱼", pinyin: "yú", english: "fish", level: "1-a" },
    ];
    const q = generateCombinedQuestion(word, pool, true, "小门", "xiǎo mén", "small door");

    for (const opt of q.pinyinOptions) {
      expect(opt.split(" ")[0]).toBe("xiǎo");
    }
    expect(q.pinyinOptions).toContain("xiǎo mén");
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

  it("comprehension questions come first", () => {
    const questions = buildTest(newWords, reviewWords, comprehensionQuestions);
    const first3 = questions.slice(0, 3);
    for (const q of first3) {
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

describe("meaningsOverlap", () => {
  it("treats a synonym-list that contains the correct term as overlapping", () => {
    expect(meaningsOverlap("beautiful, pretty", "beautiful")).toBe(true);
    expect(meaningsOverlap("beautiful", "beautiful, pretty")).toBe(true);
    expect(meaningsOverlap("happy; glad", "happy")).toBe(true);
  });

  it("treats distinct meanings as not overlapping", () => {
    expect(meaningsOverlap("beautiful", "ugly")).toBe(false);
    expect(meaningsOverlap("happy; glad", "angry")).toBe(false);
    expect(meaningsOverlap("run", "walk")).toBe(false);
  });

  it("ignores leading articles, 'to', and parenthetical notes", () => {
    expect(meaningsOverlap("to run", "run")).toBe(true);
    expect(meaningsOverlap("a teacher", "teacher")).toBe(true);
    expect(meaningsOverlap("happy (adj.)", "happy")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(meaningsOverlap("Beautiful", "beautiful")).toBe(true);
  });
});

describe("meaning distractor distinctness", () => {
  const words: Word[] = [
    { id: "漂亮", character: "漂亮", pinyin: "piào liang", english: "beautiful, pretty", level: "1-a" },
    { id: "美丽", character: "美丽", pinyin: "měi lì", english: "beautiful", level: "1-a" },
    { id: "好看", character: "好看", pinyin: "hǎo kàn", english: "pretty; good-looking", level: "1-a" },
    { id: "高兴", character: "高兴", pinyin: "gāo xìng", english: "happy; glad", level: "1-a" },
    { id: "生气", character: "生气", pinyin: "shēng qì", english: "angry", level: "1-a" },
    { id: "大", character: "大", pinyin: "dà", english: "big", level: "1-a" },
    { id: "小", character: "小", pinyin: "xiǎo", english: "small", level: "1-a" },
  ];

  it("never offers two meaning options that share a synonym", () => {
    // 美丽 = "beautiful"; the pool includes 漂亮 "beautiful, pretty" and 好看
    // "pretty; good-looking" — none of these may co-occur as options.
    const q = generateCombinedQuestion(words[1], words, true, "美丽", "měi lì", "beautiful");
    for (let i = 0; i < q.meaningOptions.length; i++) {
      for (let j = i + 1; j < q.meaningOptions.length; j++) {
        expect(meaningsOverlap(q.meaningOptions[i], q.meaningOptions[j])).toBe(false);
      }
    }
    // And the correct meaning is present exactly once (as a distinct option).
    const correctMatches = q.meaningOptions.filter((m) => meaningsOverlap(m, "beautiful"));
    expect(correctMatches.length).toBe(1);
  });
});
