import { z } from "zod";
import { COMMON_PASSWORDS } from "./common-passwords";

export const RUNNER_NAME_MIN = 3;
export const RUNNER_NAME_MAX = 24;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const RUNNER_NAME_PATTERN = /^[A-Za-z0-9_\- ]+$/;

/** Normalised key used for case-insensitive uniqueness and lookups. */
export function runnerNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Runner name = username. 3-24 chars of letters, digits, space, `_` or `-`.
 * Leading/trailing spaces are trimmed; runs of spaces are not allowed.
 */
export const runnerNameSchema = z
  .string()
  .trim()
  .min(RUNNER_NAME_MIN, `Runner name must be at least ${RUNNER_NAME_MIN} characters.`)
  .max(RUNNER_NAME_MAX, `Runner name must be at most ${RUNNER_NAME_MAX} characters.`)
  .regex(RUNNER_NAME_PATTERN, "Use only letters, digits, spaces, _ and -.")
  .refine((v) => !v.includes("  "), "Runner name cannot contain double spaces.");

/** Returns an error message if the password is too weak, otherwise null. */
export function passwordProblem(password: string, runnerName?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is too common. Pick something less guessable.";
  if (new Set(password).size < 4) return "Password needs more variety (at least 4 different characters).";
  if (runnerName && lower.includes(runnerNameKey(runnerName))) {
    return "Password must not contain your runner name.";
  }
  return null;
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});
