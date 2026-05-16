export function ProgressBar({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-base text-slate-400">
        <span>Level Progress</span>
        <span className="font-semibold text-slate-300">{Math.round(clamped)}% known</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
