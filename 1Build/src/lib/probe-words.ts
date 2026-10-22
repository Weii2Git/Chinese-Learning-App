import { pinyin } from "pinyin-pro";
import { lookupCompoundMeaning } from "./compound-words";
import { SRS_RETIRED_STAGE } from "./constants";
import type { Word } from "./types";

/** Full pinyin for a compound word via pinyin-pro; "" if unavailable. */
function compoundPinyin(word: string): string {
  try {
    const result = pinyin(word, { toneType: "symbol", type: "string" });
    return result && result.trim().length > 0 ? result : "";
  } catch {
    return "";
  }
}

/**
 * Incidental "probe" word selection.
 *
 * When a lesson doesn't have enough DUE review words + new words to reach the
 * target question count, we fill the remaining slots with compound words drawn
 * from the story the student just read. These are "probe" words: if the student
 * answers one correctly nothing is recorded; if they get it wrong, the word is
 * enrolled into the SRS cycle as "don't know".
 *
 * Selection rules (all must hold):
 *   - 2+ Chinese characters (compound only — no single chars, no punctuation)
 *   - not a high-frequency function/grammar word (stop-list below)
 *   - not a personal name (safe-name stop-list used by the story generator)
 *   - a usable English meaning is resolvable (article meanings or local dict)
 *   - not already slated to be tested this lesson
 *   - the student doesn't already know it at a high SRS stage (>= HIGH_STAGE)
 */

// Above this stage a word is considered well-known; don't probe it incidentally.
const HIGH_STAGE_THRESHOLD = 3;

// Probe-word id prefix. Mirrors the "lookup:" convention so these never collide
// with vocabulary ids ("level:char") and are easy to recognize in records.
export const PROBE_ID_PREFIX = "probe:";

/**
 * High-frequency function / grammar words and pronouns that carry little
 * vocabulary-learning value as a test item. Kept deliberately small and common.
 */
const FUNCTION_WORDS = new Set<string>([
  "什么", "怎么", "这个", "那个", "哪个", "这里", "那里", "哪里", "这样", "那样",
  "因为", "所以", "但是", "虽然", "如果", "可是", "而且", "还是", "或者", "然后",
  "已经", "非常", "一起", "一样", "一些", "一点", "有点", "多少", "没有", "不是",
  "可以", "应该", "可能", "也许", "大概", "一定", "必须", "需要", "开始", "结束",
  "我们", "你们", "他们", "她们", "它们", "自己", "大家", "别人", "什么样",
  "现在", "以前", "以后", "后来", "刚才", "马上", "立刻", "终于", "忽然", "突然",
]);

/**
 * Safe/common personal names the story generator is allowed to use. Probe
 * selection must skip these so a name never becomes a vocabulary test item.
 */
const NAME_WORDS = new Set<string>([
  "小明", "小红", "小丽", "小华", "东东", "乐乐", "妈妈", "爸爸", "老师",
  "爷爷", "奶奶", "哥哥", "姐姐", "弟弟", "妹妹",
]);

function isChineseOnly(s: string): boolean {
  return /^[\u4e00-\u9fff]+$/.test(s);
}

export interface ProbeCandidateInput {
  segmentedStory: string;
  /** Meanings resolved from the article (plus any gap-filled). */
  wordMeanings?: Record<string, string>;
  /** Ids already slated for testing this lesson (new + review + lookups). */
  excludeIds: Set<string>;
  /** Display characters already used, to avoid duplicate questions. */
  excludeChars: Set<string>;
  /** The student's knowledge records, to skip high-stage known words. */
  knowledgeRecords?: Array<{ wordId: string; intervalStage?: number }>;
  /** Fallback level to tag probe Word objects with. */
  level: string;
  /** How many probe words are needed. */
  count: number;
}

/**
 * Build up to `count` probe Word objects from the story's compound segments.
 * Each returned Word has id `probe:<word>` and a resolved pinyin + meaning.
 */
export function selectProbeWords(input: ProbeCandidateInput): Word[] {
  const { segmentedStory, wordMeanings, excludeIds, excludeChars, knowledgeRecords, level, count } = input;
  if (!segmentedStory || count <= 0) return [];

  // Map character -> highest known SRS stage, to skip well-known words.
  const stageByChar = new Map<string, number>();
  for (const rec of knowledgeRecords ?? []) {
    const stage = rec.intervalStage ?? 0;
    // record ids are "level:char", "lookup:word", or "probe:word"
    const word = rec.wordId.includes(":") ? rec.wordId.split(":").slice(1).join(":") : rec.wordId;
    const prev = stageByChar.get(word) ?? 0;
    if (stage > prev) stageByChar.set(word, stage);
  }

  const segments = segmentedStory.split("/").map((s) => s.trim()).filter((s) => s.length > 0);

  const picked: Word[] = [];
  const seen = new Set<string>();

  for (const seg of segments) {
    if (picked.length >= count) break;
    if (seen.has(seg)) continue;
    seen.add(seg);

    // Compound only, Chinese only.
    if (seg.length < 2 || !isChineseOnly(seg)) continue;
    // Not a function word or name.
    if (FUNCTION_WORDS.has(seg) || NAME_WORDS.has(seg)) continue;
    // Not already being tested this lesson.
    if (excludeChars.has(seg)) continue;
    const probeId = `${PROBE_ID_PREFIX}${seg}`;
    if (excludeIds.has(probeId)) continue;
    // Skip words already known at a high stage (and retired words).
    const stage = stageByChar.get(seg) ?? 0;
    if (stage >= HIGH_STAGE_THRESHOLD || stage >= SRS_RETIRED_STAGE) continue;

    // Must have a usable meaning (article first, then local dictionary).
    const rawMeaning = (wordMeanings?.[seg] || lookupCompoundMeaning(seg) || "")
      .replace(/\s*\(.*?\)\s*/g, "")
      .trim();
    if (!rawMeaning) continue;

    const probePinyin = compoundPinyin(seg);
    if (!probePinyin) continue;

    picked.push({
      id: probeId,
      character: seg,
      pinyin: probePinyin,
      english: rawMeaning,
      level,
    });
  }

  return picked;
}
