import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seedAdmin } from "../../src/lib/seed-admin";

import { E2E_ADMIN } from "./fixtures";

/** Fresh test database with only the seeded admin. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const tables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) {
      await db.$executeRawUnsafe(
        `TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`,
      );
    }
    await seedAdmin(db, { ADMIN_RUNNER_NAME: E2E_ADMIN.runnerName, ADMIN_PASSWORD: E2E_ADMIN.password });
  } finally {
    await db.$disconnect();
  }
}
