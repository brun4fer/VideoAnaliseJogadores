CREATE TYPE "VideoStorageStatus" AS ENUM ('LOCAL', 'UPLOADING', 'READY', 'FAILED');

ALTER TABLE "Video"
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "storageStatus" "VideoStorageStatus" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "uploadId" TEXT,
ADD COLUMN "etag" TEXT,
ADD COLUMN "uploadedAt" TIMESTAMP(3);

UPDATE "Video" AS video
SET "ownerId" = account."id"
FROM "Match" AS match
JOIN "User" AS account ON account."workspaceId" = match."workspaceId"
WHERE video."matchId" = match."id";

ALTER TABLE "Video" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE UNIQUE INDEX "Video_storageKey_key" ON "Video"("storageKey");
CREATE INDEX "Video_ownerId_idx" ON "Video"("ownerId");

ALTER TABLE "Video"
ADD CONSTRAINT "Video_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
