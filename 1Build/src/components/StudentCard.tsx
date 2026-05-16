import Link from "next/link";
import Image from "next/image";
import type { Student } from "@/lib/types";

const PLAYER_COLORS: Record<string, { accent: string; ring: string }> = {
  "Patrick":        { accent: "from-green-500 to-green-700",  ring: "ring-green-500" },
  "Ryan":           { accent: "from-red-500 to-red-700",      ring: "ring-red-500" },
  "Cony Da Banana": { accent: "from-blue-500 to-blue-700",    ring: "ring-blue-500" },
  "Mommy":          { accent: "from-purple-500 to-purple-700", ring: "ring-purple-500" },
};

const DEFAULT_COLOR = { accent: "from-slate-500 to-slate-700", ring: "ring-slate-500" };

const PLAYER_IMAGES: Record<string, string> = {
  "Patrick":        "/assets/characters/char_patrick.png",
  "Ryan":           "/assets/characters/char_ryan.png",
  "Cony Da Banana": "/assets/characters/char_cony.png",
  "Mommy":          "/assets/characters/char_mommy.png",
};

// Per-character display scale relative to the base 72px size
const PLAYER_SCALE: Record<string, number> = {
  "Mommy":   2.0,  // +100%
  "Patrick": 1.2,  // +20%
  "Ryan":    1.5,  // +50%
};

export function StudentCard({ student }: { student: Student }) {
  const colors = PLAYER_COLORS[student.name] || DEFAULT_COLOR;
  const characterImg = PLAYER_IMAGES[student.name] || "/assets/characters/char_patrick.png";
  const scale = PLAYER_SCALE[student.name] ?? 1;
  const baseSize = 72;
  const imgSize = Math.round(baseSize * scale);

  return (
    <Link
      href={`/student/${student.id}`}
      className="group block rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Accent top bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${colors.accent}`} />

      <div className="p-6 flex items-center gap-5">
        {/* Avatar */}
        <div className={`shrink-0 w-20 h-20 rounded-xl bg-slate-800 ring-2 ${colors.ring} ring-offset-2 ring-offset-slate-900 flex items-center justify-center overflow-hidden`}>
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-xl truncate">{student.name}</h2>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`inline-block text-base font-bold text-white bg-gradient-to-r ${colors.accent} px-4 py-1.5 rounded-full`}>
              Level {student.currentLevel}
            </span>
            <span className="flex items-center gap-1.5 text-base text-slate-300">
              <Image src="/assets/icons/heart.png" alt="heart" width={22} height={22} unoptimized style={{ imageRendering: "pixelated" }} />
              ×{student.streakStars}
            </span>
            <span className="flex items-center gap-1.5 text-base text-slate-300">
              <Image src="/assets/icons/star.png" alt="star" width={22} height={22} unoptimized style={{ imageRendering: "pixelated" }} />
              ×{student.performanceStars}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </Link>
  );
}
