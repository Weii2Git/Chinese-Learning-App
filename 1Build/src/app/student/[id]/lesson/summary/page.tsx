"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLessonContext } from "@/lib/lesson-context";
import { StarDisplay } from "@/components/StarDisplay";
import type { KnowledgeUpdate, StudentWithStats } from "@/lib/types";

interface LessonCompleteResponse {
  updatedStudent: StudentWithStats;
  knowledgeUpdates: KnowledgeUpdate[];
  leveledUp: boolean;
  streakBonus: number;
}

type PagePhase = "loading" | "done" | "error";

export default function TestSummaryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lessonState, resetLesson } = useLessonContext();

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LessonCompleteResponse | null>(null);
  const studentId = params.id;

  useEffect(() => {
    if (!lessonState || !lessonState.results.length) return;
    let cancelled = false;

    async function submitResults() {
      try {
        const allResults = lessonState!.results;
        // Only send results from the last passing round
        const roundStart = lessonState!.lastRoundStartIndex ?? 0;
        const lastRoundResults = allResults.slice(roundStart);
        const res = await fetch("/api/lessons/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, results: lastRoundResults }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to complete lesson");
        }
        const responseData: LessonCompleteResponse = await res.json();
        if (!cancelled) { setData(responseData); setPhase("done"); }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
          setPhase("error");
        }
      }
    }
    submitResults();
    return () => { cancelled = true; };
  }, [lessonState, studentId]);

  function handleBackToDashboard() {
    resetLesson();
    router.push(`/student/${studentId}`);
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Calculating your results...</h2>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button onClick={handleBackToDashboard} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data || !lessonState) return null;

  const { updatedStudent, knowledgeUpdates, leveledUp, streakBonus } = data;
  // Only show stats from the last passing round
  const roundStart = lessonState.lastRoundStartIndex ?? 0;
  const lastRoundResults = lessonState.results.slice(roundStart);
  const totalQuestions = lastRoundResults.length;
  const correctCount = lastRoundResults.filter((r) => r.isCorrect).length;
  const starsEarned = correctCount;
  const knownCount = knowledgeUpdates.filter((u) => u.newState === "known").length;
  const learningCount = knowledgeUpdates.filter((u) => u.newState === "learning").length;
  const dontKnowCount = knowledgeUpdates.filter((u) => u.newState === "don't know").length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
      <div className="w-full max-w-2xl space-y-5">
        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-4xl font-bold text-white">Lesson Complete!</h1>
          <p className="text-slate-400 mt-2 text-lg">Great work, {updatedStudent.name}</p>
        </div>

        {/* Score card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Your Score</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-emerald-400">{accuracy}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Accuracy</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-white">{correctCount}<span className="text-slate-500 text-sm">/{totalQuestions}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">Correct</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-amber-400">⭐{starsEarned}</p>
              <p className="text-xs text-slate-500 mt-0.5">Stars Earned</p>
            </div>
          </div>
        </div>

        {/* Word updates */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Word Updates</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-2xl font-bold text-emerald-400">{knownCount}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Known</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-2xl font-bold text-amber-400">{learningCount}</p>
              <p className="text-xs text-amber-600 mt-0.5">Learning</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-slate-400">{dontKnowCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Keep Trying</p>
            </div>
          </div>
        </div>

        {/* Stars */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Stars Earned</p>
          <div className="flex justify-around items-center">
            <StarDisplay count={updatedStudent.streakStars} label="Streak" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Performance</span>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl text-amber-400">★</span>
                  <span className="text-lg font-bold text-amber-400">+{starsEarned}</span>
                  <span className="text-slate-500 text-sm">lesson</span>
                </div>
                {streakBonus > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl text-red-400">❤️</span>
                    <span className="text-lg font-bold text-red-400">+{streakBonus}</span>
                    <span className="text-slate-500 text-sm">streak bonus</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-500">Total: {updatedStudent.performanceStars}</span>
            </div>
          </div>
        </div>

        {/* Level up */}
        {leveledUp && updatedStudent.currentLevel && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 text-center">
            <p className="text-3xl mb-2">🏆</p>
            <h2 className="text-xl font-bold text-amber-400">Level Up!</h2>
            <p className="text-amber-300/70 mt-1 text-sm">You advanced to Level {updatedStudent.currentLevel}</p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={handleBackToDashboard}
          className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 text-base font-bold text-white transition-colors shadow-lg shadow-indigo-900/30"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
