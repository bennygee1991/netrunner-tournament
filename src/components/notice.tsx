import { FormMessage } from "./ui";

/**
 * Confirmation shown after an action that changes the page layout (so the form that triggered it
 * is gone). Actions redirect with `?notice=<code>`; only known codes are displayed.
 */
export const NOTICES = {
  "event-reset": "Event reset to sign-up.",
  "event-reopened": "Event reopened. Its league points are removed until it is finished again.",
  "season-archived": "Season archived to Past seasons. Ready for a new season.",
  "reset-all": "Everything was reset.",
  "reset-all-accounts": "Everything was reset, including player accounts.",
} as const;

export type NoticeCode = keyof typeof NOTICES;

export function Notice({ code }: { code: unknown }) {
  if (typeof code !== "string" || !(code in NOTICES)) return null;
  return <FormMessage tone="ok">{NOTICES[code as NoticeCode]}</FormMessage>;
}
