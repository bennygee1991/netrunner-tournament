-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "cutSeedOrder" JSONB,
ADD COLUMN     "finale" BOOLEAN NOT NULL DEFAULT false;
