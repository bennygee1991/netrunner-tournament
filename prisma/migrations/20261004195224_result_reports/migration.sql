-- CreateTable
CREATE TABLE "ResultReport" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "round" INTEGER NOT NULL,
    "match" INTEGER NOT NULL,
    "game" INTEGER NOT NULL,
    "aEntrantId" TEXT NOT NULL,
    "bEntrantId" TEXT NOT NULL,
    "result" "GameResult" NOT NULL,
    "reporterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultReport_eventId_idx" ON "ResultReport"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultReport_eventId_phase_round_match_game_reporterId_key" ON "ResultReport"("eventId", "phase", "round", "match", "game", "reporterId");

-- AddForeignKey
ALTER TABLE "ResultReport" ADD CONSTRAINT "ResultReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultReport" ADD CONSTRAINT "ResultReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
