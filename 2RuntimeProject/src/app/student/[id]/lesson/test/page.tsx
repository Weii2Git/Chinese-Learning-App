"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLessonContext } from "@/lib/lesson-context";
import { QuestionCard } from "@/components/QuestionCard";
import { buildTest } from "@/lib/question-generator";
import { QUESTION_TIMER_MS, QUICK_THRESHOLD_MS } from "@/lib/constants";
import type { Question, QuestionResult, ComprehensionQuestion } from "@/lib/types";

type TestPhase = "loading" | "ready" | "error";

export default function TestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lessonState, setQuestions, addResult } = useLessonContext();

  const [phase, setPhase] = useState<TestPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);

  const questionStartRef = useRef<number>(performance.now());
  const questionsRef = useRef<Question[]>([]);
  const resultsRef = useRef<QuestionResult[]>([]);
  const latestResultRef = useRef<QuestionResult | null>(null);
  const studentId = params.id;

  const buildFullTest = useCallback(async () => {
    if (!lessonState) return;
    const { newWords, reviewWords, story } = lessonState;
    if (questionsRef.current.length > 0) return;

    if (lessonState.questions.length > 0) {
      questionsRef.current = lessonState.questions;
      setCurrentIndex(lessonState.results.length);
      resultsRef.current = [...lessonState.results];
      setPhase("ready");
      return;
    }

    setPhase("loading");
    setError(null);

    try {
      const level = newWords[0]?.level || reviewWords[0]?.level || "1-a";
      const res = await fetch("/api/generate-comprehension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, level }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate comprehension questions");
      }
      const { questions: comprehensionQuestions } = (await res.json()) as { questions: ComprehensionQuestion[] };
      const fullTest = buildTest(newWords, reviewWords, comprehensionQuestions, lessonState?.segmentedStory, lessonState?.wordMeanings, lessonState?.lookedUpWords);
      questionsRef.current = fullTest;
      setQuestions(fullTest);
      setPhase("ready");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setPhase("error");
    }
  }, [lessonState, setQuestions]);

  useEffect(() => {
    if (lessonState?.studentId === studentId) buildFullTest();
  }, [lessonState?.studentId, studentId, buildFullTest]);

  useEffect(() => {
    if (phase === "ready") questionStartRef.current = performance.now();
  }, [phase, currentIndex]);

  const handleAnswer = useCallback((selectedAnswer: string | null) => {
    const elapsedMs = performance.now() - questionStartRef.current;
    const currentQuestion = questionsRef.current[currentIndex];
    if (!currentQuestion) return;
    const correctAnswer = currentQuestion.data.correctAnswer;
    const isCorrect = selectedAnswer === correctAnswer;
    const result: QuestionResult = { question: currentQuestion, selectedAnswer, isCorrect, elapsedMs, isQuick: isCorrect && elapsedMs <= QUICK_THRESHOLD_MS };
    addResult(result);
    resultsRef.current = [...resultsRef.current, result];
    latestResultRef.current = result;
  }, [currentIndex, addResult]);

  const handleConfirm = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questionsRef.current.length) {
      const correctCount = resultsRef.current.filter((r) => r.isCorrect).length;
      const accuracy = resultsRef.current.length > 0 ? correctCount / resultsRef.current.length : 0;
      router.push(accuracy < 0.8 ? `/student/${studentId}/lesson/reread` : `/student/${studentId}/lesson/summary`);
    } else {
      setCurrentIndex(nextIndex);
      setQuestionKey((k) => k + 1);
    }
  }, [currentIndex, router, studentId]);

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button onClick={buildFullTest} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Preparing your test...</h2>
          <p className="mt-2 text-slate-500 text-sm">Generating questions based on your reading</p>
        </div>
      </div>
    );
  }

  const totalQuestions = questionsRef.current.length;
  const currentQuestion = questionsRef.current[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-3xl font-bold text-white">Test Time</h1>
            <span className="text-base text-slate-500">{currentIndex + 1} / {totalQuestions}</span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalQuestions }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i < currentIndex ? "bg-emerald-500" : i === currentIndex ? "bg-indigo-500" : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>

        <QuestionCard
          key={questionKey}
          question={currentQuestion}
          timerMs={QUESTION_TIMER_MS}
          onAnswer={handleAnswer}
          requireConfirm
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
