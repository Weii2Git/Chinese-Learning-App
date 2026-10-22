import {
  STORY_MIN_CHARS,
  STORY_MAX_CHARS,
  STORY_PROMPT_MIN_CHARS,
  STORY_PROMPT_MAX_CHARS,
  COMPREHENSION_QUESTIONS_COUNT,
} from "./constants";
import { complete } from "./llm";
import type { StoryParams, ComprehensionParams, ComprehensionQuestion } from "./types";

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
 * Describe, in Chinese, exactly how a candidate story failed validation so the
 * next attempt can be corrected. Returns null when the story is valid.
 */
function describeStoryProblems(
  story: string,
  newWords?: Array<{ character: string }>
): string | null {
  const problems: string[] = [];
  const charCount = countChineseChars(story);
  if (charCount < STORY_MIN_CHARS) {
    problems.push(
      `上一次的故事太短了（只有${charCount}个汉字），必须写到${STORY_PROMPT_MIN_CHARS}到${STORY_PROMPT_MAX_CHARS}个汉字，请把故事写得更长更详细。`
    );
  } else if (charCount > STORY_MAX_CHARS) {
    problems.push(
      `上一次的故事太长了（有${charCount}个汉字），必须控制在${STORY_PROMPT_MIN_CHARS}到${STORY_PROMPT_MAX_CHARS}个汉字，请写得更简短。`
    );
  }
  if (newWords) {
    const missing = newWords.filter((w) => !story.includes(w.character)).map((w) => w.character);
    if (missing.length > 0) {
      problems.push(
        `上一次的故事漏掉了这些必须使用的新词：${missing.join("、")}。请确保每个新词都完整出现在故事里。`
      );
    }
  }
  return problems.length > 0 ? problems.join("\n") : null;
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
2. 【最重要】故事长度必须在${STORY_PROMPT_MIN_CHARS}到${STORY_PROMPT_MAX_CHARS}个汉字之间（不包括标点符号）。字数太少或太多都不行，请在写完后数一数汉字数量，确保落在这个范围内。
3. 【最重要】下列每一个新字/词都必须出现在故事里，一个都不能漏：${newWordsStr}。
4. 【最重要·用词自然】如果某个新词只是一个单字，而这个字在现代汉语里通常不能单独成词，就必须把它用在一个自然、常见的多字词语里，绝对不能让它单独当作一个词使用。例如：新字是"允"，必须写成"允许"，不能写成"它允我靠近"；新字是"扒"，可以写成"扒开"或"扒土"；新字是"抛"，可以写成"抛起"或"抛出"。总之要像母语者一样自然用词，只要这个字出现在故事里（哪怕是在多字词语中）就算满足要求。如果这个字本身就能单独成词（如"跑""好"），则可以自由使用。
5. 故事内容要适合儿童阅读并且有趣，新颖或搞笑
6. 新词汇只能按其真实含义使用，绝对不能把任何新词汇用作人物的名字或名字的一部分（这样会误导学生对词义的理解）
7. 人物名字只能使用学生已掌握的汉字，或下列常见名字：小明、小红、小丽、小华、东东、乐乐、妈妈、爸爸、老师。绝对不要用新词汇中的字来取名
8. 故事的难度要符合等级 ${params.level} 的水平
9. 不要使用任何markdown格式（如**加粗**）
10. 不需要推理过程，直接输出JSON结果

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

  // Ask for a couple extra to absorb any that fail validation.
  const wanted = params.count ?? COMPREHENSION_QUESTIONS_COUNT;
  const askFor = wanted + 2;

  return `你是一位中文阅读理解出题专家。请根据以下故事生成${askFor}道阅读理解选择题。

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
6. 所有4个选项的长度必须相近（字数差异不超过3个字），避免正确答案明显比其他选项更长或更短。有时候让错误选项比正确答案更长更详细。

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
function parseComprehensionResponse(
  text: string,
  limit: number
): ComprehensionQuestion[] {
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

  // Collect up to `limit` valid questions. Unlike before, we do NOT throw when
  // the model returns fewer than requested — the caller tops up the shortfall
  // with a follow-up request. Returning [] here just triggers a retry/top-up.
  const questions: ComprehensionQuestion[] = [];
  for (const item of parsed) {
    if (questions.length >= limit) break;
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
const STORY_MAX_ATTEMPTS = 6;

export async function generateStory(params: StoryParams): Promise<StoryResult> {
  const basePrompt = buildStoryPrompt(params);

  // Run one generation pass. `feedback` (when present) tells the model what was
  // wrong with the previous attempt so it can self-correct — this is far more
  // effective than re-sending the identical prompt.
  async function attemptGeneration(feedback: string | null): Promise<StoryResult> {
    const prompt = feedback
      ? `${basePrompt}\n\n重要：请修正上一次的问题：\n${feedback}`
      : basePrompt;
    try {
      const text = await complete(prompt, { json: true });
      return parseStoryResponse(text);
    } catch (error: unknown) {
      if (isRateLimitError(error)) {
        await sleep(2000);
        const retryText = await complete(prompt, { json: true });
        return parseStoryResponse(retryText);
      }

      if (isTimeoutError(error)) {
        throw new Error(
          "LLM request timed out. Please check your network connection and try again."
        );
      }

      throw error;
    }
  }

  // Loop up to STORY_MAX_ATTEMPTS, feeding back the specific validation failure
  // (too short/long, missing new words) into each subsequent attempt. Keep the
  // "closest" candidate so a late failure still yields the best story we saw.
  let feedback: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < STORY_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await attemptGeneration(feedback);
      const problems = describeStoryProblems(result.story, params.newWords);
      if (!problems) {
        return result;
      }
      feedback = problems; // guide the next attempt
    } catch (error) {
      lastError = error;
      // A hard error (bad API key, timeout) won't be fixed by retrying with
      // feedback — stop early and surface it.
      if (
        error instanceof Error &&
        (error.message.includes("API key") || error.message.includes("timed out"))
      ) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(
    `Generated story does not meet requirements after ${STORY_MAX_ATTEMPTS} attempts. ` +
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
  const target = params.count ?? COMPREHENSION_QUESTIONS_COUNT;

  // Generate for a specific request (prompt reflects params.count and any
  // previousQuestions to avoid), returning up to `limit` valid questions.
  async function attemptGeneration(
    reqParams: ComprehensionParams,
    limit: number
  ): Promise<ComprehensionQuestion[]> {
    const prompt = buildComprehensionPrompt(reqParams);
    try {
      // Comprehension prompt returns a JSON array; DeepSeek's json_object mode
      // requires an object, so leave JSON mode off here and rely on the parser
      // (which already strips code fences and tolerates surrounding text).
      const text = await complete(prompt);
      return parseComprehensionResponse(text, limit);
    } catch (error: unknown) {
      if (isRateLimitError(error)) {
        // Exponential backoff: wait 2 seconds then retry
        await sleep(2000);
        const retryText = await complete(prompt);
        return parseComprehensionResponse(retryText, limit);
      }

      if (isTimeoutError(error)) {
        throw new Error(
          "LLM request timed out. Please check your network connection and try again."
        );
      }

      throw error;
    }
  }

  // Run one generation pass with a single parse/validation retry.
  async function generateBatch(
    reqParams: ComprehensionParams,
    limit: number
  ): Promise<ComprehensionQuestion[]> {
    try {
      return await attemptGeneration(reqParams, limit);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        !isTimeoutError(error) &&
        !error.message.includes("API key") &&
        !error.message.includes("rate limit")
      ) {
        return await attemptGeneration(reqParams, limit);
      }
      throw error;
    }
  }

  // Collect questions, topping up if the model returns fewer than `target`.
  // Each top-up excludes questions we already have so they aren't repeated.
  const collected: ComprehensionQuestion[] = [];
  const askedTexts: string[] = [...(params.previousQuestions ?? [])];
  const MAX_ROUNDS = 3;

  for (let round = 0; round < MAX_ROUNDS && collected.length < target; round++) {
    const remaining = target - collected.length;
    const batch = await generateBatch(
      {
        story: params.story,
        level: params.level,
        previousQuestions: askedTexts,
        count: remaining,
      },
      remaining
    );

    for (const q of batch) {
      // Guard against the model ignoring the "don't repeat" instruction.
      if (collected.some((c) => c.question === q.question)) continue;
      collected.push(q);
      askedTexts.push(q.question);
      if (collected.length >= target) break;
    }

    // No progress this round — stop trying rather than loop pointlessly.
    if (batch.length === 0) break;
  }

  if (collected.length === 0) {
    throw new Error("Failed to generate any valid comprehension questions.");
  }

  return collected;
}

/**
 * Translate a list of Chinese compound words into short English meanings.
 *
 * Used as a targeted gap-fill when the story generator omitted a meaning for a
 * multi-character word that a vocab question will display. Returns a map of
 * word -> English meaning. Words the model fails to translate are simply absent
 * from the map (callers fall back to the single-character meaning).
 *
 * Makes a single batched call (with one rate-limit retry). Never throws for a
 * missing/garbled response — returns whatever could be parsed, so a translation
 * hiccup can't block building a test.
 */
export async function generateWordMeanings(
  words: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(words.map((w) => w.trim()).filter((w) => w.length > 0))];
  if (unique.length === 0) return {};

  const prompt = `你是一位中文到英文的翻译专家。请把下面每个中文词语翻译成简短的英文含义（每个不超过6个英文单词）。

词语：
${unique.map((w, i) => `${i + 1}. ${w}`).join("\n")}

请严格按照以下JSON格式输出，key是中文词语，value是英文含义，不要包含任何其他文字：
{
${unique.map((w) => `  "${w}": "English meaning"`).join(",\n")}
}`;

  async function attempt(): Promise<Record<string, string>> {
    const text = await complete(prompt, { json: true });
    if (!text) return {};
    return parseWordMeanings(text, unique);
  }

  try {
    return await attempt();
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      await sleep(2000);
      try {
        return await attempt();
      } catch {
        return {};
      }
    }
    if (isTimeoutError(error)) return {};
    // Any other failure: return empty so the caller falls back gracefully.
    return {};
  }
}

/**
 * Parse the JSON object returned by generateWordMeanings. Only keeps entries
 * whose key was actually requested and whose value is a non-empty string.
 */
function parseWordMeanings(
  text: string,
  requested: string[]
): Record<string, string> {
  let jsonStr = text.trim();
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonStr = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const requestedSet = new Set(requested);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!requestedSet.has(key)) continue;
    if (typeof value !== "string") continue;
    const meaning = value.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (meaning.length > 0) result[key] = meaning;
  }
  return result;
}
