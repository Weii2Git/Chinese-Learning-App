import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { updateStreakStars } from "./stars";
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

    it("keeps incrementing the raw streak (the cap applies only to the awarded/displayed bonus)", async () => {
      const students = await getAllStudents();
      const student = students[0];

      // Set up: student at a streak of 5, was active yesterday
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
      expect(result).toBe(6);

      const updated = await getStudent(student.id);
      expect(updated?.streakStars).toBe(6);
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
});
