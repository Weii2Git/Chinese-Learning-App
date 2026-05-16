import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { enrichCharacter } from "./dictionary";
import { ENRICHED_WORDS_CACHE_FILE, WORD_LIST_FILE } from "./constants";
import type { Word, EnrichedWordCache, ParsedLevel } from "./types";

/**
 * Parse the word list source file into levels and their characters.
 * Each level header looks like: "一年级上册生字：100个 - Grade 1-a"
 */
export function parseWordListFile(content: string): ParsedLevel[] {
  const levels: ParsedLevel[] = [];
  const lines = content.split("\n");

  // Regex to match level headers like "Grade 1-a", "Grade 2-b", etc.
  const headerRegex = /Grade\s+(\d+)-([ab])/i;

  let currentLevel: string | null = null;
  let currentChars: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(headerRegex);
    if (headerMatch) {
      // Save previous level if exists
      if (currentLevel !== null) {
        levels.push({ level: currentLevel, characters: currentChars });
      }
      currentLevel = `${headerMatch[1]}-${headerMatch[2]}`;
      currentChars = [];
    } else if (currentLevel !== null) {
      // Each non-header line contains characters (possibly space-separated)
      for (const char of trimmed) {
        // Only include actual Chinese characters (CJK Unified Ideographs range)
        if (char.match(/[\u4e00-\u9fff]/)) {
          currentChars.push(char);
        }
      }
    }
  }

  // Don't forget the last level
  if (currentLevel !== null) {
    levels.push({ level: currentLevel, characters: currentChars });
  }

  return levels;
}

/**
 * Build enriched Word objects from parsed levels.
 */
function buildEnrichedWords(parsedLevels: ParsedLevel[]): Word[] {
  const words: Word[] = [];

  for (const { level, characters } of parsedLevels) {
    for (const char of characters) {
      const enriched = enrichCharacter(char);
      words.push({
        id: `${level}:${char}`,
        character: char,
        pinyin: enriched.pinyin,
        english: enriched.english,
        level,
      });
    }
  }

  return words;
}

/**
 * Compute a hash of the source file content for cache invalidation.
 */
function computeFileHash(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Load enriched words from cache if valid, otherwise parse + enrich + cache.
 */
export async function loadOrBuildCache(): Promise<Word[]> {
  const wordListPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), WORD_LIST_FILE);
  const cachePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), ENRICHED_WORDS_CACHE_FILE);

  // Read the source file
  let sourceContent: string;
  try {
    sourceContent = await fs.readFile(wordListPath, "utf-8");
  } catch {
    throw new Error(
      `Characters list.txt not found at ${wordListPath}. Please ensure the word list file exists in the project root.`
    );
  }

  const sourceHash = computeFileHash(sourceContent);

  // Try loading from cache
  try {
    const cacheContent = await fs.readFile(cachePath, "utf-8");
    const cache: EnrichedWordCache = JSON.parse(cacheContent);
    if (cache.version === sourceHash && cache.words && cache.words.length > 0) {
      return cache.words;
    }
  } catch {
    // Cache doesn't exist or is invalid — rebuild
  }

  // Parse and enrich
  const parsedLevels = parseWordListFile(sourceContent);
  if (parsedLevels.length === 0) {
    throw new Error(
      "Word list file appears to be malformed: no level headers found."
    );
  }

  const words = buildEnrichedWords(parsedLevels);

  // Write cache
  const cache: EnrichedWordCache = {
    version: sourceHash,
    generatedAt: new Date().toISOString(),
    words,
  };

  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    const tempPath = cachePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(cache, null, 2), "utf-8");
    await fs.rename(tempPath, cachePath);
  } catch (err) {
    console.warn("Failed to write enriched word cache:", err);
  }

  return words;
}

/**
 * Get enriched words for a specific level.
 */
export async function getWordsForLevel(level: string): Promise<Word[]> {
  const allWords = await loadOrBuildCache();
  return allWords.filter((w) => w.level === level);
}

/**
 * Get all enriched words.
 */
export async function getAllWords(): Promise<Word[]> {
  return loadOrBuildCache();
}
