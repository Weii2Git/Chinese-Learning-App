"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface WordInfo {
  character: string;
  pinyin: string;
  english: string;
  level: string;
}

interface StarEntry {
  id: string;
  timestamp: string;
  delta: number;
  previousValue: number;
  newValue: number;
  reason: string;
  source: "admin" | "lesson";
}

interface Props {
  studentId: string;
  studentName: string;
  lessonsCompleted: number;
  streakStars: number;
  performanceStars: number;
  knownCount: number;
  learningCount: number;
  dontKnowCount: number;
  knownPercentage: number;
  currentLevel: string;
}

export function StudentDashboardClient({
  studentId,
  studentName,
  lessonsCompleted,
  streakStars,
  performanceStars,
  knownCount,
  learningCount,
  dontKnowCount,
  knownPercentage,
  currentLevel,
}: Props) {
  // Panel state: null | "stars" | "known" | "learning"
  const [panel, setPanel] = useState<null | "stars" | "known" | "learning">(null);

  // Star log state
  const [starLog, setStarLog] = useState<StarEntry[] | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [currentStars, setCurrentStars] = useState(performanceStars);
  const [deductAmount, setDeductAmount] = useState("");
  const [deductReason, setDeductReason] = useState("");
  const [deducting, setDeducting] = useState(false);
  const [deductMsg, setDeductMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Word list state
  const [words, setWords] = useState<WordInfo[] | null>(null);
  const [loadingWords, setLoadingWords] = useState(false);
  const [wordState, setWordState] = useState<"known" | "learning">("known");

  async function openStars() {
    if (panel === "stars") { setPanel(null); return; }
    setPanel("stars");
    if (starLog === null) {
      setLoadingLog(true);
      const res = await fetch(`/api/students/${studentId}/stars`);
      setStarLog(await res.json());
      setLoadingLog(false);
    }
  }

  async function openWords(state: "known" | "learning") {
    if (panel === state) { setPanel(null); return; }
    setPanel(state);
    setWordState(state);
    setWords(null);
    setLoadingWords(true);
    const res = await fetch(`/api/students/${studentId}/words?state=${state}`);
    setWords(await res.json());
    setLoadingWords(false);
  }

  async function handleDeduct() {
    const amount = parseInt(deductAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setDeductMsg({ type: "error", text: "Enter a positive number." }); return;
    }
    if (!deductReason.trim()) {
      setDeductMsg({ type: "error", text: "Please enter a reason." }); return;
    }
    setDeducting(true); setDeductMsg(null);
    try {
      const res = await fetch(`/api/students/${studentId}/stars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deductAmount: amount, reason: deductReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentStars(data.newValue);
      setDeductAmount(""); setDeductReason("");
      setDeductMsg({ type: "success", text: `Done! ${data.delta} stars. New total: ${data.newValue}` });
      // Refresh log
      const logRes = await fetch(`/api/students/${studentId}/stars`);
      setStarLog(await logRes.json());
    } catch (err: unknown) {
      setDeductMsg({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally { setDeducting(false); }
  }

  const total = knownCount + learningCount + dontKnowCount;
  const knownPct = total > 0 ? (knownCount / total) * 100 : 0;
  const learningPct = total > 0 ? (learningCount / total) * 100 : 0;
  const dontKnowPct = total > 0 ? (dontKnowCount / total) * 100 : 0;
  const progress = Math.min(100, Math.max(0, knownPercentage));

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-center">
          <p className="text-3xl font-bold text-white">{lessonsCompleted}</p>
          <p className="text-sm text-slate-500 mt-1">Lessons</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Image src="/assets/icons/heart.png" alt="streak" width={20} height={20} unoptimized style={{ imageRendering: "pixelated" }} />
            <span className="text-2xl font-bold text-white">{streakStars}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Streak</p>
        </div>
        {/* Stars — clickable */}
        <button
          onClick={openStars}
          className={`rounded-xl border p-4 text-center transition-colors ${panel === "stars" ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900 border-slate-800 hover:border-slate-600"}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Image src="/assets/icons/star.png" alt="stars" width={20} height={20} unoptimized style={{ imageRendering: "pixelated" }} />
            <span className="text-2xl font-bold text-amber-400">{currentStars}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Stars ↗</p>
        </button>
      </div>

      {/* Star panel */}
      {panel === "stars" && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h2 className="text-base font-bold text-white mb-4">⭐ Star History & Deduct</h2>

          {/* Deduct form */}
          <div className="rounded-xl bg-slate-800 p-4 mb-5">
            <p className="text-sm font-semibold text-slate-300 mb-3">Deduct Stars</p>
            <div className="flex gap-2 mb-3">
              <input
                type="number" min="1" value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 rounded-lg bg-slate-700 border border-slate-600 focus:border-red-500 px-3 py-2 text-sm text-white text-center focus:outline-none"
              />
              <input
                type="text" value={deductReason}
                onChange={(e) => setDeductReason(e.target.value)}
                placeholder="Reason (e.g. spent on reward)"
                className="flex-1 rounded-lg bg-slate-700 border border-slate-600 focus:border-red-500 px-3 py-2 text-sm text-white focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") handleDeduct(); }}
              />
              <button
                onClick={handleDeduct}
                disabled={deducting || !deductAmount || !deductReason.trim()}
                className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {deducting ? "..." : "Deduct"}
              </button>
            </div>
            {deductMsg && (
              <p className={`text-xs ${deductMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {deductMsg.text}
              </p>
            )}
          </div>

          {/* Log */}
          {loadingLog && <p className="text-slate-500 text-sm text-center py-4">Loading...</p>}
          {!loadingLog && starLog?.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No history yet</p>}
          {!loadingLog && starLog && starLog.length > 0 && (
            <div className="space-y-2">
              {starLog.map((entry) => (
                <div key={entry.id} className={`rounded-xl px-4 py-3 flex items-start gap-3 ${entry.source === "lesson" ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-slate-800"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${entry.source === "lesson" ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-700 text-slate-400"}`}>
                        {entry.source === "lesson" ? "Lesson" : "Manual"}
                      </span>
                      <span className={`text-sm font-bold ${entry.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                      <span className="text-slate-500 text-xs">{entry.previousValue} → {entry.newValue}</span>
                    </div>
                    <p className="text-slate-400 text-xs italic truncate">&quot;{entry.reason}&quot;</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-600">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Word Knowledge */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center mb-3">Word Knowledge</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800 mb-3">
          {knownPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${knownPct}%` }} />}
          {learningPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${learningPct}%` }} />}
          {dontKnowPct > 0 && <div className="bg-slate-600 transition-all" style={{ width: `${dontKnowPct}%` }} />}
        </div>
        <div className="flex justify-center gap-4 text-sm">
          <button
            onClick={() => openWords("known")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${panel === "known" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-emerald-300"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Known ({knownCount}) ↗
          </button>
          <button
            onClick={() => openWords("learning")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${panel === "learning" ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-amber-300"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Learning ({learningCount}) ↗
          </button>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
            New ({dontKnowCount})
          </span>
        </div>
      </div>

      {/* Word list panel */}
      {(panel === "known" || panel === "learning") && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h2 className="text-base font-bold text-white mb-4">
            {wordState === "known" ? "✅ Known Words" : "📖 Learning Words"}
            {words && <span className="text-slate-500 font-normal text-sm ml-2">({words.length})</span>}
          </h2>
          {loadingWords && <p className="text-slate-500 text-sm text-center py-4">Loading...</p>}
          {!loadingWords && words?.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No words yet</p>}
          {!loadingWords && words && words.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {words.map((w, i) => (
                <span
                  key={i}
                  title={`${w.pinyin} — ${w.english} (${w.level})`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ${
                    wordState === "known"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                  }`}
                >
                  <span className="font-bold text-base">{w.character}</span>
                  <span className="text-xs opacity-70">{w.pinyin}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level progress */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <div className="flex items-center justify-between text-base text-slate-400 mb-3">
          <span>Level {currentLevel} Progress</span>
          <span className="font-semibold text-slate-300">{Math.round(progress)}% known</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Start lesson */}
      <Link
        href={`/student/${studentId}/lesson/reading`}
        className="block w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-5 text-center text-xl font-bold text-white transition-colors shadow-lg shadow-indigo-900/30"
      >
        Start Lesson →
      </Link>
    </div>
  );
}
