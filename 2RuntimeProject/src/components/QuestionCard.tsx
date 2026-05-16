"use client";

import { useState, useRef, useEffect } from "react";
import type { Question } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  timerMs: number;
  onAnswer: (selectedAnswer: string | null) => void;
  requireConfirm?: boolean;
  onConfirm?: () => void;
}

export function QuestionCard({ question, onAnswer, onConfirm }: QuestionCardProps) {
  const [selectedPinyin, setSelectedPinyin] = useState<string | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [pinyinCorrect, setPinyinCorrect] = useState(false);
  const [meaningCorrect, setMeaningCorrect] = useState(false);
  const checkedRef = useRef(false);

  const [selectedComprehension, setSelectedComprehension] = useState<string | null>(null);
  const [comprehensionChecked, setComprehensionChecked] = useState(false);

  useEffect(() => {
    setSelectedPinyin(null);
    setSelectedMeaning(null);
    setChecked(false);
    setPinyinCorrect(false);
    setMeaningCorrect(false);
    checkedRef.current = false;
    setSelectedComprehension(null);
    setComprehensionChecked(false);
  }, [question]);

  if (question.kind === "vocab") {
    const { character, correctPinyin, correctMeaning } = question.data;
    const pinyinOptions = question.data.pinyinOptions || [correctPinyin];
    const meaningOptions = question.data.meaningOptions || [correctMeaning];

    const handleCheck = () => {
      if (checkedRef.current || !selectedPinyin || !selectedMeaning) return;
      checkedRef.current = true;
      const isPinyinCorrect = selectedPinyin === correctPinyin;
      const isMeaningCorrect = selectedMeaning === correctMeaning;
      setPinyinCorrect(isPinyinCorrect);
      setMeaningCorrect(isMeaningCorrect);
      setChecked(true);
      const isCorrect = isPinyinCorrect && isMeaningCorrect;
      onAnswer(isCorrect ? `${correctPinyin}|${correctMeaning}` : null);
      if (isCorrect && onConfirm) onConfirm();
    };

    const getPinyinStyle = (option: string) => {
      const base = "w-full rounded-lg px-4 py-3.5 text-base font-medium transition-all border text-left";
      if (!checked) {
        return option === selectedPinyin
          ? `${base} border-indigo-500 bg-indigo-500/20 text-indigo-300`
          : `${base} border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700`;
      }
      if (option === correctPinyin) return `${base} border-emerald-500 bg-emerald-500/20 text-emerald-300`;
      if (option === selectedPinyin) return `${base} border-red-500 bg-red-500/20 text-red-300`;
      return `${base} border-slate-800 bg-slate-900 text-slate-600`;
    };

    const getMeaningStyle = (option: string) => {
      const base = "w-full rounded-lg px-4 py-3.5 text-base font-medium transition-all border text-left";
      if (!checked) {
        return option === selectedMeaning
          ? `${base} border-indigo-500 bg-indigo-500/20 text-indigo-300`
          : `${base} border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700`;
      }
      if (option === correctMeaning) return `${base} border-emerald-500 bg-emerald-500/20 text-emerald-300`;
      if (option === selectedMeaning) return `${base} border-red-500 bg-red-500/20 text-red-300`;
      return `${base} border-slate-800 bg-slate-900 text-slate-600`;
    };

    const bothSelected = selectedPinyin !== null && selectedMeaning !== null;
    const allCorrect = checked && pinyinCorrect && meaningCorrect;
    const anyWrong = checked && (!pinyinCorrect || !meaningCorrect);

    return (
      <div className="w-full">
        {/* Character */}
        <div className="mb-8 rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="text-8xl font-bold text-white mb-3">{character}</div>
          <p className="text-base text-slate-500">Select the correct pinyin and meaning</p>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 text-center">Pinyin</p>
            <div className="flex flex-col gap-3">
              {pinyinOptions.map((option, i) => (
                <button key={i} onClick={() => !checked && setSelectedPinyin(option)} disabled={checked} className={getPinyinStyle(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 text-center">Meaning</p>
            <div className="flex flex-col gap-3">
              {meaningOptions.map((option, i) => (
                <button key={i} onClick={() => !checked && setSelectedMeaning(option)} disabled={checked} className={getMeaningStyle(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {bothSelected && !checked && (
          <button onClick={handleCheck} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 text-lg font-semibold text-white transition-colors">
            Check Answer
          </button>
        )}

        {checked && (
          <div className="mt-2">
            {allCorrect && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center mb-4">
                <p className="text-xl font-bold text-emerald-400">✓ Correct!</p>
              </div>
            )}
            {anyWrong && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-5 text-center mb-4">
                <p className="text-base text-slate-400 mb-3">Correct answer:</p>
                <div className="flex justify-center gap-8">
                  <div>
                    <p className="text-sm text-slate-500">Pinyin</p>
                    <p className="text-xl font-bold text-emerald-400">{correctPinyin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Meaning</p>
                    <p className="text-xl font-bold text-emerald-400">{correctMeaning}</p>
                  </div>
                </div>
              </div>
            )}
            <button onClick={() => onConfirm && onConfirm()} className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 px-6 py-4 text-lg font-semibold text-white transition-colors">
              Next →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Comprehension question
  const handleComprehensionClick = (option: string) => {
    if (comprehensionChecked) return;
    setSelectedComprehension(option);
    setComprehensionChecked(true);
    onAnswer(option === question.data.correctAnswer ? option : null);
  };

  const getComprehensionStyle = (option: string) => {
    const base = "w-full rounded-xl px-5 py-4 text-left text-base font-medium transition-all border";
    if (!comprehensionChecked) {
      return `${base} border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700 cursor-pointer`;
    }
    if (option === question.data.correctAnswer) return `${base} border-emerald-500 bg-emerald-500/20 text-emerald-300`;
    if (option === selectedComprehension) return `${base} border-red-500 bg-red-500/20 text-red-300`;
    return `${base} border-slate-800 bg-slate-900 text-slate-600`;
  };

  const comprehensionWrong = comprehensionChecked && selectedComprehension !== question.data.correctAnswer;

  return (
    <div className="w-full">
      <div className="mb-8 rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <p className="text-lg text-slate-200 leading-relaxed">{question.data.question}</p>
      </div>

      <div className="flex flex-col gap-3">
        {question.data.options.map((option, i) => (
          <button key={i} onClick={() => handleComprehensionClick(option)} disabled={comprehensionChecked} className={getComprehensionStyle(option)}>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300 mr-3">
              {String.fromCharCode(65 + i)}
            </span>
            {option}
          </button>
        ))}
      </div>

      {comprehensionChecked && (
        <div className="mt-4">
          {comprehensionWrong ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center mb-3">
              <p className="text-sm text-slate-400">Correct answer:</p>
              <p className="font-bold text-emerald-400 mt-1">{question.data.correctAnswer}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center mb-3">
              <p className="font-bold text-emerald-400">✓ Correct!</p>
            </div>
          )}
          <button onClick={() => onConfirm && onConfirm()} className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 px-6 py-3 font-semibold text-white transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
