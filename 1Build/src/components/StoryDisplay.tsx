"use client";

import { useState, useCallback, useMemo } from "react";
import type { Word } from "@/lib/types";
import { WordPopup } from "./WordPopup";

interface StoryDisplayProps {
  story: string;
  segmentedStory: string;
  newWords: Word[];
  allWords: Word[];
  onWordLookup?: (word: string) => void;
  wordMeanings?: Record<string, string>;
}

export function StoryDisplay({ story, segmentedStory, newWords, onWordLookup, wordMeanings }: StoryDisplayProps) {
  const [popup, setPopup] = useState<{ text: string; position: { x: number; y: number } } | null>(null);

  const newWordChars = useMemo(() => new Set(newWords.map((w) => w.character)), [newWords]);

  const handleWordClick = useCallback(
    (e: React.MouseEvent, segment: string) => {
      e.preventDefault();
      setPopup({ text: segment, position: { x: e.clientX, y: e.clientY } });
      if (onWordLookup) onWordLookup(segment);
    },
    [onWordLookup]
  );

  const isChinese = (char: string) => {
    const code = char.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9fff;
  };

  const containsNewChar = (segment: string) => {
    for (const char of segment) {
      if (newWordChars.has(char)) return true;
    }
    return false;
  };

  const getWords = (): string[] => {
    if (!segmentedStory) return [...story];
    return segmentedStory.split("/").filter((w) => w.length > 0);
  };

  const renderStory = () => {
    const words = getWords();
    return words.map((segment, i) => {
      // Render newlines as paragraph breaks
      if (segment === "\n" || segment === "\\n" || segment.trim() === "") {
        return <br key={i} />;
      }

      const hasChinese = [...segment].some(isChinese);
      if (!hasChinese) return <span key={i}>{segment}</span>;

      const isNew = containsNewChar(segment);
      return (
        <span
          key={i}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            isNew
              ? "bg-amber-500/20 text-amber-300 font-semibold hover:bg-amber-500/30"
              : "hover:bg-slate-700 hover:text-white"
          }`}
          onClick={(e) => handleWordClick(e, segment)}
          onContextMenu={(e) => handleWordClick(e, segment)}
        >
          {segment}
        </span>
      );
    });
  };

  return (
    <div className="relative">
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-2xl leading-relaxed tracking-wide text-slate-200">
        {renderStory()}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 font-bold text-xs">新</span>
          New character
        </span>
        <span>Click any word for pinyin, meaning &amp; pronunciation</span>
      </div>

      {popup && (
        <WordPopup
          text={popup.text}
          position={popup.position}
          onClose={() => setPopup(null)}
          wordMeanings={wordMeanings}
        />
      )}
    </div>
  );
}
