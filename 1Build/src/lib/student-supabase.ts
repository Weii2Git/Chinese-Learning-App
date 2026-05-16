import { getSupabaseClient } from './supabase';
import { LEVELS, LEVEL_ADVANCE_THRESHOLD } from './constants';
import { getKnowledgeSummary } from './knowledge';
import type { Student } from './types';

/**
 * Maps a snake_case Supabase row to a camelCase Student object.
 */
function mapRowToStudent(row: Record<string, unknown>): Student {
  return {
    id: row.id as string,
    name: row.name as string,
    currentLevel: row.current_level as string,
    streakStars: row.streak_stars as number,
    performanceStars: row.performance_stars as number,
    lastActiveDate: row.last_active_date as string | null,
    lessonsCompleted: row.lessons_completed as number,
  };
}

/**
 * Maps a camelCase Student object to a snake_case row for Supabase.
 */
function mapStudentToRow(student: Student): Record<string, unknown> {
  return {
    id: student.id,
    name: student.name,
    current_level: student.currentLevel,
    streak_stars: student.streakStars,
    performance_stars: student.performanceStars,
    last_active_date: student.lastActiveDate,
    lessons_completed: student.lessonsCompleted,
  };
}

/**
 * Get all students from Supabase, ordered by name.
 */
export async function getAllStudents(): Promise<Student[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`getAllStudents failed: ${error.message}`);
  }

  return (data ?? []).map(mapRowToStudent);
}

/**
 * Get a single student by ID from Supabase.
 * Returns null if not found.
 */
export async function getStudent(id: string): Promise<Student | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`getStudent failed: ${error.message}`);
  }

  return data ? mapRowToStudent(data) : null;
}

/**
 * Create a new student in Supabase.
 * Returns the created student.
 */
export async function createStudent(student: Student): Promise<Student> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .insert(mapStudentToRow(student))
    .select()
    .single();

  if (error) {
    throw new Error(`createStudent failed: ${error.message}`);
  }

  return mapRowToStudent(data);
}

/**
 * Update a student's profile with partial updates in Supabase.
 * Returns the updated student, or null if not found.
 */
export async function updateStudent(
  id: string,
  updates: Partial<Omit<Student, 'id'>>
): Promise<Student | null> {
  const supabase = getSupabaseClient();

  // Map camelCase updates to snake_case
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.currentLevel !== undefined) row.current_level = updates.currentLevel;
  if (updates.streakStars !== undefined) row.streak_stars = updates.streakStars;
  if (updates.performanceStars !== undefined) row.performance_stars = updates.performanceStars;
  if (updates.lastActiveDate !== undefined) row.last_active_date = updates.lastActiveDate;
  if (updates.lessonsCompleted !== undefined) row.lessons_completed = updates.lessonsCompleted;

  const { data, error } = await supabase
    .from('students')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`updateStudent failed: ${error.message}`);
  }

  return data ? mapRowToStudent(data) : null;
}

/**
 * Check if a student has met the 90% known threshold at their current level
 * and advance them to the next level if so.
 */
export async function checkAndAdvanceLevel(
  studentId: string
): Promise<{ advanced: boolean; newLevel?: string; completionMessage?: string }> {
  const student = await getStudent(studentId);
  if (!student) {
    return { advanced: false };
  }

  const summary = await getKnowledgeSummary(studentId, student.currentLevel);

  if (summary.total === 0) {
    return { advanced: false };
  }

  const knownRatio = summary.known / summary.total;

  if (knownRatio < LEVEL_ADVANCE_THRESHOLD) {
    return { advanced: false };
  }

  const currentLevelIndex = LEVELS.indexOf(student.currentLevel);

  if (currentLevelIndex === -1) {
    return { advanced: false };
  }

  if (currentLevelIndex === LEVELS.length - 1) {
    return {
      advanced: false,
      completionMessage:
        "Congratulations! You have completed all levels of the Chinese learning program!",
    };
  }

  const newLevel = LEVELS[currentLevelIndex + 1];
  await updateStudent(studentId, { currentLevel: newLevel });

  return { advanced: true, newLevel };
}
