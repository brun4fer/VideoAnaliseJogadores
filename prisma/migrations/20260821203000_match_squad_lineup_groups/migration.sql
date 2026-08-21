-- Store the tactical rail group selected for every player in each match.
ALTER TABLE "MatchSquad" ADD COLUMN "lineupGroup" TEXT;
