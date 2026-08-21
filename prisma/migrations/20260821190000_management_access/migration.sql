-- Add a separate password for administrative areas and remember unlocks per login session.
ALTER TABLE "Workspace" ADD COLUMN "managementPasswordHash" TEXT;
ALTER TABLE "Session" ADD COLUMN "managementUnlockedAt" TIMESTAMP(3);
