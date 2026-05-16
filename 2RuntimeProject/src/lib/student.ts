import { isSupabaseConfigured } from './supabase';
import * as supabaseStudent from './student-supabase';
import * as fileStudent from './student-file';
import type { Student } from './types';

/**
 * Get the appropriate implementation based on environment configuration.
 * Uses Supabase when configured, otherwise falls back to file-based storage.
 */
function getImpl() {
  return isSupabaseConfigured() ? supabaseStudent : fileStudent;
}

/**
 * Read all students.
 */
export async function getAllStudents(): Promise<Student[]> {
  return getImpl().getAllStudents();
}

/**
 * Get a single student by ID.
 * Returns null if the student is not found.
 */
export async function getStudent(id: string): Promise<Student | null> {
  return getImpl().getStudent(id);
}

/**
 * Create a new student and persist.
 * Returns the created student.
 */
export async function createStudent(student: Student): Promise<Student> {
  return getImpl().createStudent(student);
}

/**
 * Update a student's profile with partial updates.
 * Returns the updated student, or null if the student was not found.
 */
export async function updateStudent(
  id: string,
  updates: Partial<Omit<Student, 'id'>>
): Promise<Student | null> {
  return getImpl().updateStudent(id, updates);
}

/**
 * Check if a student has met the 90% known threshold at their current level
 * and advance them to the next level if so.
 */
export async function checkAndAdvanceLevel(
  studentId: string
): Promise<{ advanced: boolean; newLevel?: string; completionMessage?: string }> {
  return getImpl().checkAndAdvanceLevel(studentId);
}
