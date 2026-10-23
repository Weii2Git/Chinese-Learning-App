/**
 * One-time corrective script for the "new word jumps to SRS stage 2" bug.
 *
 * BUG (now fixed in code): advanceInterval(0) returned stage 2 instead of 1, so
 * a brand-new word's FIRST correct answer landed on stage 2 with a +3-day due
 * date instead of stage 1 with a +1-day due date.
 *
 * This script finds records that match that exact fingerprint and knocks them
 * back to stage 1:
 *   - interval_stage = 2
 *   - next_due_date === last_reviewed_at + 3 days (the stage-2 interval), i.e.
 *     the stage was set by a single advance and never re-scheduled since
 *   - last_reviewed_at is RECENT (within --days, default 3): a legitimately
 *     earned stage 2 requires a stage-1 review at least ~1 day earlier, so a
 *     very recent single-advance stage-2 record is almost certainly the bug.
 *
 * It does NOT touch stage >= 3 records: re-deriving those correctly needs review
 * history we don't store, so we deliberately leave them rather than risk wrong
 * demotions. (The code fix stops any further mis-advancement going forward.)
 *
 * SAFETY:
 *   - DRY RUN by default. Prints every record it would change. No writes.
 *   - Pass --apply to perform the update.
 *   - Writes a timestamped backup of every affected row before applying.
 *   - Optional --student <uuid> to limit to one student.
 *
 * Usage (run from 2RuntimeProject so .env.local is present):
 *   node scripts/fix-newword-stage-skip.mjs                 # dry run, all students
 *   node scripts/fix-newword-stage-skip.mjs --student <id>  # dry run, one student
 *   node scripts/fix-newword-stage-skip.mjs --apply         # apply to all
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const APPLY = process.argv.includes("--apply");
const studentFlagIdx = process.argv.indexOf("--student");
const STUDENT_ID = studentFlagIdx !== -1 ? process.argv[studentFlagIdx + 1] : null;
const daysFlagIdx = process.argv.indexOf("--days");
const RECENT_DAYS = daysFlagIdx !== -1 ? Number(process.argv[daysFlagIdx + 1]) : 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE2_INTERVAL_MS = 3 * DAY_MS; // must match SRS_INTERVALS_MS[2]
const STAGE1_INTERVAL_MS = 1 * DAY_MS; // SRS_INTERVALS_MS[1]
// Allow a small tolerance when matching the +3-day due date (clock/rounding).
const TOLERANCE_MS = 60 * 60 * 1000; // 1 hour

// --- load env ---
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
} catch (e) {
  console.error("Could not read .env.local:", e.message);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readAllRows() {
  return supabase.from("knowledge_records").select("*");
}

async function main() {
  console.log(`=== Fix new-word stage-skip (stage 2 -> 1) ===`);
  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  console.log(`Scope: ${STUDENT_ID ? `student ${STUDENT_ID}` : "all students"}`);
  console.log(`Recent window: last_reviewed within ${RECENT_DAYS} day(s)\n`);

  let query = supabase
    .from("knowledge_records")
    .select("id, student_id, word_id, interval_stage, last_reviewed_at, next_due_date, last_updated")
    .eq("interval_stage", 2);
  if (STUDENT_ID) query = query.eq("student_id", STUDENT_ID);

  const { data, error } = await query;
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const now = Date.now();
  const candidates = [];
  for (const r of data ?? []) {
    if (!r.last_reviewed_at || !r.next_due_date) continue;
    const reviewed = new Date(r.last_reviewed_at).getTime();
    const due = new Date(r.next_due_date).getTime();
    if (isNaN(reviewed) || isNaN(due)) continue;

    // Fingerprint: due == reviewed + 3 days (single stage-2 schedule), and the
    // review happened recently.
    const matchesStage2Schedule = Math.abs(due - (reviewed + STAGE2_INTERVAL_MS)) <= TOLERANCE_MS;
    const isRecent = now - reviewed <= RECENT_DAYS * DAY_MS + TOLERANCE_MS;
    if (matchesStage2Schedule && isRecent) {
      candidates.push(r);
    }
  }

  console.log(`Found ${candidates.length} record(s) matching the bug fingerprint:\n`);
  for (const r of candidates) {
    const newDue = new Date(new Date(r.last_reviewed_at).getTime() + STAGE1_INTERVAL_MS).toISOString();
    console.log(
      `  ${r.word_id} (student ${r.student_id.slice(0, 8)})  stage 2 -> 1  ` +
      `due ${r.next_due_date} -> ${newDue}`
    );
  }

  if (candidates.length === 0) {
    console.log("\nNothing to fix.");
    return;
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no changes written. Re-run with --apply to perform the fix.`);
    return;
  }

  // Backup first.
  const dir = resolve(process.cwd(), "data", "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = resolve(dir, `stage-skip-fix-${stamp}.json`);
  writeFileSync(backupFile, JSON.stringify(candidates, null, 2), "utf-8");
  console.log(`\nBacked up ${candidates.length} row(s) to ${backupFile}`);

  // Apply updates one by one (scoped by primary key id).
  let updated = 0;
  for (const r of candidates) {
    const newDue = new Date(new Date(r.last_reviewed_at).getTime() + STAGE1_INTERVAL_MS).toISOString();
    const { error: upErr } = await supabase
      .from("knowledge_records")
      .update({ interval_stage: 1, next_due_date: newDue })
      .eq("id", r.id);
    if (upErr) {
      console.error(`  FAILED ${r.word_id}: ${upErr.message}`);
    } else {
      updated++;
    }
  }
  console.log(`\nDone. Updated ${updated}/${candidates.length} record(s).`);
}

main().catch((e) => {
  console.error("Script failed:", e.message);
  process.exit(1);
});
