import { LessonProvider } from "@/lib/lesson-context";

export default function LessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LessonProvider>{children}</LessonProvider>;
}
