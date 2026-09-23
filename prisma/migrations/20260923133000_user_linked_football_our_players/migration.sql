CREATE TABLE "FootballOurPlayersConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "remoteBaseUrl" TEXT NOT NULL,
    "remoteConnectionId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "destinationWorkspaceId" TEXT NOT NULL,
    "destinationWorkspaceName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "FootballOurPlayersConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FootballOurPlayersConnection_workspaceId_key" ON "FootballOurPlayersConnection"("workspaceId");
CREATE UNIQUE INDEX "FootballOurPlayersConnection_remoteBaseUrl_remoteConnectionId_key" ON "FootballOurPlayersConnection"("remoteBaseUrl", "remoteConnectionId");

ALTER TABLE "FootballOurPlayersConnection" ADD CONSTRAINT "FootballOurPlayersConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
