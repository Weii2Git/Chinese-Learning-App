import { type NextRequest } from "next/server";
import { readKnowledgeRecords } from "@/lib/knowledge";
import { promises as fs } from "fs";
import path from "path";
import { KNOWLEDGE_FILE } from "@/lib/constants";

/**
 * POST /api/admin/time-travel
 * Fast-forwards all SRS due dates for a student by a given number of days.
 * This makes words "due" for review without waiting real time.
 * Body: { studentId: string, days: number }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, days } = body as { studentId: string; days: number };

  if (!studentId || !days || days <= 0) {
    return Response.json(
      { error: "studentId and days (positive number) are required" },
      { status: 400 }
    );
  }

  const records = await readKnowledgeRecords();
  const msToSubtract = days * 24 * 60 * 60 * 1000;
  let updatedCount = 0;

  for (const record of records) {
    if (record.studentId === studentId && record.nextDueDate) {
      // Move the due date back by the specified days (making it overdue)
      const dueMs = new Date(record.nextDueDate).getTime();
      record.nextDueDate = new Date(dueMs - msToSubtract).toISOString();
      if (record.lastReviewedAt) {
        const reviewMs = new Date(record.lastReviewedAt).getTime();
        record.lastReviewedAt = new Date(reviewMs - msToSubtract).toISOString();
      }
      updatedCount++;
    }
  }

  // Write back
  const filePath = path.resolve(process.cwd(), KNOWLEDGE_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");

  return Response.json({
    success: true,
    message: `Fast-forwarded ${updatedCount} records by ${days} days for student ${studentId}`,
    updatedCount,
  });
}
