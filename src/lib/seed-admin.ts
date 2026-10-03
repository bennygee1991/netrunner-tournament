import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "./password";
import { passwordProblem, runnerNameKey, runnerNameSchema } from "./validation";

export type SeedResult = { status: "created"; runnerName: string } | { status: "skipped"; reason: string };

/**
 * One-time bootstrap of the first admin. Does nothing if an admin already exists,
 * so it is safe to run on every deploy.
 */
export async function seedAdmin(
  db: PrismaClient,
  env: { ADMIN_RUNNER_NAME?: string; ADMIN_PASSWORD?: string },
): Promise<SeedResult> {
  const existing = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (existing) return { status: "skipped", reason: "An admin account already exists." };

  if (!env.ADMIN_RUNNER_NAME && !env.ADMIN_PASSWORD) {
    throw new Error(
      "No admin account exists yet. Set ADMIN_RUNNER_NAME and ADMIN_PASSWORD (see README, step 'Environment variables') and deploy again.",
    );
  }
  const parsedName = runnerNameSchema.safeParse(env.ADMIN_RUNNER_NAME ?? "");
  if (!parsedName.success) {
    throw new Error(`ADMIN_RUNNER_NAME is invalid: ${parsedName.error.issues[0]?.message}`);
  }
  const runnerName = parsedName.data;
  const password = env.ADMIN_PASSWORD ?? "";
  const problem = passwordProblem(password, runnerName);
  if (problem) throw new Error(`ADMIN_PASSWORD is invalid: ${problem}`);

  const key = runnerNameKey(runnerName);
  const taken = await db.user.findUnique({ where: { runnerNameLower: key }, select: { id: true } });
  if (taken) {
    throw new Error(`Runner name "${runnerName}" is already used by a player account. Pick another.`);
  }

  await db.user.create({
    data: {
      runnerName,
      runnerNameLower: key,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    },
  });
  return { status: "created", runnerName };
}
