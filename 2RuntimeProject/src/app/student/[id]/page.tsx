import Link from "next/link";
import Image from "next/image";
import { getStudent } from "@/lib/student";
import { getKnowledgeSummary } from "@/lib/knowledge";
import { LevelBadge } from "@/components/LevelBadge";
import { StarDisplay } from "@/components/StarDisplay";
import { KnowledgeOverview } from "@/components/KnowledgeOverview";
import { ProgressBar } from "@/components/ProgressBar";
import { checkAndResetStreak } from "@/lib/stars";

const PLAYER_IMAGES: Record<string, string> = {
  "Patrick":        "/assets/characters/char_patrick.png",
  "Ryan":           "/assets/characters/char_ryan.png",
  "Cony Da Banana": "/assets/characters/char_cony.png",
  "Mommy":          "/assets/characters/char_mommy.png",
};

const PLAYER_SCALE: Record<string, number> = {
  "Mommy":   2.0,
  "Patrick": 1.2,
  "Ryan":    1.5,
};

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudent(id);

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center max-w-sm w-full">
          <h1 className="text-xl font-bold text-white mb-3">Student Not Found</h1>
          <p className="text-slate-400 mb-6 text-sm">We couldn&apos;t find a student with that ID.</p>
          <Link href="/" className="inline-block rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 font-semibold text-white transition-colors text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const summary = await getKnowledgeSummary(student.id, student.currentLevel);
  // Passive streak check — resets to 0 if a day was missed
  await checkAndResetStreak(student.id);
  // Re-fetch student after potential streak reset
  const freshStudent = (await getStudent(id)) ?? student;
  const characterImg = PLAYER_IMAGES[freshStudent.name];
  const scale = PLAYER_SCALE[freshStudent.name] ?? 1;
  const baseSize = 88;
  const imgSize = Math.round(baseSize * scale);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-12">
      {/* Back */}
      <div className="w-full max-w-2xl mb-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-base transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          All Profiles
        </Link>
      </div>

      <div className="w-full max-w-2xl space-y-5">
        {/* Profile card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {characterImg ? (
                <Image src={characterImg} alt={freshStudent.name} width={imgSize} height={imgSize} className="object-contain" style={{ imageRendering: "pixelated" }} unoptimized />
              ) : (
                <span className="text-3xl font-bold text-slate-400">{freshStudent.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{freshStudent.name}</h1>
              <div className="mt-2">
                <LevelBadge level={freshStudent.currentLevel} />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl bg-slate-800 p-4 text-center">
              <p className="text-3xl font-bold text-white">{freshStudent.lessonsCompleted}</p>
              <p className="text-sm text-slate-500 mt-1">Lessons</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-4 text-center">
              <StarDisplay count={freshStudent.streakStars} label="Streak" />
            </div>
            <div className="rounded-xl bg-slate-800 p-4 text-center">
              <StarDisplay count={freshStudent.performanceStars} label="Stars" />
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-5">
            <KnowledgeOverview summary={summary} />
            <ProgressBar percentage={summary.knownPercentage} />
          </div>
        </div>

        {/* Start lesson */}
        <Link
          href={`/student/${freshStudent.id}/lesson/reading`}
          className="block w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-5 text-center text-xl font-bold text-white transition-colors shadow-lg shadow-indigo-900/30"
        >
          Start Lesson →
        </Link>
      </div>
    </div>
  );
}
