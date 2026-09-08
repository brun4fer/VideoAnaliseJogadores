ALTER TABLE "Workspace"
ADD COLUMN "globalAccessPasswordHash" TEXT,
ADD COLUMN "matchesAccessPasswordHash" TEXT,
ADD COLUMN "newMatchAccessPasswordHash" TEXT,
ADD COLUMN "mapsAccessPasswordHash" TEXT,
ADD COLUMN "reportsAccessPasswordHash" TEXT,
ADD COLUMN "squadAccessPasswordHash" TEXT,
ADD COLUMN "analysisAccessPasswordHash" TEXT;

ALTER TABLE "Session"
ADD COLUMN "globalAccessUnlockedAt" TIMESTAMP(3),
ADD COLUMN "unlockedAccessAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
