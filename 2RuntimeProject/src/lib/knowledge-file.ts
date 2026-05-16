import { promises as fs } from "fs";
import path from "path";
import { KNOWLEDGE_FILE } from "./constants";
import { getWordsForLevel } from "./word-list";
import type {
  KnowledgeRecord,
  KnowledgeState,
  KnowledgeSummary,
  KnowledgeUpdate,
} from "./types";

/**
 * Resolve the absolute path to the knowledge JSON file.
 */
function getKnowledgePath(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), KNOWLEDGE_FILE);
}

/**
 * Read all knowledge records from the JSON file.
 * Returns an empty array if the file doesn't exist or is corrupted.
 */
export async function readKnowledgeRecords(): Promise<KnowledgeRecord[]> {
  const filePath = getKnowledgePath();
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const records: KnowledgeRecord[] = JSON.parse(content);
    if (!Array.isArray(records)) {
      return [];
    }
    return records;
  } catch {
    // File doesn't exist or is corrupted — return empty array
    return [];
  }
}

/**
 * Write knowledge records to the JSON file using atomic write pattern.
 * Writes to a temp file first, then renames to prevent partial writes.
 * Falls back to direct write on Windows when rename fails.
 */
async function writeKnowledgeRecords(
  records: KnowledgeRecord[]
): Promise<void> {
  const filePath = getKnowledgePath();
  const dir = path.dirname(filePath);
  const tempPath = filePath + ".tmp";

  // Ensure the data directory exists
  await fs.mkdir(dir, { recursive: true });

  const data = JSON.stringify(records, null, 2);

  // Write to temp file, then atomically rename
  try {
    await fs.writeFile(tempPath, data, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch {
    // On Windows, rename can fail due to file locking — fall back to direct write
    await fs.writeFile(filePath, data, "utf-8");
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get the knowledge state for a specific student and word.
 * Returns "don't know" if no record exists (Requirement 3.3).
 */
export async function getKnowledgeState(
  studentId: string,
  wordId: string
): Promise<KnowledgeState> {
  const records = await readKnowledgeRecords();
  const record = records.find(
    (r) => r.studentId === studentId && r.wordId === wordId
  );
  return record ? record.state : "don't know";
}

/**
 * Update the knowledge state for a specific student and word.
 * Creates a new record if one doesn't exist, otherwise updates the existing one.
 */
export async function updateKnowledgeState(
  studentId: string,
  wordId: string,
  state: KnowledgeState,
  level?: string
): Promise<void> {
  const records = await readKnowledgeRecords();
  const now = new Date().toISOString();

  const existingIndex = records.findIndex(
    (r) => r.studentId === studentId && r.wordId === wordId
  );

  if (existingIndex >= 0) {
    records[existingIndex].state = state;
    records[existingIndex].lastUpdated = now;
  } else {
    records.push({
      studentId,
      wordId,
      level: level ?? "",
      state,
      lastUpdated: now,
    });
  }

  await writeKnowledgeRecords(records);
}

/**
 * Batch update knowledge states after test completion.
 * More efficient than calling updateKnowledgeState individually for each word.
 */
export async function bulkUpdate(
  studentId: string,
  updates: KnowledgeUpdate[]
): Promise<void> {
  const records = await readKnowledgeRecords();
  const now = new Date().toISOString();

  for (const update of updates) {
    const existingIndex = records.findIndex(
      (r) => r.studentId === studentId && r.wordId === update.wordId
    );

    if (existingIndex >= 0) {
      records[existingIndex].state = update.newState;
      records[existingIndex].lastUpdated = now;
      // Persist SRS fields if provided
      if (update.intervalStage !== undefined) {
        records[existingIndex].intervalStage = update.intervalStage;
      }
      if (update.lastReviewedAt !== undefined) {
        records[existingIndex].lastReviewedAt = update.lastReviewedAt;
      }
      if (update.nextDueDate !== undefined) {
        records[existingIndex].nextDueDate = update.nextDueDate;
      }
    } else {
      const newRecord: KnowledgeRecord = {
        studentId,
        wordId: update.wordId,
        level: update.level,
        state: update.newState,
        lastUpdated: now,
      };
      // Add SRS fields if provided
      if (update.intervalStage !== undefined) {
        newRecord.intervalStage = update.intervalStage;
      }
      if (update.lastReviewedAt !== undefined) {
        newRecord.lastReviewedAt = update.lastReviewedAt;
      }
      if (update.nextDueDate !== undefined) {
        newRecord.nextDueDate = update.nextDueDate;
      }
      records.push(newRecord);
    }
  }

  await writeKnowledgeRecords(records);
}

/**
 * Get a summary of knowledge states for a student at a specific level.
 * Returns counts of known, learning, and don't know words, plus the total
 * and the percentage of known words.
 */
export async function getKnowledgeSummary(
  studentId: string,
  level: string
): Promise<KnowledgeSummary> {
  const [records, wordsAtLevel] = await Promise.all([
    readKnowledgeRecords(),
    getWordsForLevel(level),
  ]);

  const total = wordsAtLevel.length;

  if (total === 0) {
    return {
      known: 0,
      learning: 0,
      dontKnow: 0,
      total: 0,
      knownPercentage: 0,
    };
  }

  let known = 0;
  let learning = 0;

  for (const word of wordsAtLevel) {
    const record = records.find(
      (r) => r.studentId === studentId && r.wordId === word.id
    );
    if (record) {
      if (record.state === "known") {
        known++;
      } else if (record.state === "learning") {
        learning++;
      }
    }
  }

  const dontKnow = total - known - learning;
  const knownPercentage = (known / total) * 100;

  return {
    known,
    learning,
    dontKnow,
    total,
    knownPercentage,
  };
}
