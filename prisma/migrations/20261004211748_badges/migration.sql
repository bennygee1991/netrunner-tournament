-- Badges and achievement trophies: extra facts on permanent event records.

-- AlterTable
ALTER TABLE "EventRecord" ADD COLUMN     "corpWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cutDraws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cutSeed" INTEGER,
ADD COLUMN     "cutSize" INTEGER,
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "finale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lostFirstRound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "madeCut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opponentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "runnerWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seasonId" TEXT,
ADD COLUMN     "statsVersion" INTEGER NOT NULL DEFAULT 1;

-- Existing records: a stable event key (the event id, or a hash for events already archived).
UPDATE "EventRecord"
SET "eventKey" = COALESCE("eventId", md5("seasonName" || '|' || "eventDate"::text || '|' || "eventName"));

-- Season: from the event when it still exists, otherwise by season name.
UPDATE "EventRecord" r SET "seasonId" = e."seasonId", "finale" = e."finale"
FROM "Event" e WHERE e."id" = r."eventId";
UPDATE "EventRecord" r SET "seasonId" = s."id"
FROM "Season" s WHERE r."seasonId" IS NULL AND s."name" = r."seasonName";

-- Made the cut: cut placings, or champion of an event that had a finalist (Swiss-only events have none).
UPDATE "EventRecord" r SET "madeCut" = true
WHERE r."placing" IN ('Finalist', 'Top 4', 'Top 8')
   OR (r."placing" = 'Champion' AND EXISTS (
     SELECT 1 FROM "EventRecord" o WHERE o."eventKey" = r."eventKey" AND o."placing" = 'Finalist'));

ALTER TABLE "EventRecord" ALTER COLUMN "eventKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "featuredBadges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportsApproved" INTEGER NOT NULL DEFAULT 0;
