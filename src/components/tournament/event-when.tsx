import { formatDay } from "@/lib/tournament/dates";

/** "Sat, 10 Oct 2026 · 18:30 · The Hive" (time and venue only when set). */
export function eventWhen(e: { date: Date; startTime?: string | null; venue?: string | null }): string {
  return [formatDay(e.date), e.startTime, e.venue].filter(Boolean).join(" · ");
}
