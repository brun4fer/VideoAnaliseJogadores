UPDATE "PlayerAction" AS action
SET "period" = NULL
FROM "Match" AS match
WHERE action."matchId" = match."id"
  AND match."firstHalfStartSeconds" IS NULL
  AND match."firstHalfEndSeconds" IS NULL
  AND match."secondHalfStartSeconds" IS NULL
  AND match."secondHalfEndSeconds" IS NULL;
