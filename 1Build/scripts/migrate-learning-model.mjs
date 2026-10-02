#!/usr/bin/env node

/**
 * One-time migration for the two-state learning model.
 *
 * What it does:
 *   1. Backs up every affected row to a timestamped JSON file under data/backups/.
 *   2. Converts knowledge_records with state "learning" -> "known".
 *   3. Collapses the dual star-rate settings into a single key:
 *        app_settings.stars_per_correct  (value taken from the old
 *        stars_per_correct_fast, else stars_per_correct_slow, else "1")
 *      and removes the old stars_per_correct_fast / stars_per_correct_slow rows.
 *
 * SAFETY: dry-run by default. It only writes changes when you pass --apply.
 *
 * Usage:
 *   node scripts/migrate-learning-model.mjs            # dry run (no writes)
 *   node scripts/migrate-learning-model.mjs --apply    # perform the migration
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const APPLY = process.argv.includes('--apply');

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
      if (!process.env[key]) process.env[key] = value;
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

function writeBackup(name, data) {
  const dir = resolve(process.cwd(), 'data', 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = resolve(dir, `${name}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  Backup written: ${file}`);
  return file;
}

async function main() {
  console.log('=== Learning-model migration ===');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(APPLY ? 'Mode: APPLY (writes will be made)\n' : 'Mode: DRY RUN (no writes — pass --apply to execute)\n');

  // Connection test
  const { error: pingError } = await supabase.from('knowledge_records').select('student_id').limit(1);
  if (pingError) {
    console.error(`Connection test failed: ${pingError.message}`);
    process.exit(1);
  }

  // --- 1. knowledge_records: learning -> known ---
  console.log('Step 1: knowledge_records state "learning" -> "known"');
  const { data: learningRows, error: readErr } = await supabase
    .from('knowledge_records')
    .select('*')
    .eq('state', 'learning');
  if (readErr) {
    console.error(`  Failed to read learning rows: ${readErr.message}`);
    process.exit(1);
  }
  console.log(`  Found ${learningRows?.length ?? 0} record(s) in state "learning".`);

  // --- 2. app_settings: collapse star keys ---
  console.log('Step 2: collapse app_settings star keys -> stars_per_correct');
  const { data: settingRows, error: settingErr } = await supabase
    .from('app_settings')
    .select('*')
    .in('key', ['stars_per_correct', 'stars_per_correct_fast', 'stars_per_correct_slow']);
  if (settingErr) {
    console.error(`  Failed to read app_settings: ${settingErr.message}`);
    process.exit(1);
  }
  const settingMap = new Map((settingRows ?? []).map((r) => [r.key, r.value]));
  const newStarValue =
    settingMap.get('stars_per_correct') ??
    settingMap.get('stars_per_correct_fast') ??
    settingMap.get('stars_per_correct_slow') ??
    '1';
  console.log(`  Existing star keys: ${[...settingMap.keys()].join(', ') || '(none)'}`);
  console.log(`  Resolved stars_per_correct = ${newStarValue}`);

  // Backups (always, even in dry run, so there is a record before applying)
  console.log('\nWriting backups...');
  writeBackup('knowledge-learning-rows', learningRows ?? []);
  writeBackup('app-settings-star-rows', settingRows ?? []);

  if (!APPLY) {
    console.log('\nDry run complete. No changes were made.');
    console.log('Re-run with --apply to perform the migration.');
    return;
  }

  // --- Apply step 1 ---
  console.log('\nApplying knowledge_records update...');
  const { error: updErr, count } = await supabase
    .from('knowledge_records')
    .update({ state: 'known' }, { count: 'exact' })
    .eq('state', 'learning');
  if (updErr) {
    console.error(`  Update failed: ${updErr.message}`);
    process.exit(1);
  }
  console.log(`  Updated ${count ?? learningRows?.length ?? 0} record(s) to "known".`);

  // --- Apply step 2 ---
  console.log('Applying app_settings collapse...');
  const { error: upsertErr } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'stars_per_correct', value: String(newStarValue), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (upsertErr) {
    console.error(`  Upsert stars_per_correct failed: ${upsertErr.message}`);
    process.exit(1);
  }
  const { error: delErr } = await supabase
    .from('app_settings')
    .delete()
    .in('key', ['stars_per_correct_fast', 'stars_per_correct_slow']);
  if (delErr) {
    console.error(`  Deleting old star keys failed: ${delErr.message}`);
    process.exit(1);
  }
  console.log('  Collapsed star keys into stars_per_correct and removed legacy keys.');

  console.log('\n=== Migration complete ===');
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
