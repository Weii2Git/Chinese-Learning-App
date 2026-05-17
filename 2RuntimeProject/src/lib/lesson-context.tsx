"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { LessonState, Word, Question, QuestionResult } from "./types";

const SESSION_STORAGE_KEY = "lesson-state";

interface LessonContextValue {
  lessonState: LessonState | null;
  setStory: (story: string, segmented: string, wordMeanings?: Record<string, string>) => void;
  setWords: (newWords: Word[], reviewWords: Word[]) => void;
  setQuestions: (questions: Question[]) => void;
  addResult: (result: QuestionResult) => void;
  setStudentId: (studentId: string) => void;
  incrementComprehensionLoop: () => void;
  addLookedUpWord: (word: string) => void;
  resetLesson: () => void;
  initLesson: (studentId: string) => void;
  markNewRoundStart: () => void;
}

const LessonContext = createContext<LessonContextValue | null>(null);

function loadFromSessionStorage(): LessonState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as LessonState;
    }
  } catch {
    // If parsing fails, clear corrupted data
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return null;
}

function saveToSessionStorage(state: LessonState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (state) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Silently fail if sessionStorage is full or unavailable
  }
}

export function LessonProvider({ children }: { children: React.ReactNode }) {
  const [lessonState, setLessonState] = useState<LessonState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load from sessionStorage on initial mount
  useEffect(() => {
    const stored = loadFromSessionStorage();
    if (stored) {
      setLessonState(stored);
    }
    setHydrated(true);
  }, []);

  // Persist to sessionStorage on every update (after hydration)
  useEffect(() => {
    if (hydrated) {
      saveToSessionStorage(lessonState);
    }
  }, [lessonState, hydrated]);

  const setStory = useCallback((story: string, segmented: string, wordMeanings?: Record<string, string>) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, story, segmentedStory: segmented, wordMeanings: wordMeanings ?? {} };
    });
  }, []);

  const setWords = useCallback((newWords: Word[], reviewWords: Word[]) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, newWords, reviewWords };
    });
  }, []);

  const setQuestions = useCallback((questions: Question[]) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, questions };
    });
  }, []);

  const addResult = useCallback((result: QuestionResult) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, results: [...prev.results, result] };
    });
  }, []);

  const setStudentId = useCallback((studentId: string) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, studentId };
    });
  }, []);

  const incrementComprehensionLoop = useCallback(() => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, comprehensionLoopCount: prev.comprehensionLoopCount + 1 };
    });
  }, []);

  const addLookedUpWord = useCallback((word: string) => {
    setLessonState((prev) => {
      if (!prev) return prev;
      if (prev.lookedUpWords.includes(word)) return prev;
      return { ...prev, lookedUpWords: [...prev.lookedUpWords, word] };
    });
  }, []);

  const markNewRoundStart = useCallback(() => {
    setLessonState((prev) => {
      if (!prev) return prev;
      return { ...prev, lastRoundStartIndex: prev.results.length };
    });
  }, []);

  const resetLesson = useCallback(() => {
    setLessonState(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const initLesson = useCallback((studentId: string) => {
    const newState: LessonState = {
      studentId,
      story: "",
      segmentedStory: "",
      wordMeanings: {},
      newWords: [],
      reviewWords: [],
      questions: [],
      results: [],
      comprehensionLoopCount: 0,
      lookedUpWords: [],
      lastRoundStartIndex: 0,
    };
    setLessonState(newState);
  }, []);

  const value: LessonContextValue = {
    lessonState,
    setStory,
    setWords,
    setQuestions,
    addResult,
    setStudentId,
    incrementComprehensionLoop,
    addLookedUpWord,
    resetLesson,
    initLesson,
    markNewRoundStart,
  };

  return (
    <LessonContext.Provider value={value}>{children}</LessonContext.Provider>
  );
}

export function useLessonContext(): LessonContextValue {
  const context = useContext(LessonContext);
  if (!context) {
    throw new Error("useLessonContext must be used within a LessonProvider");
  }
  return context;
}
