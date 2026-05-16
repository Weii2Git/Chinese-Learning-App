import Link from "next/link";
import Image from "next/image";
import { getStudent } from "@/lib/student";
import { getKnowledgeSummary } from "@/lib/knowledge";
import { LevelBadge } from "@/components/LevelBadge";
import { checkAndResetStreak } from "@/lib/stars";
import { StudentDashboardClient } from "@/components/StudentDashboardClient";

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

  // Passive streak check — resets to 0 if a day was missed
  await checkAndResetStreak(student.id);
  // Re-fetch after potential streak reset
  const freshStudent = (await getStudent(id)) ?? student;

  const summary = await getKnowledgeSummary(freshStudent.id, freshStudent.currentLevel);

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

      {/* Profile header */}
      <div className="w-full max-w-2xl mb-6">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8">
          <div className="flex items-center gap-6">
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
        </div>
      </div>

      {/* Interactive client section */}
      <StudentDashboardClient
        studentId={freshStudent.id}
        studentName={freshStudent.name}
        lessonsCompleted={freshStudent.lessonsCompleted}
        streakStars={freshStudent.streakStars}
        performanceStars={freshStudent.performanceStars}
        knownCount={summary.known}
        learningCount={summary.learning}
        dontKnowCount={summary.dontKnow}
        knownPercentage={summary.knownPercentage}
        currentLevel={freshStudent.currentLevel}
      />
    </div>
  );
}
