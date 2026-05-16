import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Use a separate test directory to avoid wiping real data
vi.mock("./constants", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    STUDENTS_FILE: "data/test-tmp/students.json",
  };
});

import {
  getAllStudents,
  getStudent,
  updateStudent,
  checkAndAdvanceLevel,
} from "./student";
import { STUDENTS_FILE } from "./constants";

const studentsPath = path.resolve(process.cwd(), STUDENTS_FILE);
const dataDir = path.dirname(studentsPath);

// Clean up test data before/after each test
beforeEach(async () => {
  try {
    await fs.rm(dataDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist yet
  }
  await fs.mkdir(dataDir, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(dataDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  vi.restoreAllMocks();
});

describe("StudentService", () => {
  describe("getAllStudents", () => {
    it("should initialize with seed data when no file exists", async () => {
      const students = await getAllStudents();
      expect(students).toHaveLength(4);
      expect(students.map((s) => s.name)).toEqual([
        "Ryan",
        "Patrick",
        "Cony Da Banana",
        "Mommy",
      ]);
    });

    it("should have correct levels for seed students", async () => {
      const students = await getAllStudents();
      const ryan = students.find((s) => s.name === "Ryan");
      const patrick = students.find((s) => s.name === "Patrick");
      const conor = students.find((s) => s.name === "Cony Da Banana");
      const mommy = students.find((s) => s.name === "Mommy");

      expect(ryan?.currentLevel).toBe("3-a");
      expect(patrick?.currentLevel).toBe("4-a");
      expect(conor?.currentLevel).toBe("4-a");
      expect(mommy?.currentLevel).toBe("3-b");
    });

    it("should read existing students from file", async () => {
      const testStudents = [
        {
          id: "test-id-1",
          name: "Test Student",
          currentLevel: "1-a",
          streakStars: 2,
          performanceStars: 10,
          lastActiveDate: "2024-01-01",
          lessonsCompleted: 5,
        },
      ];
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(studentsPath, JSON.stringify(testStudents), "utf-8");

      const students = await getAllStudents();
      expect(students).toHaveLength(1);
      expect(students[0].name).toBe("Test Student");
    });

    it("should handle corrupted JSON by retrying and returning seed data", async () => {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(studentsPath, "not valid json{{{", "utf-8");

      const students = await getAllStudents();
      // Should return seed data (without overwriting the file)
      expect(students).toHaveLength(4);
      expect(students[0].name).toBe("Ryan");
    });

    it("should handle non-array JSON by retrying and returning seed data", async () => {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        studentsPath,
        JSON.stringify({ not: "an array" }),
        "utf-8"
      );

      const students = await getAllStudents();
      expect(students).toHaveLength(4);
      expect(students[0].name).toBe("Ryan");
    });
  });

  describe("getStudent", () => {
    it("should return a student by ID", async () => {
      const students = await getAllStudents();
      const firstStudent = students[0];

      const found = await getStudent(firstStudent.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe(firstStudent.name);
    });

    it("should return null for non-existent ID", async () => {
      await getAllStudents(); // Initialize
      const found = await getStudent("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("updateStudent", () => {
    it("should update student fields and persist", async () => {
      const students = await getAllStudents();
      const firstStudent = students[0];

      const updated = await updateStudent(firstStudent.id, {
        streakStars: 3,
        performanceStars: 15,
      });

      expect(updated).not.toBeNull();
      expect(updated?.streakStars).toBe(3);
      expect(updated?.performanceStars).toBe(15);

      // Verify persistence
      const reloaded = await getStudent(firstStudent.id);
      expect(reloaded?.streakStars).toBe(3);
      expect(reloaded?.performanceStars).toBe(15);
    });

    it("should return null for non-existent student", async () => {
      await getAllStudents(); // Initialize
      const result = await updateStudent("non-existent-id", {
        streakStars: 5,
      });
      expect(result).toBeNull();
    });

    it("should not change the student ID", async () => {
      const students = await getAllStudents();
      const firstStudent = students[0];

      const updated = await updateStudent(firstStudent.id, {
        name: "New Name",
      });
      expect(updated?.id).toBe(firstStudent.id);
    });
  });

  describe("checkAndAdvanceLevel", () => {
    it("should return advanced: false for non-existent student", async () => {
      const result = await checkAndAdvanceLevel("non-existent-id");
      expect(result.advanced).toBe(false);
    });

    it("should return advanced: false when threshold not met", async () => {
      // The seed students have no knowledge records, so 0% known
      const students = await getAllStudents();
      const result = await checkAndAdvanceLevel(students[0].id);
      expect(result.advanced).toBe(false);
    });
  });

  describe("seed data stability", () => {
    it("should use fixed UUIDs for seed students", async () => {
      // Delete file to force reinitialization
      try { await fs.unlink(studentsPath); } catch { /* ignore */ }
      const students1 = await getAllStudents();
      // Delete and reinitialize again
      try { await fs.unlink(studentsPath); } catch { /* ignore */ }
      const students2 = await getAllStudents();

      // IDs should be the same across reinitializations
      expect(students1.map((s) => s.id)).toEqual(students2.map((s) => s.id));
    });
  });
});
