import "server-only";

import { prisma } from "@/lib/prisma";
import {
  footballGoalkeeperStatKeys,
  footballOutfieldStatKeys,
  type FootballSyncKind,
  type FootballSyncPreview,
} from "@/lib/football-sync-contract";

const matchInclude = {
  club: { include: { players: { where: { active: true }, orderBy: [{ shirtNumber: "asc" as const }, { name: "asc" as const }] } } },
  opponentClub: true,
  competition: { include: { season: true } },
  squad: { orderBy: { sortOrder: "asc" as const }, include: { player: true } },
  playerActions: { include: { subActions: true } },
};

function emptyStats(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

export async function buildFootballSyncPreview(matchId: string, workspaceId: string): Promise<FootballSyncPreview> {
  const [match, connection] = await Promise.all([
    prisma.match.findFirst({ where: { id: matchId, workspaceId }, include: matchInclude }),
    prisma.footballOurPlayersConnection.findUnique({ where: { workspaceId }, select: { id: true } }),
  ]);
  if (!match) throw new Error("Match not found.");

  const summaries = new Map(match.squad.map((item) => [item.playerId, {
    id: item.player.id,
    name: item.player.name,
    position: item.player.position,
    isGoalkeeper: item.player.isGoalkeeper,
    lineupGroup: item.lineupGroup,
    minutesPlayed: item.minutesPlayed,
    totalActions: 0,
    stats: emptyStats(footballOutfieldStatKeys),
    goalkeeperStats: emptyStats(footballGoalkeeperStatKeys),
  }]));
  let unclassifiedOccurrences = 0;
  for (const occurrence of match.playerActions) {
    const summary = summaries.get(occurrence.playerId);
    if (!summary) continue;
    const actions = occurrence.subActions.length
      ? occurrence.subActions
      : occurrence.actionKey !== "unclassified" ? [occurrence] : [];
    if (!actions.length) unclassifiedOccurrences += 1;
    for (const action of actions) {
      if (footballOutfieldStatKeys.includes(action.actionKey as typeof footballOutfieldStatKeys[number])) {
        summary.stats[action.actionKey] = (summary.stats[action.actionKey] || 0) + 1;
        summary.totalActions += 1;
      } else if (footballGoalkeeperStatKeys.includes(action.actionKey as typeof footballGoalkeeperStatKeys[number])) {
        summary.goalkeeperStats[action.actionKey] = (summary.goalkeeperStats[action.actionKey] || 0) + 1;
        summary.totalActions += 1;
      }
    }
  }
  const players = [...summaries.values()];
  return {
    configured: Boolean(connection),
    match: {
      id: match.id,
      date: match.matchDate?.toISOString().slice(0, 10) || null,
      roundName: match.roundName,
      homeAway: match.homeAway,
      syncedAt: match.footballSyncedAt?.toISOString() || null,
    },
    season: { id: match.competition.season.id, name: match.competition.season.name, syncedAt: match.competition.season.footballSyncedAt?.toISOString() || null },
    competition: { id: match.competition.id, name: match.competition.name, syncedAt: match.competition.footballSyncedAt?.toISOString() || null },
    team: { id: match.club.id, name: match.club.name, syncedAt: match.club.footballSyncedAt?.toISOString() || null, playerCount: match.club.players.length },
    opponent: { id: match.opponentClub.id, name: match.opponentClub.name },
    players,
    playersWithoutIdentifiedMoments: players.filter((player) => player.totalActions === 0).map((player) => player.name),
    totalActions: players.reduce((sum, player) => sum + player.totalActions, 0),
    unclassifiedOccurrences,
  };
}

export async function buildFootballPayload(matchId: string, workspaceId: string, kind: FootballSyncKind) {
  const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId }, include: matchInclude });
  if (!match) throw new Error("Match not found.");
  const preview = await buildFootballSyncPreview(matchId, workspaceId);
  const base = { version: 1 as const, kind, sourceWorkspaceId: workspaceId };
  const season = { id: match.competition.season.id, name: match.competition.season.name };
  const competition = { id: match.competition.id, name: match.competition.name };
  const team = {
    id: match.club.id,
    name: match.club.name,
    players: match.club.players.map((player) => ({ id: player.id, name: player.name, position: player.position, isGoalkeeper: player.isGoalkeeper })),
  };
  if (kind === "season") return { ...base, season };
  if (kind === "competition") return { ...base, season, competition };
  if (kind === "team") return { ...base, team };
  if (!preview.match.date) throw new Error("Enter the match date before synchronizing the match.");
  return {
    ...base,
    season,
    competition,
    team,
    opponent: { id: match.opponentClub.id, name: match.opponentClub.name },
    match: {
      id: match.id,
      date: preview.match.date,
      roundName: match.roundName,
      homeAway: match.homeAway === "AWAY" ? "away" as const : "home" as const,
    },
    players: preview.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      isGoalkeeper: player.isGoalkeeper,
      minutesPlayed: player.minutesPlayed ?? 0,
      stats: player.stats,
      goalkeeperStats: player.goalkeeperStats,
    })),
  };
}

export async function sendFootballPayload(payload: unknown, workspaceId: string) {
  const connection = await prisma.footballOurPlayersConnection.findUnique({ where: { workspaceId } });
  if (!connection) throw new Error("Link this workspace to FootballOurPlayers before synchronizing.");
  const response = await fetch(`${connection.remoteBaseUrl}/api/integrations/video-analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connection.accessToken}`,
      "X-Integration-Connection": connection.remoteConnectionId,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `FootballOurPlayers returned HTTP ${response.status}.`);
  await prisma.footballOurPlayersConnection.update({ where: { workspaceId }, data: { lastUsedAt: new Date() } });
  return { ...result, destinationUrl: result?.href ? `${connection.remoteBaseUrl}${result.href}` : connection.remoteBaseUrl };
}
