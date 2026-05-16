export function StarDisplay({
  count,
  max,
  label,
}: {
  count: number;
  max?: number;
  label: string;
}) {
  if (max) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => (
            <span key={i} className={`text-2xl ${i < count ? "text-yellow-400" : "text-slate-700"}`}>
              {i < count ? "★" : "☆"}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-2xl text-yellow-400">★</span>
        <span className="text-2xl font-bold text-yellow-400">{count}</span>
      </div>
    </div>
  );
}
