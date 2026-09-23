CREATE TYPE "HomeAway" AS ENUM ('HOME', 'AWAY');

ALTER TABLE "Season" ADD COLUMN "footballSyncedAt" TIMESTAMP(3);
ALTER TABLE "Competition" ADD COLUMN "footballSyncedAt" TIMESTAMP(3);
ALTER TABLE "Club" ADD COLUMN "footballSyncedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "homeAway" "HomeAway" NOT NULL DEFAULT 'HOME';
ALTER TABLE "Match" ADD COLUMN "footballSyncedAt" TIMESTAMP(3);
ALTER TABLE "MatchSquad" ADD COLUMN "minutesPlayed" INTEGER;
