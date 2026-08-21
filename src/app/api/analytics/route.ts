import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeVideo } from "@/lib/video";

export async function GET() {
  try {
    const { workspace } = await requireAccount();
    const [players, occurrences, matches, competitions] = await Promise.all([
      prisma.player.findMany({ where: { workspaceId: workspace.id, club: { isClientClub: true } }, orderBy: { name: "asc" }, include: { club: true } }),
      prisma.playerAction.findMany({ where: { match: { workspaceId: workspace.id } }, orderBy: { eventTimeSeconds: "asc" }, include: { subActions: { orderBy: { eventTimeSeconds: "asc" } }, player: { include: { club: true } }, match: { include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true } } } }),
      prisma.match.findMany({ where: { workspaceId: workspace.id }, orderBy: { matchDate: "desc" }, include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true } }),
      prisma.competition.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" }, include: { season: true } }),
    ]);
    const serializeRowVideo = <T extends { video: Parameters<typeof serializeVideo>[0] | null }>(row: T) => ({ ...row, video: row.video ? serializeVideo(row.video) : null });
    const actions = occurrences.flatMap((occurrence) => {
      const subActions = occurrence.subActions.length ? occurrence.subActions : occurrence.actionKey !== "unclassified" ? [{
        id: occurrence.id, playerActionId: occurrence.id, actionKey: occurrence.actionKey, actionName: occurrence.actionName,
        eventTimeSeconds: occurrence.eventTimeSeconds, fieldX: occurrence.fieldX, fieldY: occurrence.fieldY,
        notes: occurrence.notes, outcome: occurrence.outcome, createdAt: occurrence.createdAt, updatedAt: occurrence.updatedAt,
      }] : [];
      return subActions.map((subAction) => ({
        ...subAction,
        parentActionId: occurrence.id,
        matchId: occurrence.matchId,
        playerId: occurrence.playerId,
        period: occurrence.period,
        startTimeSeconds: occurrence.startTimeSeconds,
        endTimeSeconds: occurrence.endTimeSeconds,
        player: occurrence.player,
        match: serializeRowVideo(occurrence.match),
      }));
    });
    return ok({ players, actions, matches: matches.map(serializeRowVideo), competitions });
  } catch (error) { return serverError(error); }
}
