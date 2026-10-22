import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Student } from "./types";

// Unit-test the streak logic in isolation. We mock the storage layer (./student
// and ./activity-log) so the test never touches the filesystem or Supabase, and
// we mock the clock so the Singapore-time "today"/"yesterday" used by stars.ts
// are deterministic regardless of when/where the suite runs.

vi.mock("./student", () => ({
  getStudent: vi.fn(),
  updateStudent: vi.fn(),
}));

vi.mock("./activity-log", () => ({
  logActivity: vi.fn(),
}));

import { updateStreakStars } from "./stars";
import { getStudent, updateStudent } from "./student";

const mockGetStudent = getStudent as ReturnType<typeof vi.fn>;
const mockUpdateStudent = updateStudent as ReturnType<typeof vi.fn>;

// A fixed instant: 2026-06-15 12:00 SGT (= 04:00 UTC). Comfortably mid-day in
// Singapore so there's no date-boundary ambiguity between UTC and SGT.
const FIXED_NOW = new Date("2026-06-15T04:00:00.000Z");
const TODAY_SGT = "2026-06-15";
const YESTERDAY_SGT = "2026-06-14";
const TWO_DAYS_AGO_SGT = "2026-06-13";

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    name: "Test",
    currentLevel: "1-a",
    streakStars: 0,
    streakFreezes: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
    ...overrides,
  };
}

describe("updateStreakStars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    // By default updateStudent just echoes the merged student back.
    mockUpdateStudent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sets streak to 1 on the first lesson (no prior activity)", async () => {
    mockGetStudent.mockResolvedValue(makeStudent({ lastActiveDate: null }));

    const result = await updateStreakStars("s1");

    expect(result).toBe(1);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 1, lastActiveDate: TODAY_SGT })
    );
  });

  it("increments the streak when last active yesterday", async () => {
    mockGetStudent.mockResolvedValue(
      makeStudent({ streakStars: 2, lastActiveDate: YESTERDAY_SGT })
    );

    const result = await updateStreakStars("s1");

    expect(result).toBe(3);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 3, lastActiveDate: TODAY_SGT })
    );
  });

  it("keeps incrementing the raw streak with no cap", async () => {
    mockGetStudent.mockResolvedValue(
      makeStudent({ streakStars: 5, lastActiveDate: YESTERDAY_SGT })
    );

    const result = await updateStreakStars("s1");

    expect(result).toBe(6);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 6 })
    );
  });

  it("earns a freeze every 10 streak days", async () => {
    // 9 → 10 crosses the freeze-earn interval.
    mockGetStudent.mockResolvedValue(
      makeStudent({ streakStars: 9, streakFreezes: 1, lastActiveDate: YESTERDAY_SGT })
    );

    const result = await updateStreakStars("s1");

    expect(result).toBe(10);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 10, streakFreezes: 2 })
    );
  });

  it("resets the streak to 1 when a day was missed", async () => {
    mockGetStudent.mockResolvedValue(
      makeStudent({ streakStars: 4, lastActiveDate: TWO_DAYS_AGO_SGT })
    );

    const result = await updateStreakStars("s1");

    expect(result).toBe(1);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 1, lastActiveDate: TODAY_SGT })
    );
  });

  it("leaves the streak unchanged when already active today", async () => {
    mockGetStudent.mockResolvedValue(
      makeStudent({ streakStars: 3, lastActiveDate: TODAY_SGT })
    );

    const result = await updateStreakStars("s1");

    expect(result).toBe(3);
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ streakStars: 3, lastActiveDate: TODAY_SGT })
    );
  });

  it("throws for a non-existent student", async () => {
    mockGetStudent.mockResolvedValue(null);

    await expect(updateStreakStars("non-existent-id")).rejects.toThrow(
      "Student not found"
    );
  });
});
