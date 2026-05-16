import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { updateStreakStars, awardPerformanceStars } from "./stars";
import { getAllStudents, getStudent } from "./student";
import { STUDENTS_FILE } from "./constants";

const studentsPath = path.resolve(process.cwd(), STUDENTS_FILE);
const dataDir = path.dirname(studentsPath);

// Helper to format a Date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function getToday(): string {
  return formatDate(new Date());
}

function getTwoDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return formatDate(d);
}

// Clean up test data before/after each test
beforeEach(async () => {
  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (file.startsWith("students.json")) {
        await fs.unlink(path.join(dataDir, file));
      }
    }
  } catch {
    // Directory might not exist yet
  }
});

afterEach(async () => {
  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (file.startsWith("students.json")) {
        await fs.unlink(path.join(dataDir, file));
      }
    }
  } catch {
    // Ignore cleanup errors
  }
  vi.restoreAllMocks();
});

describe("StarService", () => {
  describe("updateStreakStars", () => {
    it("should set streak to 1 when lastActiveDate is null (first lesson)", async () => {
      const students = await getAllStudents();
      const student = students[0];

      const result = await updateStreakStars(student.id);
      expect(result).toBe(1);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(1);
      expect(updated?.lastActiveDate).toBe(getToday());
    });

    it("should increment streak when lastActiveDate is yesterday", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student was active yesterday with streak of 2
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id
              ? { ...s, streakStars: 2, lastActiveDate: getYesterday() }
              : s
          )
        ),
        "utf-8"
      );

      const result = await updateStreakStars(student.id);
      expect(result).toBe(3);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(3);
      expect(updated?.lastActiveDate).toBe(getToday());
    });

    it("should cap streak at MAX_STREAK_STARS (5)", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student already at max streak, was active yesterday
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id
              ? { ...s, streakStars: 5, lastActiveDate: getYesterday() }
              : s
          )
        ),
        "utf-8"
      );

      const result = await updateStreakStars(student.id);
      expect(result).toBe(5);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(5);
    });

    it("should reset streak to 1 when lastActiveDate is more than 1 day ago", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student was active 2 days ago with streak of 4
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id
              ? { ...s, streakStars: 4, lastActiveDate: getTwoDaysAgo() }
              : s
          )
        ),
        "utf-8"
      );

      const result = await updateStreakStars(student.id);
      expect(result).toBe(1);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(1);
      expect(updated?.lastActiveDate).toBe(getToday());
    });

    it("should keep streak unchanged when lastActiveDate is today", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student already completed a lesson today
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id
              ? { ...s, streakStars: 3, lastActiveDate: getToday() }
              : s
          )
        ),
        "utf-8"
      );

      const result = await updateStreakStars(student.id);
      expect(result).toBe(3);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(3);
    });

    it("should throw for non-existent student", async () => {
      await getAllStudents(); // Initialize
      await expect(updateStreakStars("non-existent-id")).rejects.toThrow(
        "Student not found"
      );
    });
  });

  describe("awardPerformanceStars", () => {
    it("should add quickCorrectCount to existing performance stars", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student has 10 performance stars
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id ? { ...s, performanceStars: 10 } : s
          )
        ),
        "utf-8"
      );

      const result = await awardPerformanceStars(student.id, 3);
      expect(result).toBe(13);

      const updated = await getStudent(student.id);
      expect(updated?.performanceStars).toBe(13);
    });

    it("should handle zero quick correct answers", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student has 5 performance stars
      await fs.writeFile(
        studentsPath,
        JSON.stringify(
          students.map((s) =>
            s.id === student.id ? { ...s, performanceStars: 5 } : s
          )
        ),
        "utf-8"
      );

      const result = await awardPerformanceStars(student.id, 0);
      expect(result).toBe(5);

      const updated = await getStudent(student.id);
      expect(updated?.performanceStars).toBe(5);
    });

    it("should accumulate performance stars across multiple calls", async () => {
      const students = await getAllStudents();
      const student = students[0];

      const result1 = await awardPerformanceStars(student.id, 4);
      expect(result1).toBe(4);

      const result2 = await awardPerformanceStars(student.id, 2);
      expect(result2).toBe(6);

      const result3 = await awardPerformanceStars(student.id, 5);
      expect(result3).toBe(11);
    });

    it("should throw for non-existent student", async () => {
      await getAllStudents(); // Initialize
      await expect(
        awardPerformanceStars("non-existent-id", 3)
      ).rejects.toThrow("Student not found");
    });
  });
});
