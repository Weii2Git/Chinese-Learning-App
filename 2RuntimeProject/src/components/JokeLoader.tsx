"use client";

import { useState, useEffect } from "react";

const JOKES = [
  "Why did the student eat his homework? Because the teacher told him it was a piece of cake! 🎂",
  "What do you call a fish without eyes? A fsh! 🐟",
  "Why can't Elsa have a balloon? Because she'll let it go! 🎈",
  "What do you call a sleeping dinosaur? A dino-snore! 🦕",
  "Why did the math book look so sad? Because it had too many problems! 📚",
  "What do you call cheese that isn't yours? Nacho cheese! 🧀",
  "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
  "Why don't scientists trust atoms? Because they make up everything! ⚛️",
  "What do you call a lazy kangaroo? A pouch potato! 🦘",
  "Why did the bicycle fall over? Because it was two-tired! 🚲",
  "What do you call a snowman with a six-pack? An abdominal snowman! ⛄",
  "Why did the golfer bring extra pants? In case he got a hole in one! ⛳",
  "What do you call a factory that makes okay products? A satisfactory! 🏭",
  "Why did the student bring a ladder to school? Because she wanted to go to high school! 🪜",
  "What do you call a pig that does karate? A pork chop! 🥋",
  "Why did the cookie go to the doctor? Because it was feeling crummy! 🍪",
  "What do you call a dog magician? A labracadabrador! 🐕",
  "Why did the banana go to the doctor? Because it wasn't peeling well! 🍌",
  "What do you call a sleeping bull? A bulldozer! 🐂",
];

interface JokeLoaderProps {
  title: string;
  subtitle?: string;
}

export function JokeLoader({ title, subtitle }: JokeLoaderProps) {
  const [jokeIndex, setJokeIndex] = useState(() => Math.floor(Math.random() * JOKES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setVisible(false);
      setTimeout(() => {
        setJokeIndex((i) => (i + 1) % JOKES.length);
        setVisible(true);
      }, 400);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mb-6">{subtitle}</p>}

        {/* Joke section */}
        <div className="mt-4 rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">While you wait... 😄</p>
          <p
            className="text-slate-300 text-sm leading-relaxed transition-opacity duration-400"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {JOKES[jokeIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
