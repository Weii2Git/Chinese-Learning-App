"use client";

import { useEffect, useRef, useState } from "react";

interface TimerBarProps {
  totalMs: number;
  onExpire: () => void;
}

export function TimerBar({ totalMs, onExpire }: TimerBarProps) {
  const [progress, setProgress] = useState(1);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    startTimeRef.current = performance.now();

    const tick = () => {
      if (startTimeRef.current === null) return;
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / totalMs);
      setProgress(remaining);

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [totalMs, onExpire]);

  const color = progress > 0.5 ? "bg-emerald-500" : progress > 0.25 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-colors duration-300 ${color}`}
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
