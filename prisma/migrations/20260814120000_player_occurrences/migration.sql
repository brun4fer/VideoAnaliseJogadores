ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "firstHalfAttacksRight" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlayerAction" ADD COLUMN IF NOT EXISTS "period" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "MatchSquad" (
  "matchId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchSquad_pkey" PRIMARY KEY ("matchId", "playerId"),
  CONSTRAINT "MatchSquad_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MatchSquad_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchSquad_matchId_sortOrder_key" ON "MatchSquad"("matchId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MatchSquad_playerId_idx" ON "MatchSquad"("playerId");

CREATE TABLE IF NOT EXISTS "PlayerSubAction" (
  "id" TEXT NOT NULL,
  "playerActionId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "actionName" TEXT NOT NULL,
  "eventTimeSeconds" DOUBLE PRECISION NOT NULL,
  "fieldX" DOUBLE PRECISION,
  "fieldY" DOUBLE PRECISION,
  "notes" TEXT,
  "outcome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerSubAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerSubAction_playerActionId_fkey" FOREIGN KEY ("playerActionId") REFERENCES "PlayerAction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PlayerSubAction_playerActionId_idx" ON "PlayerSubAction"("playerActionId");
CREATE INDEX IF NOT EXISTS "PlayerSubAction_actionKey_idx" ON "PlayerSubAction"("actionKey");

INSERT INTO "PlayerSubAction" (
  "id", "playerActionId", "actionKey", "actionName", "eventTimeSeconds", "fieldX", "fieldY", "notes", "outcome", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, action."id", action."actionKey", action."actionName", action."eventTimeSeconds",
  action."fieldX", action."fieldY", action."notes", action."outcome", action."createdAt", action."updatedAt"
FROM "PlayerAction" action
WHERE action."actionKey" <> 'unclassified'
  AND NOT EXISTS (SELECT 1 FROM "PlayerSubAction" child WHERE child."playerActionId" = action."id");

WITH ranked AS (
  SELECT
    match."id" AS "matchId",
    player."id" AS "playerId",
    ROW_NUMBER() OVER (
      PARTITION BY match."id"
      ORDER BY
        CASE
          WHEN player."isGoalkeeper" = true OR player."position" IN ('Goalkeeper', 'Guarda-Redes') THEN 0
          WHEN player."position" IN ('Right-Back', 'Defesa Direito', 'Right Wing-Back', 'Lateral Direito') THEN 10
          WHEN player."position" IN ('Centre-Back', 'Defesa Central') THEN 20
          WHEN player."position" IN ('Left-Back', 'Defesa Esquerdo', 'Left Wing-Back', 'Lateral Esquerdo') THEN 30
          WHEN player."position" IN ('Defensive Midfielder', 'Médio Defensivo') THEN 40
          WHEN player."position" IN ('Central Midfielder', 'Médio Centro') THEN 50
          WHEN player."position" IN ('Attacking Midfielder', 'Médio Ofensivo') THEN 60
          WHEN player."position" IN ('Right Winger', 'Extremo Direito') THEN 70
          WHEN player."position" IN ('Left Winger', 'Extremo Esquerdo') THEN 80
          WHEN player."position" IN ('Forward', 'Avançado') THEN 90
          WHEN player."position" IN ('Striker', 'Ponta de Lança') THEN 100
          ELSE 110
        END,
        player."shirtNumber" NULLS LAST,
        player."name"
    ) - 1 AS "sortOrder"
  FROM "Match" match
  JOIN "Player" player ON player."clubId" = match."clubId" AND player."active" = true
)
INSERT INTO "MatchSquad" ("matchId", "playerId", "sortOrder")
SELECT "matchId", "playerId", "sortOrder" FROM ranked WHERE "sortOrder" < 18
ON CONFLICT DO NOTHING;
