ALTER TABLE "Workspace" ADD COLUMN "activeClientClubId" TEXT;

UPDATE "Workspace" AS workspace
SET "activeClientClubId" = (
  SELECT club."id"
  FROM "Club" AS club
  WHERE club."workspaceId" = workspace."id" AND club."isClientClub" = TRUE
  ORDER BY club."createdAt" ASC
  LIMIT 1
);

CREATE UNIQUE INDEX "Workspace_activeClientClubId_key" ON "Workspace"("activeClientClubId");

ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_activeClientClubId_fkey"
FOREIGN KEY ("activeClientClubId") REFERENCES "Club"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
