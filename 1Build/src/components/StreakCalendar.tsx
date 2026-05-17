"use client";

import { useState, useEffect } from "react";

interface ActivityEntry {
  activityDate: string;
  activityType: "lesson" | "freeze_used" | "freeze_earned";
}

interface StreakCalendarProps {
  studentId: string;
  streakCount: number;
  streakFreezes: number;
  onClose: () => void;
}

export function StreakCalendar({ studentId, streakCount, streakFreezes, onClose }: StreakCalendarProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    // Fetch last 3 months of activity
    const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 2, 1)
      .toISOString().split("T")[0];
    const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split("T")[0];

    fetch(`/api/students/${studentId}/activity?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [studentId, currentMonth]);

  // Build a map of date → activity types
  const activityMap = new Map<string, Set<string>>();
  for (const entry of activities) {
    if (!activityMap.has(entry.activityDate)) {
      activityMap.set(entry.activityDate, new Set());
    }
    activityMap.get(entry.activityDate)!.add(entry.activityType);
  }

  // Generate calendar days for current month
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function getDayIcon(dateStr: string): string | null {
    const types = activityMap.get(dateStr);
    if (!types) return null;
    if (types.has("lesson")) return "🔥";
    if (types.has("freeze_used")) return "🔵";
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Streak Calendar</h2>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="text-orange-400 font-bold">🔥 {streakCount} day streak</span>
              <span className="text-blue-400">🧊 {streakFreezes} freeze{streakFreezes !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-slate-400 mb-4">
          <span>🔥 Lesson day</span>
          <span>🔵 Freeze used</span>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
          >‹</button>
          <span className="text-white font-semibold text-sm">{monthName}</span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
          >›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="text-center text-slate-500 text-sm py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const icon = getDayIcon(dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;

              return (
                <div
                  key={day}
                  className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs
                    ${isToday ? "ring-1 ring-indigo-500" : ""}
                    ${isFuture ? "opacity-30" : ""}
                    ${icon ? "bg-slate-800" : ""}
                  `}
                >
                  <span className={`${isToday ? "text-indigo-400 font-bold" : "text-slate-400"}`}>{day}</span>
                  {icon && <span className="text-sm leading-none mt-0.5">{icon}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Freeze info */}
        <div className="mt-4 rounded-xl bg-slate-800 p-3 text-xs text-slate-400">
          <p>Earn 1 🧊 freeze every 10 streak days. Freezes protect your streak on missed days.</p>
        </div>
      </div>
    </div>
  );
}
