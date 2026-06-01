import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  STORY_MIN_CHARS,
  STORY_MAX_CHARS,
  STORY_PROMPT_MIN_CHARS,
  STORY_PROMPT_MAX_CHARS,
  COMPREHENSION_QUESTIONS_COUNT,
} from "./constants";
import type { StoryParams, ComprehensionParams, ComprehensionQuestion } from "./types";

const MODEL = "gemini-2.5-flash";

// Generation config for speed optimization
const GENERATION_CONFIG = {
  thinkingConfig: { thinkingBudget: 0 },
  maxOutputTokens: 4096,
  temperature: 0.7,
};

/**
 * Read the API key saved via the admin page (data/gemini-key.json).
 */
function readSavedApiKey(): string | null {
  try {
    const keyFile = resolve(/* turbopackIgnore: true */ process.cwd(), "data/gemini-key.json");
    if (!existsSync(keyFile)) return null;
    const content = readFileSync(keyFile, "utf-8");
    const { apiKey } = JSON.parse(content);
    return typeof apiKey === "string" && apiKey.length > 0 ? apiKey : null;
  } catch {
    return null;
  }
}

function getClient(): GoogleGenAI {
  // Try env var first, then fall back to admin-saved key file
  const apiKey = process.env.GEMINI_API_KEY || readSavedApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key not found. Go to /admin to configure your API key."
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Count the number of Chinese characters in a string.
 * Chinese characters are in the CJK Unified Ideographs range.
 */
function countChineseChars(text: string): number {
  const matches = text.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

/**
 * Validates that a story meets the character count requirements
 * AND contains all required new words.
 */
function isValidStory(story: string, newWords?: Array<{ character: string }>): boolean {
  const charCount = countChineseChars(story);
  if (charCount < STORY_MIN_CHARS || charCount > STORY_MAX_CHARS) return false;
  // Check all new words appear in the story
  if (newWords) {
    for (const word of newWords) {
      if (!story.includes(word.character)) return false;
    }
  }
  return true;
}

/**
 * Determines if an error is a rate limiting (429) error.
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate limit") || msg.includes("resource exhausted");
  }
  return false;
}

/**
 * Determines if an error is a network timeout error.
 */
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnaborted");
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the prompt for story generation.
 */
function buildStoryPrompt(params: StoryParams): string {
  const newWordsStr = params.newWords
    .map((w) => `${w.character} (${w.pinyin} - ${w.english})`)
    .join(", ");
  const knownWordsStr = params.knownWords
    .map((w) => w.character)
    .join(", ");

  return `你是一位儿童中文阅读材料的作者。请根据以下要求生成一篇简体中文故事：

阅读难度等级：${params.level}

必须包含的新词汇（请在故事中自然地使用这些词）：
${newWordsStr}

学生已掌握的词汇（可以在故事中使用）：
${knownWordsStr}

要求：
1. 故事必须使用简体中文
2. 故事长度必须在${STORY_PROMPT_MIN_CHARS}到${STORY_PROMPT_MAX_CHARS}个汉字之间
3. 故事内容要适合儿童阅读并且有趣，新颖或搞笑
4. 所有新词汇必须在故事中完整出现至少一次（例如：词汇是"恢复"，故事中必须出现"恢复"这两个字连在一起，不能只用其中一个字）
5. 故事的难度要符合等级 ${params.level} 的水平
6. 不要使用任何markdown格式（如**加粗**）
7. 不需要推理过程，直接输出JSON结果

请严格按照以下JSON格式输出，不要包含任何其他文字：
{
  "story": "故事纯文本（不含分词标记）",
  "segmented": "用/分隔每个词的故事文本，标点符号单独作为一个段。重要：多字词必须作为整体，不能拆开（例如：恢复/健康，不能写成恢/复/健康）。例如：小明/今天/去/学校/，/他/很/开心/。",
  "wordMeanings": {"多字词1": "English meaning", "多字词2": "English meaning"}
}

wordMeanings 必须包含 segmented 中所有两个字及以上的词语的英文翻译。`;
}

/**
 * Build the prompt for comprehension question generation.
 */
function buildComprehensionPrompt(params: ComprehensionParams): string {
  const previousQuestionsSection = params.previousQuestions?.length
    ? `\n以下问题已经问过，请不要重复：\n${params.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`
    : "";

  return `你是一位中文阅读理解出题专家。请根据以下故事生成${COMPREHENSION_QUESTIONS_COUNT + 2}道阅读理解选择题。

故事内容：
${params.story}

阅读难度等级：${params.level}
${previousQuestionsSection}
要求：
1. 每道题必须有4个选项
2. 只有一个正确答案
3. 问题和选项都使用简体中文
4. 问题要测试学生对故事内容的理解
5. 难度要符合等级 ${params.level} 的水平
6. 所有4个选项的长度必须相近（字数差异不超过3个字），避免正确答案明显比其他选项更长或更短

请严格按照以下JSON格式输出，不要包含任何其他文字：
[
  {
    "question": "问题文本",
    "correctAnswer": "正确答案",
    "options": ["选项A", "选项B", "选项C", "选项D"]
  }
]`;
}

/**
 * Parse the comprehension questions response from Gemini.
 */
function parseComprehensionResponse(text: string): ComprehensionQuestion[] {
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Response is not an array");
  }

  if (parsed.length < COMPREHENSION_QUESTIONS_COUNT) {
    throw new Error(
      `Expected at least ${COMPREHENSION_QUESTIONS_COUNT} questions, got ${parsed.length}`
    );
  }

  // Take the first N valid questions (we ask for N+1 to have a buffer)
  const questions: ComprehensionQuestion[] = [];
  for (const item of parsed) {
    if (questions.length >= COMPREHENSION_QUESTIONS_COUNT) break;
    const q = item as Record<string, unknown>;
    if (
      typeof q.question !== "string" ||
      typeof q.correctAnswer !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      !q.options.includes(q.correctAnswer)
    ) {
      continue; // skip invalid questions
    }
    questions.push({
      question: q.question,
      correctAnswer: q.correctAnswer,
      options: q.options as string[],
    });
  }

  if (questions.length < COMPREHENSION_QUESTIONS_COUNT) {
    throw new Error(
      `Only ${questions.length} valid questions out of ${parsed.length} returned`
    );
  }

  return questions;
}

export interface StoryResult {
  story: string;
  segmented: string;
  wordMeanings: Record<string, string>;
}

/**
 * Parse the JSON response from Gemini for story generation.
 * Tries multiple extraction strategies to handle malformed responses.
 */
function parseStoryResponse(text: string): StoryResult {
  let jsonStr = text.trim();

  // Strategy 1: extract from markdown code block
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    // Strategy 2: extract the outermost { ... } block
    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Strategy 3: try to salvage by extracting just the story and segmented fields
    // using regex, ignoring the potentially broken wordMeanings
    const storyMatch = text.match(/"story"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const segmentedMatch = text.match(/"segmented"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (storyMatch && segmentedMatch) {
      return {
        story: storyMatch[1].replace(/\\n/g, "\n").replace(/\\\"/g, '"').replace(/\*\*/g, ""),
        segmented: segmentedMatch[1].replace(/\\n/g, "\n").replace(/\\\"/g, '"').replace(/\*\*/g, ""),
        wordMeanings: {},
      };
    }
    throw new Error(`Failed to parse story JSON: ${jsonStr.slice(0, 200)}`);
  }

  if (typeof parsed.story !== "string" || typeof parsed.segmented !== "string") {
    throw new Error("Invalid story response format");
  }

  return {
    story: parsed.story.replace(/\*\*/g, "").replace(/\\n/g, "\n"),
    segmented: parsed.segmented.replace(/\*\*/g, "").replace(/\\n/g, "\n"),
    wordMeanings: parsed.wordMeanings && typeof parsed.wordMeanings === "object"
      ? parsed.wordMeanings as Record<string, string>
      : {},
  };
}

/**
 * Generate a reading exercise story using the Gemini API.
 *
 * Returns both the plain story text and a word-segmented version
 * (words separated by /) for proper highlighting.
 *
 * If validation fails, retries once automatically.
 */
export async function generateStory(params: StoryParams): Promise<StoryResult> {
  const client = getClient();
  const prompt = buildStoryPrompt(params);

  async function attemptGeneration(): Promise<StoryResult> {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: GENERATION_CONFIG,
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini API returned an empty response");
      }

      return parseStoryResponse(text);
    } catch (error: unknown) {
      if (isRateLimitError(error)) {
        await sleep(2000);
        const retryResponse = await client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: GENERATION_CONFIG,
        });
        const retryText = retryResponse.text;
        if (!retryText) {
          throw new Error("Gemini API returned an empty response after rate limit retry");
        }
        return parseStoryResponse(retryText);
      }

      if (isTimeoutError(error)) {
        throw new Error(
          "Gemini API request timed out. Please check your network connection and try again."
        );
      }

      throw error;
    }
  }

  // First attempt
  try {
    const result = await attemptGeneration();
    if (isValidStory(result.story, params.newWords)) {
      return result;
    }
  } catch {
    // Fall through to retry
  }

  // Auto-retry once
  const retryResult = await attemptGeneration();
  if (isValidStory(retryResult.story, params.newWords)) {
    return retryResult;
  }

  throw new Error(
    `Generated story does not meet requirements. ` +
    `Expected ${STORY_MIN_CHARS}-${STORY_MAX_CHARS} Chinese characters and all new words present. ` +
    `Please try again.`
  );
}

/**
 * Generate comprehension questions for a reading exercise story using the Gemini API.
 *
 * Generates 3 comprehension questions with 4 options each.
 * Accepts optional previousQuestions to avoid generating duplicate questions.
 *
 * If the response is malformed, retries once automatically.
 */
export async function generateComprehensionQuestions(
  params: ComprehensionParams
): Promise<ComprehensionQuestion[]> {
  const client = getClient();
  const prompt = buildComprehensionPrompt(params);

  async function attemptGeneration(): Promise<ComprehensionQuestion[]> {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: GENERATION_CONFIG,
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini API returned an empty response");
      }

      return parseComprehensionResponse(text);
    } catch (error: unknown) {
      if (isRateLimitError(error)) {
        // Exponential backoff: wait 2 seconds then retry
        await sleep(2000);
        const retryResponse = await client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: GENERATION_CONFIG,
        });
        const retryText = retryResponse.text;
        if (!retryText) {
          throw new Error("Gemini API returned an empty response after rate limit retry");
        }
        return parseComprehensionResponse(retryText);
      }

      if (isTimeoutError(error)) {
        throw new Error(
          "Gemini API request timed out. Please check your network connection and try again."
        );
      }

      throw error;
    }
  }

  // First attempt
  try {
    return await attemptGeneration();
  } catch (error: unknown) {
    // If it's a parse/validation error (malformed response), retry once
    if (
      error instanceof Error &&
      !isTimeoutError(error) &&
      !error.message.includes("GEMINI_API_KEY") &&
      !error.message.includes("rate limit")
    ) {
      try {
        return await attemptGeneration();
      } catch (retryError: unknown) {
        throw new Error(
          `Failed to generate valid comprehension questions after retry. ` +
          `${retryError instanceof Error ? retryError.message : "Unknown error"}`
        );
      }
    }
    throw error;
  }
}
