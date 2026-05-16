import type { KnowledgeSummary } from "@/lib/types";

export function KnowledgeOverview({ summary }: { summary: KnowledgeSummary }) {
  const { known, learning, dontKnow, total } = summary;

  if (total === 0) {
    return <p className="text-center text-slate-500">No words at this level yet.</p>;
  }

  const knownPct = (known / total) * 100;
  const learningPct = (learning / total) * 100;
  const dontKnowPct = (dontKnow / total) * 100;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-400 uppercase tracking-wide text-center">Word Knowledge</p>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {knownPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${knownPct}%` }} />}
        {learningPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${learningPct}%` }} />}
        {dontKnowPct > 0 && <div className="bg-slate-600 transition-all" style={{ width: `${dontKnowPct}%` }} />}
      </div>
      <div className="flex justify-center gap-5 text-sm text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Known ({known})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Learning ({learning})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />New ({dontKnow})
        </span>
      </div>
    </div>
  );
}
