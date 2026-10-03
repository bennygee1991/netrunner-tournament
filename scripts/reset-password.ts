/**
 * Emergency password reset, e.g. when the only admin is locked out.
 * Issues a one-time temporary password (must be changed at next login) and logs the account out.
 *
 *   pnpm admin:reset-password "Runner Name"
 *
 * Uses DATABASE_URL (or DIRECT_URL) from .env, so point it at the database you want to change.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { newTempPassword } from "../src/lib/auth/tokens";
import { hashPassword } from "../src/lib/password";
import { runnerNameKey } from "../src/lib/validation";

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Usage: pnpm admin:reset-password "Runner Name"');
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const user = await db.user.findUnique({ where: { runnerNameLower: runnerNameKey(name) } });
    if (!user) throw new Error(`No account named "${name}".`);
    const temp = newTempPassword();
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(temp), mustChangePassword: true, disabledAt: null },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.rateLimit.deleteMany({ where: { key: `login:acct:${runnerNameKey(name)}` } }),
      db.auditLog.create({
        data: {
          actorName: "command line",
          action: "player.temp_password",
          detailJson: { userId: user.id, runnerName: user.runnerName, via: "script" },
        },
      }),
    ]);
    console.log(`Temporary password for ${user.runnerName}: ${temp}`);
    console.log("Log in with it; you will be asked to choose a new password.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
