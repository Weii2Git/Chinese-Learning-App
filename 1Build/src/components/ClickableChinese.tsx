"use client";

import { useState, useMemo } from "react";
import { WordPopup } from "./WordPopup";

interface ClickableChineseProps {
  /** Raw Chinese text (not pre-segmented). */
  text: string;
  /** Called with each word the user taps, so it can be recorded for review. */
  onWordLookup?: (word: string) => void;
  /** Called with a tapped word's resolved meaning, so it can be stored. */
  onMeaningResolved?: (word: string, meaning: string) => void;
  /** Optional local meaning cache passed through to the popup. */
  wordMeanings?: Record<string, string>;
  /** Optional className for the wrapping text element. */
  className?: string;
}

function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * Segment Chinese text into clickable word units using pinyin-pro. The
 * segmenter is loaded synchronously via require-at-module-eval through a
 * dynamic import cache below; if segmentation isn't available for any reason,
 * we fall back to one span per character.
 */
function useSegments(text: string): string[] {
  return useMemo(() => {
    try {
      // pinyin-pro's segment splits a string into words (multi-char aware).
      // It's a synchronous function once the module is loaded.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { segment } = require("pinyin-pro") as {
        segment?: (t: string) => Array<string | { origin: string }>;
      };
      if (typeof segment === "function") {
        const raw = segment(text);
        const words = raw
          .map((s) => (typeof s === "string" ? s : s?.origin ?? ""))
          .filter((w) => w.length > 0);
        if (words.length > 0) return words;
      }
    } catch {
      // fall through to per-character
    }
    return [...text];
  }, [text]);
}

/**
 * Renders Chinese text where each word is tappable to show a pinyin/meaning
 * popup (reusing WordPopup), and reports taps via onWordLookup so the word can
 * be added to the student's review list. Non-Chinese segments (punctuation,
 * spaces) render as plain text.
 */
export function ClickableChinese({ text, onWordLookup, onMeaningResolved, wordMeanings, className }: ClickableChineseProps) {
  const [popup, setPopup] = useState<{ text: string; position: { x: number; y: number } } | null>(null);
  const segments = useSegments(text);

  const handleClick = (e: React.MouseEvent, segment: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPopup({ text: segment, position: { x: e.clientX, y: e.clientY } });
    if (onWordLookup) onWordLookup(segment);
  };

  return (
    <>
      <p className={className}>
        {segments.map((segment, i) => {
          const hasChinese = [...segment].some(isChinese);
          if (!hasChinese) return <span key={i}>{segment}</span>;
          return (
            <span
              key={i}
              className="cursor-pointer rounded px-0.5 transition-colors hover:bg-slate-700 hover:text-white"
              onClick={(e) => handleClick(e, segment)}
              onContextMenu={(e) => handleClick(e, segment)}
            >
              {segment}
            </span>
          );
        })}
      </p>

      {popup && (
        <WordPopup
          text={popup.text}
          position={popup.position}
          onClose={() => setPopup(null)}
          wordMeanings={wordMeanings}
          onMeaningResolved={onMeaningResolved}
        />
      )}
    </>
  );
}
