import Link from "next/link";
import Image from "next/image";
import type { Student } from "@/lib/types";

const PLAYER_COLORS: Record<string, { accent: string; ring: string }> = {
  "Patrick":        { accent: "from-green-500 to-green-700",   ring: "ring-green-500" },
  "Ryan":           { accent: "from-red-500 to-red-700",       ring: "ring-red-500" },
  "Cony Da Banana": { accent: "from-blue-500 to-blue-700",     ring: "ring-blue-500" },
  "Mommy":          { accent: "from-purple-500 to-purple-700", ring: "ring-purple-500" },
  "Gala":           { accent: "from-teal-500 to-teal-700",     ring: "ring-teal-500" },
  "Jonathan":       { accent: "from-orange-500 to-orange-700", ring: "ring-orange-500" },
};

const DEFAULT_COLOR = { accent: "from-slate-500 to-slate-700", ring: "ring-slate-500" };

const PLAYER_IMAGES: Record<string, string> = {
  "Patrick":        "/assets/characters/char_patrick.png",
  "Ryan":           "/assets/characters/char_ryan.png",
  "Cony Da Banana": "/assets/characters/char_cony.png",
  "Mommy":          "/assets/characters/char_mommy.png",
  "Gala":           "/assets/characters/char_Gala.png",
  "Jonathan":       "/assets/characters/char_Jonathan.png",
};

const PLAYER_SCALE: Record<string, number> = {
  "Mommy":   2.0,
  "Patrick": 1.2,
  "Ryan":    1.5,
};

function getTodaySingapore(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

export function StudentCard({ student }: { student: Student }) {
  const colors = PLAYER_COLORS[student.name] || DEFAULT_COLOR;
  const characterImg = PLAYER_IMAGES[student.name] || "/assets/characters/char_patrick.png";
  const scale = PLAYER_SCALE[student.name] ?? 1;
  const imgSize = Math.round(72 * scale);
  const doneToday = student.lastActiveDate === getTodaySingapore();

  return (
    <Link
      href={`/student/${student.id}`}
      className="group block rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Accent top bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${colors.accent}`} />

      <div className="p-5 flex items-start gap-4">
        {/* Left: avatar + level badge stacked */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className={`w-20 h-20 rounded-xl bg-slate-800 ring-2 ${colors.ring} ring-offset-2 ring-offset-slate-900 flex items-center justify-center overflow-hidden`}>
            <Image
              src={characterImg}
              alt={student.name}
              width={imgSize}
              height={imgSize}
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          </div>
          {/* Level badge under avatar */}
          <span className={`text-xs font-bold text-white bg-gradient-to-r ${colors.accent} px-3 py-1 rounded-full whitespace-nowrap`}>
            Level {student.currentLevel}
          </span>
        </div>

        {/* Right: name, streak, stats */}
        <div className="flex-1 min-w-0">
          {/* Name + streak */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-white font-bold text-xl truncate">{student.name}</h2>
            <span className={`text-xl font-bold shrink-0 ${doneToday ? "text-orange-400" : "text-slate-500"}`}>
              🔥<span>{student.streakStars}</span>
            </span>
          </div>

          {/* Stats row: heart / star / lessons — evenly spaced */}
          <div className="flex items-center justify-around">
            {/* Heart (Bonus - capped at 5) */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">❤️</span>
              <span className="text-sm font-semibold text-slate-300">{Math.min(student.streakStars, 5)}</span>
            </div>
            {/* Star */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">⭐</span>
              <span className="text-sm font-semibold text-slate-300">{student.performanceStars}</span>
            </div>
            {/* Lessons */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">📖</span>
              <span className="text-sm font-semibold text-slate-300">{student.lessonsCompleted}</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </Link>
  );
}
