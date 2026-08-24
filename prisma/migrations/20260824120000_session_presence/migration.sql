-- Track recent activity per authenticated browser session so concurrent account use can be detected.
ALTER TABLE "Session" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE INDEX "Session_userId_lastSeenAt_idx" ON "Session"("userId", "lastSeenAt");
