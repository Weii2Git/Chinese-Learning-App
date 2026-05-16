"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface WordPopupProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
  wordMeanings?: Record<string, string>;
}

export function WordPopup({ text, position, onClose, wordMeanings }: WordPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pinyin, setPinyin] = useState<string | null>(null);
  const [english, setEnglish] = useState<string | null>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    setEnglish(null);
    import("pinyin-pro").then(({ pinyin: pinyinFn }) => {
      try {
        const result = pinyinFn(text, { toneType: "symbol", type: "string" });
        setPinyin(result || "—");
      } catch {
        setPinyin("—");
      }
    }).catch(() => setPinyin("—"));

    const localMeaning = wordMeanings?.[text];
    if (localMeaning) {
      setEnglish(localMeaning);
    } else {
      fetch(`/api/words/lookup?text=${encodeURIComponent(text)}`)
        .then((res) => res.json())
        .then((data) => setEnglish(data.english || "—"))
        .catch(() => setEnglish("—"));
    }
  }, [text, wordMeanings]);

  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  const handlePronounce = () => {
    if (!hasSpeechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-4 min-w-[160px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, 8px)",
      }}
    >
      <div className="mb-2 text-center text-3xl font-bold text-white">{text}</div>

      <div className="mb-1 text-center text-base text-indigo-400 font-medium">
        {pinyin === null ? (
          <span className="text-slate-600 animate-pulse">· · ·</span>
        ) : pinyin}
      </div>

      <div className="mb-3 text-center text-sm text-slate-400">
        {english === null ? (
          <span className="text-slate-600 animate-pulse">translating...</span>
        ) : english}
      </div>

      {hasSpeechSynthesis && (
        <button
          onClick={handlePronounce}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition-colors"
        >
          🔊 Pronounce
        </button>
      )}
    </div>
  );
}
