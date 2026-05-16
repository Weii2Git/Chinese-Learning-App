import { isSupabaseConfigured } from './supabase';
import * as supabaseKnowledge from './knowledge-supabase';
import * as fileKnowledge from './knowledge-file';
import type {
  KnowledgeRecord,
  KnowledgeState,
  KnowledgeSummary,
  KnowledgeUpdate,
} from './types';

/**
 * Get the appropriate implementation based on environment configuration.
 * Uses Supabase when configured, otherwise falls back to file-based storage.
 */
function getImpl() {
  return isSupabaseConfigured() ? supabaseKnowledge : fileKnowledge;
}

/**
 * Read all knowledge records.
 * Returns an empty array if no records exist.
 */
export async function readKnowledgeRecords(): Promise<KnowledgeRecord[]> {
  return getImpl().readKnowledgeRecords();
}

/**
 * Get the knowledge state for a specific student and word.
 * Returns "don't know" if no record exists.
 */
export async function getKnowledgeState(
  studentId: string,
  wordId: string
): Promise<KnowledgeState> {
  return getImpl().getKnowledgeState(studentId, wordId);
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
  return getImpl().updateKnowledgeState(studentId, wordId, state, level);
}

/**
 * Batch update knowledge states after test completion.
 * More efficient than calling updateKnowledgeState individually for each word.
 */
export async function bulkUpdate(
  studentId: string,
  updates: KnowledgeUpdate[]
): Promise<void> {
  return getImpl().bulkUpdate(studentId, updates);
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
  return getImpl().getKnowledgeSummary(studentId, level);
}
