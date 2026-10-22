import { describe, it, expect } from "vitest";
import { selectProbeWords, PROBE_ID_PREFIX } from "./probe-words";

// A segmented story: compounds and single chars separated by "/", punctuation
// as its own segments. Meanings supplied via wordMeanings so selection doesn't
// depend on the local dictionary.
const SEGMENTED =
  "小明/今天/去/公园/，/他/看见/一只/蝴蝶/。/非常/开心/的/乐乐/跑过来/了/。";

const MEANINGS: Record<string, string> = {
  公园: "park",
  看见: "see",
  蝴蝶: "butterfly",
  开心: "happy",
  跑过来: "run over",
  今天: "today",
  非常: "very", // function word — must be skipped
};

describe("selectProbeWords", () => {
  it("picks compound words from the story and tags them with the probe id prefix", () => {
    const probes = selectProbeWords({
      segmentedStory: SEGMENTED,
      wordMeanings: MEANINGS,
      excludeIds: new Set(),
      excludeChars: new Set(),
      knowledgeRecords: [],
      level: "3-a",
      count: 3,
    });

    expect(probes.length).toBe(3);
    for (const p of probes) {
      expect(p.id.startsWith(PROBE_ID_PREFIX)).toBe(true);
      expect(p.character.length).toBeGreaterThanOrEqual(2);
      expect(p.english.length).toBeGreaterThan(0);
      expect(p.pinyin.length).toBeGreaterThan(0);
    }
  });

  it("skips single characters, punctuation, function words, and names", () => {
    const probes = selectProbeWords({
      segmentedStory: SEGMENTED,
      wordMeanings: MEANINGS,
      excludeIds: new Set(),
      excludeChars: new Set(),
      knowledgeRecords: [],
      level: "3-a",
      count: 20,
    });
    const chars = probes.map((p) => p.character);

    // Single chars / punctuation never selected
    expect(chars).not.toContain("去");
    expect(chars).not.toContain("，");
    // Function word skipped
    expect(chars).not.toContain("非常");
    // Name skipped
    expect(chars).not.toContain("小明");
    expect(chars).not.toContain("乐乐");
  });

  it("skips words already slated for testing (excludeChars)", () => {
    const probes = selectProbeWords({
      segmentedStory: SEGMENTED,
      wordMeanings: MEANINGS,
      excludeIds: new Set(),
      excludeChars: new Set(["蝴蝶"]),
      knowledgeRecords: [],
      level: "3-a",
      count: 20,
    });
    expect(probes.map((p) => p.character)).not.toContain("蝴蝶");
  });

  it("skips words already known at a high SRS stage", () => {
    const probes = selectProbeWords({
      segmentedStory: SEGMENTED,
      wordMeanings: MEANINGS,
      excludeIds: new Set(),
      excludeChars: new Set(),
      knowledgeRecords: [{ wordId: "lookup:蝴蝶", intervalStage: 5 }],
      level: "3-a",
      count: 20,
    });
    expect(probes.map((p) => p.character)).not.toContain("蝴蝶");
  });

  it("skips words with no resolvable meaning", () => {
    const probes = selectProbeWords({
      segmentedStory: "神秘/的/古董", // 神秘 & 古董 have no meaning supplied
      wordMeanings: {},
      excludeIds: new Set(),
      excludeChars: new Set(),
      knowledgeRecords: [],
      level: "3-a",
      count: 5,
    });
    // Neither has a meaning in wordMeanings or (likely) the small local dict.
    // At minimum, nothing is returned without a meaning.
    for (const p of probes) expect(p.english.length).toBeGreaterThan(0);
  });

  it("returns at most `count` words", () => {
    const probes = selectProbeWords({
      segmentedStory: SEGMENTED,
      wordMeanings: MEANINGS,
      excludeIds: new Set(),
      excludeChars: new Set(),
      knowledgeRecords: [],
      level: "3-a",
      count: 2,
    });
    expect(probes.length).toBeLessThanOrEqual(2);
  });
});
