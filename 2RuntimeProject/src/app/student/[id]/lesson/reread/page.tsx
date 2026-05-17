"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLessonContext } from "@/lib/lesson-context";
import { StoryDisplay } from "@/components/StoryDisplay";
import { QuestionCard } from "@/components/QuestionCard";
import { buildTest } from "@/lib/question-generator";
import { QUESTION_TIMER_MS, QUICK_THRESHOLD_MS } from "@/lib/constants";
import type { ComprehensionQuestion, Question, QuestionResult, Word } from "@/lib/types";

type Phase = "reread" | "loading" | "questions" | "error";
const RETEST_PASS_THRESHOLD = 0.8;

export default function RereadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lessonState, incrementComprehensionLoop, addResult, markNewRoundStart } = useLessonContext();

  const [phase, setPhase] = useState<Phase>("reread");
  const [error, setError] = useState<string | null>(null);
  const [retestQuestions, setRetestQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [loopAnswers, setLoopAnswers] = useState<QuestionResult[]>([]);
  const questionStartRef = useRef<number>(performance.now());
  const studentId = params.id;

  const incorrectVocabWords = useMemo((): Word[] => {
    if (!lessonState) return [];
    const incorrectWordIds = new Set<string>();
    for (const result of lessonState.results) {
      if (result.question.kind === "vocab" && !result.isCorrect) incorrectWordIds.add(result.question.data.wordId);
    }
    return [...lessonState.newWords, ...lessonState.reviewWords].filter((w) => incorrectWordIds.has(w.id));
  }, [lessonState]);

  const getPreviousQuestions = useCallback((): string[] => {
    if (!lessonState) return [];
    return lessonState.results
      .filter((r) => r.question.kind === "comprehension")
      .map((r) => r.question.kind === "comprehension" ? r.question.data.question : "")
      .filter((q) => q.length > 0);
  }, [lessonState]);

  const fetchAndBuildRetest = useCallback(async () => {
    if (!lessonState) return;
    setPhase("loading");
    setError(null);
    try {
      const level = lessonState.newWords[0]?.level || lessonState.reviewWords[0]?.level || "1-a";
      const res = await fetch("/api/generate-comprehension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: lessonState.story, level, previousQuestions: getPreviousQuestions() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate comprehension questions");
      }
      const { questions: comprehensionQs } = (await res.json()) as { questions: ComprehensionQuestion[] };
      const allWords = [...lessonState.newWords, ...lessonState.reviewWords];
      const incorrectIds = new Set(incorrectVocabWords.map((w) => w.id));
      const otherWords = allWords.filter((w) => !incorrectIds.has(w.id));
      const reorderedNew = [...incorrectVocabWords, ...otherWords.filter((w) => lessonState.newWords.some((nw) => nw.id === w.id))];
      const reorderedReview = otherWords.filter((w) => lessonState.reviewWords.some((rw) => rw.id === w.id));
      const allRetestQuestions = buildTest(reorderedNew, reorderedReview, comprehensionQs, lessonState.segmentedStory, lessonState.wordMeanings);
      setRetestQuestions(allRetestQuestions);
      setCurrentIndex(0);
      setLoopAnswers([]);
      setQuestionKey((k) => k + 1);
      setPhase("questions");
      markNewRoundStart(); // mark where this retest round starts
      questionStartRef.current = performance.now();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setPhase("error");
    }
  }, [lessonState, getPreviousQuestions, incorrectVocabWords]);

  const handleAnswer = useCallback((selectedAnswer: string | null) => {
    const elapsedMs = performance.now() - questionStartRef.current;
    const currentQuestion = retestQuestions[currentIndex];
    if (!currentQuestion) return;
    const isCorrect = selectedAnswer === currentQuestion.data.correctAnswer;
    const result: QuestionResult = { question: currentQuestion, selectedAnswer, isCorrect, elapsedMs, isQuick: isCorrect && elapsedMs <= QUICK_THRESHOLD_MS };
    addResult(result);
    setLoopAnswers((prev) => [...prev, result]);
  }, [currentIndex, retestQuestions, addResult]);

  const handleConfirm = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= retestQuestions.length) {
      const correctCount = loopAnswers.filter((r) => r.isCorrect).length;
      const accuracy = loopAnswers.length > 0 ? correctCount / loopAnswers.length : 0;
      if (accuracy >= RETEST_PASS_THRESHOLD) {
        router.push(`/student/${studentId}/lesson/summary`);
      } else {
        incrementComprehensionLoop();
        setPhase("reread");
      }
    } else {
      setCurrentIndex(nextIndex);
      setQuestionKey((k) => k + 1);
      questionStartRef.current = performance.now();
    }
  }, [currentIndex, retestQuestions, loopAnswers, router, studentId, incrementComprehensionLoop]);

  if (!lessonState || !lessonState.story) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <h2 className="text-lg font-bold text-white mb-3">No lesson in progress</h2>
          <button onClick={() => router.push(`/student/${studentId}`)} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors">
            Go to Dashboard
          </button>
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
          <button onClick={fetchAndBuildRetest} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Preparing your retest...</h2>
        </div>
      </div>
    );
  }

  if (phase === "reread") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
        <div className="w-full max-w-3xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 text-sm font-semibold text-amber-400 mb-5">
              Review Round {lessonState.comprehensionLoopCount + 1}
            </div>
            <h1 className="text-3xl font-bold text-white">Let&apos;s Review</h1>
            <p className="text-slate-400 text-base mt-2">Re-read the story — you need 80% accuracy to pass</p>
          </div>

          {incorrectVocabWords.length > 0 && (
            <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
              <p className="text-sm text-amber-300">
                Pay attention to: <span className="font-bold">{incorrectVocabWords.map((w) => w.character).join("、")}</span>
              </p>
            </div>
          )}

          <StoryDisplay
            story={lessonState.story}
            segmentedStory={lessonState.segmentedStory || ""}
            newWords={lessonState.newWords}
            allWords={[...lessonState.newWords, ...lessonState.reviewWords]}
            wordMeanings={lessonState.wordMeanings}
          />

          <div className="mt-10">
            <button onClick={fetchAndBuildRetest} className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-5 text-xl font-bold text-white transition-colors">
              Ready for Questions →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = retestQuestions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-3xl font-bold text-white">Retest</h1>
            <span className="text-base text-slate-500">{currentIndex + 1} / {retestQuestions.length} · 80% to pass</span>
          </div>
          <div className="flex gap-1.5">
            {retestQuestions.map((_, i) => {
              const result = loopAnswers[i];
              let color = "bg-slate-800";
              if (i === currentIndex) color = "bg-indigo-500";
              else if (result) color = result.isCorrect ? "bg-emerald-500" : "bg-red-500";
              return <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${color}`} />;
            })}
          </div>
        </div>

        <QuestionCard key={questionKey} question={currentQuestion} timerMs={QUESTION_TIMER_MS} onAnswer={handleAnswer} requireConfirm onConfirm={handleConfirm} />
      </div>
    </div>
  );
}
