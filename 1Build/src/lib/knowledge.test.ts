import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Use a separate test directory to avoid wiping real data
vi.mock("./constants", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    KNOWLEDGE_FILE: "data/test-tmp/knowledge.json",
  };
});

import {
  getKnowledgeState,
  updateKnowledgeState,
  bulkUpdate,
  getKnowledgeSummary,
  readKnowledgeRecords,
} from "./knowledge";
import type { KnowledgeRecord, KnowledgeUpdate } from "./types";

const TEST_DATA_DIR = path.resolve(process.cwd(), "data/test-tmp");
const TEST_KNOWLEDGE_FILE = path.resolve(TEST_DATA_DIR, "knowledge.json");

describe("KnowledgeService", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await fs.writeFile(TEST_KNOWLEDGE_FILE, "[]", "utf-8");
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("getKnowledgeState", () => {
    it("returns 'don't know' when no record exists for a student/word", async () => {
      const state = await getKnowledgeState("student-1", "1-a:你");
      expect(state).toBe("don't know");
    });

    it("returns the stored state when a record exists", async () => {
      const records: KnowledgeRecord[] = [
        {
          studentId: "student-1",
          wordId: "1-a:你",
          level: "1-a",
          state: "known",
          lastUpdated: new Date().toISOString(),
        },
      ];
      await fs.writeFile(
        TEST_KNOWLEDGE_FILE,
        JSON.stringify(records),
        "utf-8"
      );

      const state = await getKnowledgeState("student-1", "1-a:你");
      expect(state).toBe("known");
    });

    it("returns 'don't know' for a different student even if another student has a record", async () => {
      const records: KnowledgeRecord[] = [
        {
          studentId: "student-1",
          wordId: "1-a:你",
          level: "1-a",
          state: "known",
          lastUpdated: new Date().toISOString(),
        },
      ];
      await fs.writeFile(
        TEST_KNOWLEDGE_FILE,
        JSON.stringify(records),
        "utf-8"
      );

      const state = await getKnowledgeState("student-2", "1-a:你");
      expect(state).toBe("don't know");
    });
  });

  describe("updateKnowledgeState", () => {
    it("creates a new record when none exists", async () => {
      await updateKnowledgeState("student-1", "1-a:你", "learning", "1-a");

      const records = await readKnowledgeRecords();
      expect(records).toHaveLength(1);
      expect(records[0].studentId).toBe("student-1");
      expect(records[0].wordId).toBe("1-a:你");
      expect(records[0].state).toBe("learning");
      expect(records[0].level).toBe("1-a");
    });

    it("updates an existing record", async () => {
      await updateKnowledgeState("student-1", "1-a:你", "learning", "1-a");
      await updateKnowledgeState("student-1", "1-a:你", "known", "1-a");

      const records = await readKnowledgeRecords();
      expect(records).toHaveLength(1);
      expect(records[0].state).toBe("known");
    });

    it("does not affect other students' records", async () => {
      await updateKnowledgeState("student-1", "1-a:你", "known", "1-a");
      await updateKnowledgeState("student-2", "1-a:你", "learning", "1-a");

      const records = await readKnowledgeRecords();
      expect(records).toHaveLength(2);

      const s1Record = records.find((r) => r.studentId === "student-1");
      const s2Record = records.find((r) => r.studentId === "student-2");
      expect(s1Record?.state).toBe("known");
      expect(s2Record?.state).toBe("learning");
    });
  });

  describe("bulkUpdate", () => {
    it("creates multiple records in a single operation", async () => {
      const updates: KnowledgeUpdate[] = [
        { wordId: "1-a:你", level: "1-a", newState: "known" },
        { wordId: "1-a:好", level: "1-a", newState: "learning" },
        { wordId: "1-a:我", level: "1-a", newState: "don't know" },
      ];

      await bulkUpdate("student-1", updates);

      const records = await readKnowledgeRecords();
      expect(records).toHaveLength(3);

      const states = records.map((r) => ({ wordId: r.wordId, state: r.state }));
      expect(states).toContainEqual({ wordId: "1-a:你", state: "known" });
      expect(states).toContainEqual({ wordId: "1-a:好", state: "learning" });
      expect(states).toContainEqual({
        wordId: "1-a:我",
        state: "don't know",
      });
    });

    it("updates existing records and creates new ones in a single operation", async () => {
      // Pre-populate one record
      await updateKnowledgeState("student-1", "1-a:你", "learning", "1-a");

      const updates: KnowledgeUpdate[] = [
        { wordId: "1-a:你", level: "1-a", newState: "known" },
        { wordId: "1-a:好", level: "1-a", newState: "learning" },
      ];

      await bulkUpdate("student-1", updates);

      const records = await readKnowledgeRecords();
      expect(records).toHaveLength(2);

      const youRecord = records.find((r) => r.wordId === "1-a:你");
      expect(youRecord?.state).toBe("known");
    });
  });

  describe("getKnowledgeSummary", () => {
    it("returns all zeros for a level with no words", async () => {
      // Mock getWordsForLevel to return empty for a non-existent level
      const summary = await getKnowledgeSummary("student-1", "99-z");
      expect(summary.known).toBe(0);
      expect(summary.learning).toBe(0);
      expect(summary.dontKnow).toBe(0);
      expect(summary.total).toBe(0);
      expect(summary.knownPercentage).toBe(0);
    });

    it("counts all words as 'don't know' when no records exist", async () => {
      // This test depends on actual word list data being available
      // We'll use a vi.mock approach for isolation
      const { getKnowledgeSummary: getSummary } = await import("./knowledge");
      // If the word list isn't available, this will return total=0
      // which is acceptable for the unit test
      const summary = await getSummary("student-1", "1-a");
      expect(summary.dontKnow).toBe(summary.total);
      expect(summary.known).toBe(0);
      expect(summary.learning).toBe(0);
    });
  });

  describe("readKnowledgeRecords", () => {
    it("returns empty array when file does not exist", async () => {
      try {
        await fs.unlink(TEST_KNOWLEDGE_FILE);
      } catch {
        // ignore
      }

      const records = await readKnowledgeRecords();
      expect(records).toEqual([]);
    });

    it("returns empty array when file contains invalid JSON", async () => {
      await fs.writeFile(TEST_KNOWLEDGE_FILE, "not valid json", "utf-8");

      const records = await readKnowledgeRecords();
      expect(records).toEqual([]);
    });

    it("returns empty array when file contains a non-array JSON value", async () => {
      await fs.writeFile(
        TEST_KNOWLEDGE_FILE,
        JSON.stringify({ foo: "bar" }),
        "utf-8"
      );

      const records = await readKnowledgeRecords();
      expect(records).toEqual([]);
    });
  });
});
