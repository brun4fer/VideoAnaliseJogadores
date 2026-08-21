ALTER TABLE "Club"
ADD COLUMN "badgeStorageKey" TEXT,
ADD COLUMN "badgeFileName" TEXT,
ADD COLUMN "badgeFileSize" INTEGER,
ADD COLUMN "badgeMimeType" TEXT,
ADD COLUMN "badgeEtag" TEXT,
ADD COLUMN "badgeUploadedAt" TIMESTAMP(3);

ALTER TABLE "Player"
ADD COLUMN "photoStorageKey" TEXT,
ADD COLUMN "photoFileName" TEXT,
ADD COLUMN "photoFileSize" INTEGER,
ADD COLUMN "photoMimeType" TEXT,
ADD COLUMN "photoEtag" TEXT,
ADD COLUMN "photoUploadedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Club_badgeStorageKey_key" ON "Club"("badgeStorageKey");
CREATE UNIQUE INDEX "Player_photoStorageKey_key" ON "Player"("photoStorageKey");
