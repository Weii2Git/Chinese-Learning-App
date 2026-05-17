import { getAllStudents, createStudent } from "@/lib/student";
import { v4 as uuidv4 } from "uuid";
import type { Student } from "@/lib/types";

/**
 * GET /api/students
 * Returns all student profiles as a JSON array.
 */
export async function GET() {
  const students = await getAllStudents();
  return Response.json(students);
}

/**
 * POST /api/students
 * Creates a new student with the given name and level.
 * Request body: { name: string, level: string }
 * Returns the created student with status 201.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, level } = body as { name: string; level: string };

  if (!name || !level) {
    return Response.json(
      { error: "name and level are required" },
      { status: 400 }
    );
  }

  const newStudent: Student = {
    id: uuidv4(),
    name,
    currentLevel: level,
    streakStars: 0,
    streakFreezes: 0,
    performanceStars: 0,
    lastActiveDate: null,
    lessonsCompleted: 0,
  };

  await createStudent(newStudent);

  return Response.json(newStudent, { status: 201 });
}
