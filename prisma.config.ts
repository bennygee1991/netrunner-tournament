import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the direct (non-pooled) connection when one is provided (Neon: DIRECT_URL);
// the app itself always uses DATABASE_URL.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: url ?? "" },
});
