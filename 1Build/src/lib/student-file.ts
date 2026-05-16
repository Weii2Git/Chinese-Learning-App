import { promises as fs } from "fs";
import path from "path";
import { LEVELS, LEVEL_ADVANCE_THRESHOLD, STUDENTS_FILE } from "./constants";
import { getKnowledgeSummary } from "./knowledge";
import type { Student } from "./types";

// Fixed UUIDs for seed students — stable across reinitializations
export const SEED_STUDENTS: Student[] = [
  {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Ryan",
    currentLevel: "2-b",
    streakStars: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
  },
  {
    id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    name: "Patrick",
    currentLevel: "3-b",
    streakStars: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
  },
  {
    id: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
    name: "Cony Da Banana",
    currentLevel: "3-b",
    streakStars: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
  },
  {
    id: "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
    name: "Mommy",
    currentLevel: "4-a",
    streakStars: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
  },
];

/**
 * Resolve the absolute path to the students JSON file.
 */
function getStudentsPath(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), STUDENTS_FILE);
}

/**
 * Read all students from the JSON file.
 * If the file doesn't exist, initializes with seed data.
 * If the file is corrupted, retries multiple times before giving up.
 * NEVER overwrites existing data with seed data.
 */
export async function getAllStudents(): Promise<Student[]> {
  const filePath = getStudentsPath();

  // Try reading up to 3 times (handles hot reload race conditions)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (!content.trim()) {
        // Empty file — wait and retry
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      const students: Student[] = JSON.parse(content);
      if (!Array.isArray(students) || students.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      return students;
    } catch {
      // File doesn't exist on first attempt — check
      if (attempt === 0) {
        try {
          await fs.access(filePath);
          // File exists but corrupted — wait and retry
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        } catch {
          // File truly doesn't exist — initialize with seed data
          await writeStudents(SEED_STUDENTS);
          return [...SEED_STUDENTS];
        }
      }
      // Subsequent attempts — just wait and retry
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // After 3 attempts, try one final read
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const students: Student[] = JSON.parse(content);
    if (Array.isArray(students) && students.length > 0) {
      return students;
    }
  } catch {
    // Give up
  }

  // Last resort: return seed data in memory but DO NOT write to file
  // This prevents overwriting potentially recoverable data
  return [...SEED_STUDENTS];
}

/**
 * Write students array to the JSON file using atomic write pattern.
 * Writes to a temp file first, then renames to prevent partial writes.
 * Falls back to direct write on Windows when rename fails.
 */
async function writeStudents(students: Student[]): Promise<void> {
  const filePath = getStudentsPath();
  const dir = path.dirname(filePath);
  const tempPath = filePath + ".tmp";

  // Ensure the data directory exists
  await fs.mkdir(dir, { recursive: true });

  const data = JSON.stringify(students, null, 2);

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
 * Create a new student and persist to the data file.
 * Returns the created student.
 */
export async function createStudent(student: Student): Promise<Student> {
  const students = await getAllStudents();
  students.push(student);
  await writeStudents(students);
  return student;
}

/**
 * Get a single student by ID.
 * Returns null if the student is not found.
 */
export async function getStudent(id: string): Promise<Student | null> {
  const students = await getAllStudents();
  return students.find((s) => s.id === id) ?? null;
}

/**
 * Update a student's profile with partial updates.
 * Returns the updated student, or null if the student was not found.
 */
export async function updateStudent(
  id: string,
  updates: Partial<Omit<Student, "id">>
): Promise<Student | null> {
  const students = await getAllStudents();
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return null;
  }

  students[index] = { ...students[index], ...updates };
  await writeStudents(students);
  return students[index];
}

/**
 * Check if a student has met the 90% known threshold at their current level
 * and advance them to the next level if so.
 *
 * Returns whether the student advanced and the new level (if applicable).
 * If the student is at level 6-b and meets the threshold, returns a completion message.
 */
export async function checkAndAdvanceLevel(
  studentId: string
): Promise<{ advanced: boolean; newLevel?: string; completionMessage?: string }> {
  const student = await getStudent(studentId);
  if (!student) {
    return { advanced: false };
  }

  const summary = await getKnowledgeSummary(studentId, student.currentLevel);

  // If there are no words at this level, don't advance
  if (summary.total === 0) {
    return { advanced: false };
  }

  const knownRatio = summary.known / summary.total;

  if (knownRatio < LEVEL_ADVANCE_THRESHOLD) {
    return { advanced: false };
  }

  // Student has met the threshold — check if they're at the final level
  const currentLevelIndex = LEVELS.indexOf(student.currentLevel);

  if (currentLevelIndex === -1) {
    return { advanced: false };
  }

  if (currentLevelIndex === LEVELS.length - 1) {
    // Student is at 6-b and has completed all levels
    return {
      advanced: false,
      completionMessage:
        "Congratulations! You have completed all levels of the Chinese learning program!",
    };
  }

  // Advance to the next level
  const newLevel = LEVELS[currentLevelIndex + 1];
  await updateStudent(studentId, { currentLevel: newLevel });

  return { advanced: true, newLevel };
}
