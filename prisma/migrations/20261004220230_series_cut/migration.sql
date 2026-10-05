/*
  Warnings:

  - You are about to drop the column `cutSeedOrder` on the `Event` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CutFormat" AS ENUM ('SINGLE', 'SERIES');

-- League format: series cut matches; season-seeded finale cuts removed.
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "cutSeedOrder",
ADD COLUMN     "cutFormat" "CutFormat" NOT NULL DEFAULT 'SINGLE';

-- League format: series cut matches; season-seeded finale cuts removed.
-- AlterTable
ALTER TABLE "EventRecord" ADD COLUMN     "cutLosses" INTEGER NOT NULL DEFAULT 0;

-- League format: series cut matches; season-seeded finale cuts removed.
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "corp3EntrantId" TEXT,
ADD COLUMN     "result3" "GameResult";

-- New league format for events that have not started and still use the old defaults:
-- the finale (1 Swiss round, top 8 by season standings) becomes 3 Swiss rounds and a top 4 series cut;
-- the other events (default rounds, top 4 single-game cut) become 3 Swiss rounds with no cut.
UPDATE "Event" e SET "swissRounds" = 3, "cutSize" = 4, "cutFormat" = 'SERIES'
FROM "Season" s
WHERE s."id" = e."seasonId" AND s."status" = 'ACTIVE' AND e."status" = 'SIGNUP'
  AND e."finale" AND e."swissRounds" = 1 AND e."cutSize" = 8;

UPDATE "Event" e SET "swissRounds" = 3, "cutSize" = 0
FROM "Season" s
WHERE s."id" = e."seasonId" AND s."status" = 'ACTIVE' AND e."status" = 'SIGNUP'
  AND NOT e."finale" AND e."swissRounds" IS NULL AND e."cutSize" = 4;
