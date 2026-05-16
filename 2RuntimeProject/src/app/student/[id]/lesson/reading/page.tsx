"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLessonContext } from "@/lib/lesson-context";
import { StoryDisplay } from "@/components/StoryDisplay";
import Link from "next/link";
import type { Word } from "@/lib/types";

type PagePhase = "init" | "loading-words" | "loading-story" | "done" | "error";

export default function ReadingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lessonState, initLesson, setWords, setStory, resetLesson, addLookedUpWord } = useLessonContext();

  const [phase, setPhase] = useState<PagePhase>("init");
  const [error, setError] = useState<string | null>(null);
  const [allWords, setAllWords] = useState<Word[]>([]);

  const studentId = params.id;
  const fetchingRef = useRef(false);
  const currentStudentRef = useRef<string | null>(null);

  useEffect(() => {
    if (lessonState && lessonState.studentId !== studentId) {
      resetLesson();
      fetchingRef.current = false;
      currentStudentRef.current = null;
      setPhase("init");
      return;
    }
    if (!lessonState && currentStudentRef.current !== studentId) {
      currentStudentRef.current = studentId;
      initLesson(studentId);
      return;
    }
    if (lessonState && lessonState.studentId === studentId) {
      if (lessonState.story) {
        setAllWords([...lessonState.newWords, ...lessonState.reviewWords]);
        setPhase("done");
        return;
      }
      if (!fetchingRef.current) {
        fetchingRef.current = true;
        fetchAndGenerate();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonState, studentId]);

  const fetchAndGenerate = useCallback(async () => {
    setError(null);
    setPhase("loading-words");
    try {
      const wordsRes = await fetch(`/api/words/selection?studentId=${encodeURIComponent(studentId)}`);
      if (!wordsRes.ok) {
        const data = await wordsRes.json();
        throw new Error(data.error || "Failed to fetch word selections");
      }
      const { newWords, reviewWords } = (await wordsRes.json()) as { newWords: Word[]; reviewWords: Word[] };
      setWords(newWords, reviewWords);
      setAllWords([...newWords, ...reviewWords]);
      setPhase("loading-story");

      const storyRes = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newWords, knownWords: reviewWords, level: newWords[0]?.level || reviewWords[0]?.level || "1-a" }),
      });
      if (!storyRes.ok) {
        const data = await storyRes.json();
        throw new Error(data.error || "Failed to generate story");
      }
      const { story, segmented, wordMeanings } = (await storyRes.json()) as { story: string; segmented: string; wordMeanings?: Record<string, string> };
      setStory(story, segmented || "", wordMeanings || {});
      setPhase("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setPhase("error");
      fetchingRef.current = false;
    }
  }, [studentId, setWords, setStory]);

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => { fetchingRef.current = false; initLesson(studentId); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors">
              Retry
            </button>
            <Link href={`/student/${studentId}`} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "init" || phase === "loading-words") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Selecting words for your lesson...</h2>
          <p className="mt-2 text-slate-500 text-sm">This will just take a moment</p>
        </div>
      </div>
    );
  }

  if (phase === "loading-story") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Generating your story...</h2>
          <p className="mt-2 text-slate-500 text-sm">Creating a story with your new words</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href={`/student/${studentId}`} className="text-slate-500 hover:text-slate-300 text-base transition-colors flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Dashboard
          </Link>
          <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Reading</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Reading Time</h1>
          <p className="text-slate-400 text-base mt-2">Click any character for pinyin, meaning &amp; pronunciation</p>
        </div>

        <StoryDisplay
          story={lessonState?.story || ""}
          segmentedStory={lessonState?.segmentedStory || ""}
          newWords={lessonState?.newWords || []}
          allWords={allWords}
          onWordLookup={addLookedUpWord}
          wordMeanings={lessonState?.wordMeanings}
        />

        <div className="mt-10">
          <button
            onClick={() => router.push(`/student/${studentId}/lesson/test`)}
            className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-5 text-xl font-bold text-white transition-colors shadow-lg shadow-indigo-900/30"
          >
            Finished Reading →
          </button>
        </div>
      </div>
    </div>
  );
}
