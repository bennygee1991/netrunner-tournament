const TZ = process.env.APP_TIMEZONE || "UTC";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** e.g. "3 Oct 2026", in the league's time zone. */
export function formatDate(d: Date): string {
  return dateFmt.format(d);
}

export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}
