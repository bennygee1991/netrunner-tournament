import { z } from "zod";

/** YYYY-MM-DD calendar date (no time zone). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.")
  .refine(
    (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && toIsoDate(fromIsoDate(v)) === v,
    "Enter a real date.",
  );

/** Date-only DB columns are stored as UTC midnight. */
export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** e.g. "Sat 10 Oct 2026" for a date-only column. */
export function formatDay(d: Date): string {
  return dayFmt.format(d);
}

/** Today's calendar date in the league's time zone. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "UTC" }).format(new Date());
}
