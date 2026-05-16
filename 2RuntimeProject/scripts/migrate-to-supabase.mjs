#!/usr/bin/env node

/**
 * Migration script: reads local JSON data files and upserts all records into Supabase.
 *
 * Usage:
 *   node scripts/migrate-to-supabase.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFile as readFileAsync } from 'fs/promises';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Error: Missing required environment variables.\n' +
    'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Read and parse a JSON file from the data directory.
 */
async function readJsonFile(filename) {
  const filePath = resolve(process.cwd(), 'data', filename);
  const content = await readFileAsync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Migrate students from data/students.json to Supabase.
 */
async function migrateStudents() {
  console.log('Reading data/students.json...');
  const students = await readJsonFile('students.json');

  if (!Array.isArray(students) || students.length === 0) {
    console.log('No students to migrate.');
    return 0;
  }

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    current_level: s.currentLevel,
    streak_stars: s.streakStars ?? 0,
    performance_stars: s.performanceStars ?? 0,
    last_active_date: s.lastActiveDate ?? null,
    lessons_completed: s.lessonsCompleted ?? 0,
  }));

  console.log(`Upserting ${rows.length} students...`);
  const { error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error(`Failed to upsert students: ${error.message}`);
    throw error;
  }

  return rows.length;
}

/**
 * Migrate knowledge records from data/knowledge.json to Supabase.
 * Processes in batches of 500 to avoid payload limits.
 */
async function migrateKnowledge() {
  console.log('Reading data/knowledge.json...');
  const records = await readJsonFile('knowledge.json');

  if (!Array.isArray(records) || records.length === 0) {
    console.log('No knowledge records to migrate.');
    return 0;
  }

  const rows = records.map((r) => {
    const row = {
      student_id: r.studentId,
      word_id: r.wordId,
      level: r.level ?? '',
      state: r.state,
      last_updated: r.lastUpdated ?? new Date().toISOString(),
    };

    if (r.intervalStage != null) {
      row.interval_stage = r.intervalStage;
    }
    if (r.lastReviewedAt != null) {
      row.last_reviewed_at = r.lastReviewedAt;
    }
    if (r.nextDueDate != null) {
      row.next_due_date = r.nextDueDate;
    }

    return row;
  });

  const BATCH_SIZE = 500;
  let migrated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(`Upserting knowledge records batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)...`);

    const { error } = await supabase
      .from('knowledge_records')
      .upsert(batch, { onConflict: 'student_id,word_id' });

    if (error) {
      console.error(`Batch failed: ${error.message}`);
      skipped += batch.length;
    } else {
      migrated += batch.length;
    }
  }

  if (skipped > 0) {
    console.log(`  Skipped ${skipped} records due to errors.`);
  }

  return migrated;
}

/**
 * Main migration entry point.
 */
async function main() {
  console.log('=== Supabase Migration ===');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Test connection
    const { error: pingError } = await supabase.from('students').select('id').limit(1);
    if (pingError) {
      console.error(`Connection test failed: ${pingError.message}`);
      console.error(`URL: ${SUPABASE_URL}`);
      process.exit(1);
    }
    console.log('Connection verified.\n');

    const studentCount = await migrateStudents();
    console.log(`✓ Students migrated: ${studentCount}\n`);

    const knowledgeCount = await migrateKnowledge();
    console.log(`✓ Knowledge records migrated: ${knowledgeCount}\n`);

    console.log('=== Migration Complete ===');
    console.log(`  Students: ${studentCount}`);
    console.log(`  Knowledge records: ${knowledgeCount}`);
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    console.error(`URL: ${SUPABASE_URL}`);
    process.exit(1);
  }
}

main();
