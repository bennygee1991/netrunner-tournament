import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedAdmin } from "../src/lib/seed-admin";
import { backfillBadgeFacts } from "../src/lib/tournament/backfill";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await seedAdmin(db, {
      ADMIN_RUNNER_NAME: process.env.ADMIN_RUNNER_NAME,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    });
    if (result.status === "created") {
      console.log(`Created admin account "${result.runnerName}". Log in and change the password.`);
    } else {
      console.log(`Seed skipped: ${result.reason}`);
    }
    const filled = await backfillBadgeFacts(db);
    if (filled.events || filled.monthTrophies) {
      console.log(
        `Badges: updated ${filled.events} event(s), added ${filled.monthTrophies} month trophy(ies).`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
