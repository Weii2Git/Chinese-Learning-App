"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StudentInfo {
  id: string;
  name: string;
  currentLevel: string;
  streakStars: number;
  performanceStars: number;
}

interface WordInfo {
  character: string;
  pinyin: string;
  english: string;
  level: string;
}

interface StudentWordData {
  student: StudentInfo;
  knownWords: WordInfo[];
  learningWords: WordInfo[];
  nextNewWords: WordInfo[];
  nextReviewWords: WordInfo[];
}

interface StarAdjustmentEntry {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  starType: "performanceStars";
  previousValue: number;
  newValue: number;
  delta: number;
  reason: string;
}

export default function AdminPage() {
  // API key state
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"loading" | "configured" | "not_configured">("loading");
  const [masked, setMasked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Shared students list
  const [students, setStudents] = useState<StudentInfo[]>([]);

  // Star adjustment state
  const [starStudent, setStarStudent] = useState<string | null>(null);
  const [starDelta, setStarDelta] = useState<string>("");
  const [starReason, setStarReason] = useState("");
  const [starSaving, setStarSaving] = useState(false);
  const [starMsg, setStarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [starLog, setStarLog] = useState<StarAdjustmentEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // Word status state
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [wordData, setWordData] = useState<StudentWordData | null>(null);
  const [loadingWords, setLoadingWords] = useState(false);
  const [timeTravelDays, setTimeTravelDays] = useState(1);
  const [timeTravelMsg, setTimeTravelMsg] = useState<string | null>(null);

  // Load students + log on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/students");
        setStudents(await res.json());
      } catch { /* ignore */ }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadLog() {
      setLoadingLog(true);
      try {
        const res = await fetch("/api/admin/adjust-stars");
        setStarLog(await res.json());
      } catch { /* ignore */ }
      finally { setLoadingLog(false); }
    }
    loadLog();
  }, []);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/admin/api-key");
        const data = await res.json();
        if (data.configured) { setStatus("configured"); setMasked(data.masked); }
        else setStatus("not_configured");
      } catch { setStatus("not_configured"); }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    if (!selectedStudent) { setWordData(null); return; }
    async function loadWordData() {
      setLoadingWords(true);
      try {
        const res = await fetch(`/api/admin/student-words?studentId=${selectedStudent}`);
        setWordData(await res.json());
      } catch { setWordData(null); }
      finally { setLoadingWords(false); }
    }
    loadWordData();
  }, [selectedStudent]);

  // Helpers
  const selectedStudentInfo = students.find((s) => s.id === starStudent);

  async function handleStarAdjust() {
    if (!starStudent || !starReason.trim() || starDelta === "") {
      setStarMsg({ type: "error", text: "Please fill in all fields." });
      return;
    }
    const delta = parseInt(starDelta, 10);
    if (isNaN(delta) || delta === 0) {
      setStarMsg({ type: "error", text: "Enter a non-zero number (e.g. +5 or -3)." });
      return;
    }
    const current = selectedStudentInfo?.performanceStars ?? 0;
    const newValue = Math.max(0, current + delta);

    setStarSaving(true);
    setStarMsg(null);
    try {
      const res = await fetch("/api/admin/adjust-stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: starStudent, starType: "performanceStars", newValue, reason: starReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust stars");
      setStarMsg({ type: "success", text: `Done! ${data.entry.studentName}: ${data.entry.previousValue} → ${data.entry.newValue} (${delta > 0 ? "+" : ""}${delta})` });
      setStarDelta("");
      setStarReason("");
      const [logRes, studentsRes] = await Promise.all([
        fetch("/api/admin/adjust-stars"),
        fetch("/api/students"),
      ]);
      setStarLog(await logRes.json());
      setStudents(await studentsRes.json());
    } catch (err: unknown) {
      setStarMsg({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setStarSaving(false);
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) { setMessage({ type: "error", text: "Please enter an API key." }); return; }
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim() }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to save"); }
      setStatus("configured"); setMasked(apiKey.slice(0, 6) + "..." + apiKey.slice(-4)); setApiKey(""); setMessage({ type: "success", text: "API key saved successfully!" });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save API key" });
    } finally { setSaving(false); }
  }

  async function handleRemove() {
    try {
      await fetch("/api/admin/api-key", { method: "DELETE" });
      setStatus("not_configured"); setMasked(null); setMessage({ type: "success", text: "API key removed." });
    } catch { setMessage({ type: "error", text: "Failed to remove API key." }); }
  }

  async function handleTestKey() {
    setTesting(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/test-key", { method: "POST" });
      const data = await res.json();
      if (data.success) { setMessage({ type: "success", text: data.message }); }
      else {
        let errorText = `Test failed: ${data.error}`;
        if (data.hint) errorText += `\n💡 ${data.hint}`;
        setMessage({ type: "error", text: errorText });
      }
    } catch { setMessage({ type: "error", text: "Failed to test API key." }); }
    finally { setTesting(false); }
  }

  const deltaNum = parseInt(starDelta, 10);
  const previewValue = selectedStudentInfo
    ? Math.max(0, selectedStudentInfo.performanceStars + (isNaN(deltaNum) ? 0 : deltaNum))
    : null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Home
        </Link>

        {/* ── 1. STAR ADJUSTMENT (most used) ── */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h1 className="text-lg font-bold text-white mb-1">⭐ Adjust Performance Stars</h1>
          <p className="text-slate-500 text-sm mb-5">Add or remove stars with a reason note</p>

          {/* Student selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Student</label>
            <select
              value={starStudent || ""}
              onChange={(e) => { setStarStudent(e.target.value || null); setStarDelta(""); setStarMsg(null); }}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
            >
              <option value="">Select a student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ⭐ {s.performanceStars} stars
                </option>
              ))}
            </select>
          </div>

          {/* Delta input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Change Amount
              {selectedStudentInfo && starDelta !== "" && !isNaN(deltaNum) && deltaNum !== 0 && (
                <span className="ml-2 text-slate-500 font-normal">
                  {selectedStudentInfo.performanceStars} → <span className="text-white font-semibold">{previewValue}</span>
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setStarDelta((v) => { const n = parseInt(v || "0", 10); return String(Math.abs(isNaN(n) ? 1 : n)); })}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${!starDelta.startsWith("-") && starDelta !== "" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >
                + Add
              </button>
              <button
                onClick={() => setStarDelta((v) => { const n = parseInt(v || "0", 10); return "-" + Math.abs(isNaN(n) ? 1 : n); })}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${starDelta.startsWith("-") ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >
                − Remove
              </button>
              <input
                type="number"
                min="1"
                value={starDelta.replace("-", "")}
                onChange={(e) => {
                  const abs = e.target.value.replace(/[^0-9]/g, "");
                  const sign = starDelta.startsWith("-") ? "-" : "";
                  setStarDelta(abs === "" ? "" : sign + abs);
                }}
                placeholder="0"
                className="flex-1 rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors text-center"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Reason</label>
            <input
              type="text"
              value={starReason}
              onChange={(e) => setStarReason(e.target.value)}
              placeholder="e.g. Bonus for extra practice session"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") handleStarAdjust(); }}
            />
          </div>

          {starMsg && (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${starMsg.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
              {starMsg.text}
            </div>
          )}

          <button
            onClick={handleStarAdjust}
            disabled={starSaving || !starStudent || starDelta === "" || isNaN(deltaNum) || deltaNum === 0 || !starReason.trim()}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-base font-semibold text-white transition-colors"
          >
            {starSaving ? "Saving..." : "Apply"}
          </button>
        </div>

        {/* ── ADJUSTMENT LOG ── */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h2 className="text-base font-bold text-white mb-4">Adjustment Log <span className="text-slate-500 font-normal text-sm">(last 10)</span></h2>

          {loadingLog && <p className="text-slate-500 text-sm text-center py-4">Loading...</p>}
          {!loadingLog && starLog.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No adjustments yet</p>}
          {!loadingLog && starLog.length > 0 && (
            <div className="space-y-2">
              {starLog.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-slate-800 px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-white text-sm">{entry.studentName}</span>
                      <span className={`text-xs font-bold ${entry.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                      <span className="text-slate-500 text-xs">{entry.previousValue} → {entry.newValue}</span>
                    </div>
                    <p className="text-slate-400 text-xs italic truncate">&quot;{entry.reason}&quot;</p>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0 mt-0.5">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. WORD STATUS ── */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h2 className="text-lg font-bold text-white mb-1">📚 Student Word Status</h2>
          <p className="text-slate-500 text-sm mb-5">View learned, learning, and upcoming words per student</p>

          <select
            value={selectedStudent || ""}
            onChange={(e) => setSelectedStudent(e.target.value || null)}
            className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-2.5 text-sm text-white focus:outline-none transition-colors mb-4"
          >
            <option value="">Select a student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} (Level {s.currentLevel})</option>
            ))}
          </select>

          {selectedStudent && (
            <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 mb-5">
              <p className="text-sm font-semibold text-slate-300 mb-1">Time Travel</p>
              <p className="text-xs text-slate-500 mb-3">Fast-forward SRS due dates to simulate days passing</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="180" value={timeTravelDays}
                  onChange={(e) => setTimeTravelDays(Number(e.target.value))}
                  className="w-20 rounded-lg bg-slate-700 border border-slate-600 px-3 py-1.5 text-sm text-white text-center focus:outline-none"
                />
                <span className="text-sm text-slate-500">days</span>
                <button
                  onClick={async () => {
                    setTimeTravelMsg(null);
                    const res = await fetch("/api/admin/time-travel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: selectedStudent, days: timeTravelDays }) });
                    const data = await res.json();
                    setTimeTravelMsg(data.message || data.error);
                    const refreshRes = await fetch(`/api/admin/student-words?studentId=${selectedStudent}`);
                    setWordData(await refreshRes.json());
                  }}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
                >
                  Fast Forward →
                </button>
              </div>
              {timeTravelMsg && <p className="mt-2 text-xs text-slate-400">{timeTravelMsg}</p>}
            </div>
          )}

          {loadingWords && <p className="text-center text-slate-500 text-sm py-4">Loading...</p>}

          {wordData && !loadingWords && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Known ({wordData.knownWords.length})</p>
                {wordData.knownWords.length === 0 ? <p className="text-xs text-slate-600">None yet</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {wordData.knownWords.map((w, i) => (
                      <span key={i} title={`${w.pinyin} - ${w.english}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-xs">
                        <span className="font-bold text-emerald-300">{w.character}</span>
                        <span className="text-emerald-600">{w.pinyin}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Learning ({wordData.learningWords.length})</p>
                {wordData.learningWords.length === 0 ? <p className="text-xs text-slate-600">None</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {wordData.learningWords.map((w, i) => (
                      <span key={i} title={`${w.pinyin} - ${w.english}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-xs">
                        <span className="font-bold text-amber-300">{w.character}</span>
                        <span className="text-amber-600">{w.pinyin}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Next Lesson</p>
                <p className="text-xs text-indigo-400 mb-1.5">New ({wordData.nextNewWords.length})</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {wordData.nextNewWords.map((w, i) => (
                    <span key={i} title={`${w.pinyin} - ${w.english}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 text-xs">
                      <span className="font-bold text-indigo-300">{w.character}</span>
                      <span className="text-indigo-500">{w.pinyin}</span>
                      <span className="text-slate-600">({w.english})</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-emerald-400 mb-1.5">Review ({wordData.nextReviewWords.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {wordData.nextReviewWords.map((w, i) => (
                    <span key={i} title={`${w.pinyin} - ${w.english}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-xs">
                      <span className="font-bold text-emerald-300">{w.character}</span>
                      <span className="text-emerald-600">{w.pinyin}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. API SETUP (least used) ── */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h2 className="text-lg font-bold text-white mb-1">🔑 API Setup</h2>
          <p className="text-slate-500 text-sm mb-5">Configure your Gemini API key for story generation</p>

          <div className="rounded-xl bg-slate-800 p-4 mb-5 flex items-center justify-between">
            <span className="text-sm text-slate-400">Status</span>
            {status === "loading" ? (
              <span className="text-sm text-slate-500">Checking...</span>
            ) : status === "configured" ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Configured
                {masked && <span className="text-slate-500 font-mono text-xs ml-1">{masked}</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Not configured
              </span>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="api-key" className="block text-sm font-medium text-slate-400 mb-1.5">
              {status === "configured" ? "Replace API Key" : "Enter API Key"}
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Gemini API key here"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {message && (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !apiKey.trim()} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              {saving ? "Saving..." : "Save Key"}
            </button>
            {status === "configured" && (
              <button onClick={handleRemove} className="rounded-xl border border-slate-700 hover:border-red-500/50 hover:text-red-400 px-4 py-2.5 text-sm font-semibold text-slate-400 transition-colors">
                Remove
              </button>
            )}
          </div>

          {status === "configured" && (
            <button onClick={handleTestKey} disabled={testing} className="w-full mt-3 rounded-xl border border-slate-700 hover:border-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40">
              {testing ? "Testing..." : "Test API Key"}
            </button>
          )}

          <div className="mt-5 rounded-xl bg-slate-800 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1.5">How to get a Gemini API key:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Google AI Studio</a></li>
              <li>Sign in with your Google account</li>
              <li>Click &quot;Create API Key&quot;</li>
              <li>Copy and paste it above</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
}
