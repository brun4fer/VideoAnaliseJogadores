ALTER TABLE "Match"
ADD COLUMN "scoreboardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "homeClubName" TEXT,
ADD COLUMN "awayClubName" TEXT,
ADD COLUMN "homeClubShortName" TEXT,
ADD COLUMN "awayClubShortName" TEXT,
ADD COLUMN "homeClubLogoDataUrl" TEXT,
ADD COLUMN "awayClubLogoDataUrl" TEXT,
ADD COLUMN "homeTeamColor" TEXT NOT NULL DEFAULT '#22D3EE',
ADD COLUMN "awayTeamColor" TEXT NOT NULL DEFAULT '#EF4444';

CREATE TABLE "MatchScoreEvent" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "timeSeconds" DOUBLE PRECISION NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "awayScore" INTEGER NOT NULL,
  "homeRedCards" INTEGER NOT NULL DEFAULT 0,
  "awayRedCards" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchScoreEvent_matchId_timeSeconds_idx" ON "MatchScoreEvent"("matchId", "timeSeconds");
ALTER TABLE "MatchScoreEvent" ADD CONSTRAINT "MatchScoreEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
