import type {
  Word,
  VocabQuestion,
  ComprehensionQuestion,
  Question,
} from "./types";
import { pinyin } from "pinyin-pro";
import { lookupCompoundMeaning, COMPOUND_WORD_MAP } from "./compound-words";

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Look up the full pinyin for a compound word.
 * Uses pinyin-pro to generate pinyin for multi-character strings.
 * Falls back to the provided fallback if pinyin-pro returns empty.
 */
export function lookupCompoundPinyin(compoundWord: string, fallbackPinyin?: string): string {
  try {
    const result = pinyin(compoundWord, { toneType: "symbol", type: "string" });
    if (result && result.trim().length > 0) {
      return result;
    }
  } catch {
    // pinyin-pro failed, use fallback
  }
  return fallbackPinyin ?? "";
}

/**
 * Find the first 2-character compound word from the segmented story that contains a given character.
 * Prefers 2-character words. Falls back to the character itself if none found.
 */
export function findWordInStory(character: string, segmentedStory: string): string {
  if (!segmentedStory) return character;

  const segments = segmentedStory.split("/").filter((s) => s.length > 0);
  const isChineseOnly = (s: string) => /^[\u4e00-\u9fff]+$/.test(s);

  // Return the first 2-character segment containing this character
  const twoCharMatch = segments.find(
    (s) => s.length === 2 && s.includes(character) && isChineseOnly(s)
  );
  if (twoCharMatch) return twoCharMatch;

  // Fall back to any multi-character segment (first occurrence)
  const anyMatch = segments.find(
    (s) => s.length > 1 && s.includes(character) && isChineseOnly(s)
  );
  return anyMatch ?? character;
}

/**
 * Generate a combined vocab question with separate pinyin and meaning option sets.
 * The student must select the correct pinyin AND the correct meaning.
 */
export function generateCombinedQuestion(
  word: Word,
  allWords: Word[],
  isNewWord: boolean,
  displayCharacter: string,
  correctPinyin: string,
  correctMeaning: string,
  usedMeanings?: Set<string>,
  segmentedStory?: string
): VocabQuestion {
  const charCount = displayCharacter.length;

  // --- PINYIN DISTRACTORS ---
  // Rules:
  // 1. All options must have the same number of syllables as the character count
  // 2. If word has repeated characters (e.g. 慢慢), distractors must follow same pattern (X X)
  // 3. Common characters (一,子,不,的,儿,小,大,人,了,是,在,有) keep their pinyin fixed;
  //    only vary the non-common characters

  const COMMON_CHARS = new Set("一子不的儿小大人了是在有我你他她们这那".split(""));

  // Split the correct pinyin into syllables
  const correctSyllables = correctPinyin.split(" ");

  // Detect repeated character pattern (e.g. 慢慢 → [慢, 慢])
  const chars = [...displayCharacter];
  const hasRepeatedPattern = chars.length > 1 && chars.every((c) => c === chars[0]);

  // Identify which positions have common characters (their pinyin stays fixed)
  const fixedPositions: Map<number, string> = new Map();
  for (let i = 0; i < chars.length; i++) {
    if (COMMON_CHARS.has(chars[i]) && correctSyllables[i]) {
      fixedPositions.set(i, correctSyllables[i]);
    }
  }

  // Get a pool of single-character pinyins for substitution
  const singlePinyinPool = allWords
    .filter((w) => w.id !== word.id && w.pinyin && w.pinyin.length > 0)
    .map((w) => w.pinyin)
    .filter((p) => !p.includes(" ")); // only single-syllable pinyins
  const uniqueSinglePool = [...new Set(singlePinyinPool)];

  let pinyinPool: string[] = [];

  if (charCount === 1) {
    // Single character: just use other single-char pinyins
    pinyinPool = uniqueSinglePool.filter((p) => p !== correctPinyin);
  } else if (hasRepeatedPattern) {
    // Repeated pattern (e.g. 慢慢): distractors must be "X X" format
    for (const p of shuffle([...uniqueSinglePool])) {
      if (p === correctSyllables[0]) continue;
      const repeated = Array(charCount).fill(p).join(" ");
      if (repeated !== correctPinyin && !pinyinPool.includes(repeated)) {
        pinyinPool.push(repeated);
      }
      if (pinyinPool.length >= 6) break;
    }
  } else {
    // Multi-character word: keep common char positions fixed, vary others
    // First try real compound words from story/dictionary
    if (segmentedStory) {
      const isChineseOnly = (s: string) => /^[\u4e00-\u9fff]+$/.test(s);
      const segments = segmentedStory.split("/").filter(
        (s) => s.length === charCount && s !== displayCharacter && isChineseOnly(s)
      );
      for (const seg of segments) {
        const segPinyin = lookupCompoundPinyin(seg);
        if (segPinyin && segPinyin !== correctPinyin && !pinyinPool.includes(segPinyin)) {
          // Check syllable count matches
          if (segPinyin.split(" ").length === charCount) {
            pinyinPool.push(segPinyin);
          }
        }
      }
    }

    for (const compoundWord of Object.keys(COMPOUND_WORD_MAP)) {
      if (compoundWord.length === charCount && compoundWord !== displayCharacter) {
        const compPinyin = lookupCompoundPinyin(compoundWord);
        if (compPinyin && compPinyin !== correctPinyin && !pinyinPool.includes(compPinyin)) {
          if (compPinyin.split(" ").length === charCount) {
            pinyinPool.push(compPinyin);
          }
        }
        if (pinyinPool.length >= 10) break;
      }
    }

    // If we have fixed positions (common chars), generate distractors that keep those fixed
    if (fixedPositions.size > 0 && pinyinPool.length < 6) {
      const shuffledPool = shuffle([...uniqueSinglePool]);
      for (const p of shuffledPool) {
        if (pinyinPool.length >= 6) break;
        // Build a distractor by keeping fixed positions and substituting one non-fixed position
        const distractor = [...correctSyllables];
        // Find a non-fixed position to substitute
        for (let i = 0; i < charCount; i++) {
          if (!fixedPositions.has(i) && p !== correctSyllables[i]) {
            distractor[i] = p;
            break;
          }
        }
        const distractorStr = distractor.join(" ");
        if (distractorStr !== correctPinyin && !pinyinPool.includes(distractorStr)) {
          pinyinPool.push(distractorStr);
        }
      }
    }
  }

  const uniquePinyinPool = [...new Set(pinyinPool)];
  let pinyinDistractors = shuffle([...uniquePinyinPool]).slice(0, 3);

  // Ensure we always have exactly 3 distractors (4 options total)
  // If pool is too small, pad with pinyin from allWords (even if single char)
  if (pinyinDistractors.length < 3) {
    const fallbackPinyins = allWords
      .filter((w) => w.id !== word.id)
      .map((w) => w.pinyin)
      .filter((p) => p && p.length > 0 && p !== correctPinyin && !pinyinDistractors.includes(p));
    const uniqueFallback = [...new Set(fallbackPinyins)];
    pinyinDistractors = [...pinyinDistractors, ...shuffle(uniqueFallback).slice(0, 3 - pinyinDistractors.length)];
  }

  const pinyinOptions = shuffle([correctPinyin, ...pinyinDistractors]);

  // --- MEANING DISTRACTORS ---
  // Don't recycle meanings from other words in this test (use usedMeanings set)
  let meaningPool = allWords
    .filter((w) => w.id !== word.id)
    .map((w) => w.english)
    .filter((e) => e && e.trim().length > 0 && e !== correctMeaning);

  // Also add meanings from compound dictionary for variety
  const compoundMeanings = Object.values(COMPOUND_WORD_MAP) as string[];
  for (const m of compoundMeanings) {
    if (m !== correctMeaning && !meaningPool.includes(m)) {
      meaningPool.push(m);
    }
  }

  // Filter out meanings already used in other questions
  if (usedMeanings) {
    meaningPool = meaningPool.filter((m) => !usedMeanings.has(m));
  }

  const uniqueMeaningPool = [...new Set(meaningPool)];
  let meaningDistractors = shuffle([...uniqueMeaningPool]).slice(0, 3);

  // Ensure we always have exactly 3 distractors (4 options total)
  if (meaningDistractors.length < 3) {
    const fallbackMeanings = Object.values(COMPOUND_WORD_MAP) as string[];
    const extraMeanings = fallbackMeanings.filter(
      (m) => m !== correctMeaning && !meaningDistractors.includes(m)
    );
    meaningDistractors = [...meaningDistractors, ...shuffle(extraMeanings).slice(0, 3 - meaningDistractors.length)];
  }

  const meaningOptions = shuffle([correctMeaning, ...meaningDistractors]);

  // Track used correct meanings only (not distractors) to avoid the correct answer
  // appearing as a distractor in a later question
  if (usedMeanings) {
    usedMeanings.add(correctMeaning);
  }

  return {
    type: "combined",
    wordId: word.id,
    character: displayCharacter,
    correctAnswer: `${correctPinyin}|${correctMeaning}`,
    correctPinyin,
    correctMeaning,
    pinyinOptions,
    meaningOptions,
    options: pinyinOptions, // for compatibility with Question type
    isNewWord,
  };
}

/**
 * Build a complete test:
 * - Tests 20 words/characters from the article
 * - Priority: looked-up words > new words > review words
 * - Each word gets 1 question testing both pinyin AND meaning (two separate selections)
 * - No repeated questions (each word tested once)
 * - 3 comprehension questions at the end
 *
 * Total: 20 vocab questions + 3 comprehension = 23 questions
 */
export function buildTest(
  newWords: Word[],
  reviewWords: Word[],
  comprehensionQuestions: ComprehensionQuestion[],
  segmentedStory?: string,
  wordMeanings?: Record<string, string>,
  lookedUpWords?: string[]
): Question[] {
  const allWords = [...newWords, ...reviewWords];

  // Select up to 15 words to test
  // Priority: words the user looked up > new words > review words
  const wordsToTest: { word: Word; isNew: boolean }[] = [];
  const targetWordCount = 20;
  const addedIds = new Set<string>();

  // First: add looked-up words (these are words the user clicked during reading)
  // Create Word objects on the fly for words not in the pre-selected pool
  if (lookedUpWords && lookedUpWords.length > 0) {
    for (const lookupText of lookedUpWords) {
      if (wordsToTest.length >= targetWordCount) break;
      // Try to find the word in allWords first
      const matchedWord = allWords.find((w) => w.character === lookupText || lookupText.includes(w.character));
      if (matchedWord && !addedIds.has(matchedWord.id)) {
        addedIds.add(matchedWord.id);
        wordsToTest.push({ word: matchedWord, isNew: true });
      } else if (!matchedWord) {
        // Create a Word object on the fly for this looked-up word
        const lookupId = `lookup:${lookupText}`;
        if (!addedIds.has(lookupId)) {
          const lookupPinyin = lookupCompoundPinyin(lookupText);
          const lookupMeaning = (wordMeanings?.[lookupText] || "").replace(/\s*\(.*?\)\s*/g, "").trim();
          if (lookupPinyin && lookupMeaning) {
            addedIds.add(lookupId);
            const lookupWord: Word = {
              id: lookupId,
              character: lookupText,
              pinyin: lookupPinyin,
              english: lookupMeaning,
              level: newWords[0]?.level || reviewWords[0]?.level || "1-a",
            };
            allWords.push(lookupWord); // Add to pool for distractor generation
            wordsToTest.push({ word: lookupWord, isNew: true });
          }
        }
      }
    }
  }

  // Second: add new words
  for (const word of newWords) {
    if (wordsToTest.length >= targetWordCount) break;
    if (!addedIds.has(word.id)) {
      addedIds.add(word.id);
      wordsToTest.push({ word, isNew: true });
    }
  }

  // Third: fill with review words
  for (const word of reviewWords) {
    if (wordsToTest.length >= targetWordCount) break;
    if (!addedIds.has(word.id)) {
      addedIds.add(word.id);
      wordsToTest.push({ word, isNew: false });
    }
  }

  // Generate one combined question per word
  const vocabQuestions: Question[] = [];
  const usedMeanings = new Set<string>();
  const usedDisplayChars = new Set<string>(); // prevent duplicate compound questions

  for (const { word, isNew } of wordsToTest) {
    const displayChar = segmentedStory
      ? findWordInStory(word.character, segmentedStory)
      : word.character;

    // Skip if we already generated a question for this display character
    if (usedDisplayChars.has(displayChar)) continue;
    usedDisplayChars.add(displayChar);

    // If compound word found in story, check if we have its meaning
    const isCompound = displayChar.length > 1;
    let testChar: string;
    let testPinyin: string;
    let testMeaning: string;

    if (isCompound) {
      // Always test the compound word from the story
      testChar = displayChar;
      testPinyin = lookupCompoundPinyin(displayChar, word.pinyin);
      // Check word meanings from Gemini first, then our dictionary, then character meaning
      const geminiMeaning = wordMeanings?.[displayChar];
      const dictMeaning = lookupCompoundMeaning(displayChar);
      const rawMeaning = geminiMeaning || dictMeaning || word.english;
      // Strip any parenthetical annotations the AI may have added e.g. "(using new word '罩')"
      testMeaning = rawMeaning.replace(/\s*\(.*?\)\s*/g, "").trim();

      // If we still have no meaning, fall back to testing the single character
      if (!testMeaning) {
        testChar = word.character;
        testPinyin = word.pinyin;
        testMeaning = word.english;
      }
    } else {
      // Single character
      testChar = word.character;
      testPinyin = word.pinyin;
      testMeaning = word.english;
    }

    // Skip if we have no meaning (would produce an empty answer choice)
    if (!testMeaning || !testPinyin) continue;

    vocabQuestions.push({
      kind: "vocab" as const,
      data: generateCombinedQuestion(
        word, allWords, isNew, testChar, testPinyin, testMeaning,
        usedMeanings, segmentedStory
      ),
    });
  }

  const comprehensionWrapped: Question[] = comprehensionQuestions
    .slice(0, 3)
    .map((q) => ({
      kind: "comprehension" as const,
      data: q,
    }));

  return [...vocabQuestions, ...comprehensionWrapped];
}
