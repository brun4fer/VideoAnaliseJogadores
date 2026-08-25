-- Link local video records to immutable assets in the shared media catalog.
-- Legacy storage columns remain untouched for a reversible dual-read rollout.
ALTER TABLE "Video" ADD COLUMN "mediaAssetId" TEXT;

CREATE INDEX "Video_mediaAssetId_idx" ON "Video"("mediaAssetId");
