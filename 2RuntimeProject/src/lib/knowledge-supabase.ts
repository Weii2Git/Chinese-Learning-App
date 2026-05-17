import { getSupabaseClient } from './supabase';
import { getWordsForLevel } from './word-list';
import type {
  KnowledgeRecord,
  KnowledgeState,
  KnowledgeSummary,
  KnowledgeUpdate,
} from './types';

/**
 * Maps a snake_case Supabase row to a camelCase KnowledgeRecord object.
 */
function mapRowToRecord(row: Record<string, unknown>): KnowledgeRecord {
  const record: KnowledgeRecord = {
    studentId: row.student_id as string,
    wordId: row.word_id as string,
    level: row.level as string,
    state: row.state as KnowledgeState,
    lastUpdated: row.last_updated as string,
  };

  // Include SRS fields when present
  if (row.interval_stage != null) {
    record.intervalStage = row.interval_stage as number;
  }
  if (row.last_reviewed_at != null) {
    record.lastReviewedAt = row.last_reviewed_at as string;
  }
  if (row.next_due_date != null) {
    record.nextDueDate = row.next_due_date as string;
  }
  if (row.compound_word != null) {
    record.compoundWord = row.compound_word as string;
  }
  if (row.compound_meaning != null) {
    record.compoundMeaning = row.compound_meaning as string;
  }

  return record;
}

/**
 * Maps a camelCase KnowledgeRecord to a snake_case row for Supabase.
 */
function mapRecordToRow(record: KnowledgeRecord): Record<string, unknown> {
  const row: Record<string, unknown> = {
    student_id: record.studentId,
    word_id: record.wordId,
    level: record.level,
    state: record.state,
    last_updated: record.lastUpdated,
  };

  if (record.intervalStage !== undefined) {
    row.interval_stage = record.intervalStage;
  }
  if (record.lastReviewedAt !== undefined) {
    row.last_reviewed_at = record.lastReviewedAt;
  }
  if (record.nextDueDate !== undefined) {
    row.next_due_date = record.nextDueDate;
  }

  return row;
}

/**
 * Read all knowledge records from Supabase.
 */
export async function readKnowledgeRecords(): Promise<KnowledgeRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('knowledge_records')
    .select('*');

  if (error) {
    throw new Error(`readKnowledgeRecords failed: ${error.message}`);
  }

  return (data ?? []).map(mapRowToRecord);
}

/**
 * Get the knowledge state for a specific student and word.
 * Returns "don't know" if no record exists.
 */
export async function getKnowledgeState(
  studentId: string,
  wordId: string
): Promise<KnowledgeState> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('knowledge_records')
    .select('state')
    .eq('student_id', studentId)
    .eq('word_id', wordId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`getKnowledgeState failed: ${error.message}`);
  }

  return data ? (data.state as KnowledgeState) : "don't know";
}

/**
 * Update the knowledge state for a specific student and word.
 * Uses upsert to create or update the record.
 */
export async function updateKnowledgeState(
  studentId: string,
  wordId: string,
  state: KnowledgeState,
  level?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    student_id: studentId,
    word_id: wordId,
    level: level ?? "",
    state,
    last_updated: now,
  };

  const { error } = await supabase
    .from('knowledge_records')
    .upsert(row, { onConflict: 'student_id,word_id' });

  if (error) {
    throw new Error(`updateKnowledgeState failed: ${error.message}`);
  }
}

/**
 * Batch update knowledge states after test completion.
 * Uses upsert with onConflict on (student_id, word_id).
 */
export async function bulkUpdate(
  studentId: string,
  updates: KnowledgeUpdate[]
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const rows = updates.map((update) => {
    const row: Record<string, unknown> = {
      student_id: studentId,
      word_id: update.wordId,
      level: update.level,
      state: update.newState,
      last_updated: now,
    };

    if (update.intervalStage !== undefined) {
      row.interval_stage = update.intervalStage;
    }
    if (update.lastReviewedAt !== undefined) {
      row.last_reviewed_at = update.lastReviewedAt;
    }
    if (update.nextDueDate !== undefined) {
      row.next_due_date = update.nextDueDate;
    }
    // Only save compound context when first learning (don't overwrite existing)
    if (update.compoundWord) {
      row.compound_word = update.compoundWord;
    }
    if (update.compoundMeaning) {
      row.compound_meaning = update.compoundMeaning;
    }

    return row;
  });

  const { error } = await supabase
    .from('knowledge_records')
    .upsert(rows, { onConflict: 'student_id,word_id' });

  if (error) {
    throw new Error(`bulkUpdate failed: ${error.message}`);
  }
}

/**
 * Get a summary of knowledge states for a student at a specific level.
 * Counts records by state from Supabase, and total words from the word list file.
 */
export async function getKnowledgeSummary(
  studentId: string,
  level: string
): Promise<KnowledgeSummary> {
  const supabase = getSupabaseClient();

  const [queryResult, wordsAtLevel] = await Promise.all([
    supabase
      .from('knowledge_records')
      .select('word_id, state')
      .eq('student_id', studentId)
      .eq('level', level),
    getWordsForLevel(level),
  ]);

  if (queryResult.error) {
    throw new Error(`getKnowledgeSummary failed: ${queryResult.error.message}`);
  }

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

  // Count states only for words that exist in the word list at this level
  const wordIdsAtLevel = new Set(wordsAtLevel.map((w) => w.id));
  let known = 0;
  let learning = 0;

  for (const record of queryResult.data ?? []) {
    if (!wordIdsAtLevel.has(record.word_id)) continue;
    if (record.state === 'known') {
      known++;
    } else if (record.state === 'learning') {
      learning++;
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
