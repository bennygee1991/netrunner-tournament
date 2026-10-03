-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "date" SET DATA TYPE DATE,
ALTER COLUMN "cutSize" SET DEFAULT 4;

-- AlterTable
ALTER TABLE "Season" ALTER COLUMN "startDate" SET DATA TYPE DATE;

-- CreateTable
CREATE TABLE "EventRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "seasonName" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "placing" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "champion" BOOLEAN NOT NULL,
    "undefeated" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "seasonId" TEXT,
    "seasonName" TEXT NOT NULL,
    "eventId" TEXT,
    "eventName" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trophy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRecord_eventId_idx" ON "EventRecord"("eventId");

-- CreateIndex
CREATE INDEX "EventRecord_userId_idx" ON "EventRecord"("userId");

-- CreateIndex
CREATE INDEX "Trophy_userId_idx" ON "Trophy"("userId");

-- CreateIndex
CREATE INDEX "Trophy_eventId_idx" ON "Trophy"("eventId");

-- AddForeignKey
ALTER TABLE "EventRecord" ADD CONSTRAINT "EventRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecord" ADD CONSTRAINT "EventRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
