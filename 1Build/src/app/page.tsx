import Link from "next/link";
import { getAllStudents } from "@/lib/student";
import { StudentCard } from "@/components/StudentCard";

// Fixed display order: top-left, top-right, bottom-left, bottom-right
const DISPLAY_ORDER = ["Patrick", "Cony Da Banana", "Mommy", "Ryan"];

export default async function Home() {
  const students = await getAllStudents();

  const sorted = [...students].sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a.name);
    const bi = DISPLAY_ORDER.indexOf(b.name);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-8 py-16">
      {/* Header */}
      <header className="mb-14 text-center">
        <div className="inline-flex items-center gap-4 mb-5">
          <span className="bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded">CN</span>
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Chinese Learning
          </h1>
        </div>
        <p className="text-slate-400 text-lg">
          Select your profile to start learning
        </p>
      </header>

      {/* Student cards grid */}
      <main className="grid w-full max-w-4xl grid-cols-1 sm:grid-cols-2 gap-5">
        {sorted.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </main>

      {/* Admin link */}
      <footer className="mt-14">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-base transition-colors border border-slate-700 hover:border-slate-500 rounded-lg px-5 py-2.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Admin Settings
        </Link>
      </footer>
    </div>
  );
}
