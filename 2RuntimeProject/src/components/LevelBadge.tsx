export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-4 py-1.5 text-base font-semibold text-indigo-300">
      <span className="w-2 h-2 rounded-full bg-indigo-400" />
      Level {level}
    </span>
  );
}
