-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "clockJson" JSONB;

-- AlterTable
ALTER TABLE "EventRecord" ADD COLUMN     "oneOff" BOOLEAN NOT NULL DEFAULT false;

-- One-off events have no season.
ALTER TABLE "Event" ALTER COLUMN "seasonId" DROP NOT NULL;
