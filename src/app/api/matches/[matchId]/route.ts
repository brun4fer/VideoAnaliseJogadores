import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortPlayersByPosition } from "@/lib/player-positions";
import { periodMarkers, type PeriodMarkerKey, validatePeriodMarkers } from "@/lib/match-periods";
import { abortMultipartUpload, deleteR2Object } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

const matchInclude = {
  club: { include: { players: { where: { active: true }, orderBy: [{ shirtNumber: "asc" as const }, { name: "asc" as const }] } } },
  squad: { orderBy: { sortOrder: "asc" as const }, include: { player: true } },
  opponentClub: true,
  competition: { include: { season: true } },
  video: true,
  playerActions: { orderBy: { eventTimeSeconds: "asc" as const }, include: { player: true, subActions: { orderBy: { eventTimeSeconds: "asc" as const } } } },
};

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireManagementAccount();
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: matchInclude });
    if (!match) return notFound("Match not found.");
    const fallbackPlayers = sortPlayersByPosition(match.club.players).slice(0, 18);
    const squad = match.squad.length ? match.squad : fallbackPlayers.map((player, sortOrder) => ({ matchId, playerId: player.id, sortOrder, createdAt: match.createdAt, player }));
    return ok({ ...match, squad, matchDate: match.matchDate?.toISOString() || null, video: match.video ? serializeVideo(match.video) : null });
  } catch (error) { return serverError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireManagementAccount();
    const { matchId } = await context.params;
    const body = await request.json();
    const existing = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id } });
    if (!existing) return notFound("Match not found.");
    const competitionId = body.competitionId || existing.competitionId;
    const opponentClubId = body.opponentClubId || existing.opponentClubId;
    const opponent = await prisma.club.findFirst({ where: { id: opponentClubId, workspaceId: workspace.id, isClientClub: false, competitions: { some: { id: competitionId } } } });
    if (!opponent) return notFound("The selected opponent is not available in this competition.");
    const playerIds = body.playerIds === undefined ? null : uniquePlayerIds(body.playerIds);
    if (playerIds && (playerIds.length < 1 || playerIds.length > 18)) return badRequest("Select between 1 and 18 players.");
    if (playerIds) {
      const validCount = await prisma.player.count({ where: { id: { in: playerIds }, workspaceId: workspace.id, clubId: existing.clubId, active: true } });
      if (validCount !== playerIds.length) return badRequest("One or more selected players are invalid.");
    }
    const markerData: Partial<Record<PeriodMarkerKey, number | null>> = {};
    for (const [key] of periodMarkers) {
      if (body[key] === undefined) continue;
      const value = body[key] === null || body[key] === "" ? null : Number(body[key]);
      if (value !== null && !Number.isFinite(value)) return badRequest("Invalid match period marker.");
      markerData[key] = value;
    }
    const nextMarkers = Object.fromEntries(periodMarkers.map(([key]) => [key, markerData[key] === undefined ? existing[key] : markerData[key]])) as Required<Record<PeriodMarkerKey, number | null>>;
    try { validatePeriodMarkers(nextMarkers); }
    catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid match period markers."); }

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.match.update({ where: { id: existing.id }, data: {
        competitionId, opponentClubId, ...markerData,
        ...(body.matchDate !== undefined ? { matchDate: body.matchDate ? new Date(body.matchDate) : null } : {}),
        ...(body.roundName !== undefined ? { roundName: body.roundName?.trim() || null } : {}),
        ...(body.venue !== undefined ? { venue: body.venue?.trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        ...(body.firstHalfAttacksRight !== undefined ? { firstHalfAttacksRight: Boolean(body.firstHalfAttacksRight) } : {}),
      } });
      if (playerIds) {
        await transaction.matchSquad.deleteMany({ where: { matchId } });
        await transaction.matchSquad.createMany({ data: playerIds.map((playerId, sortOrder) => ({ matchId, playerId, sortOrder })) });
      }
      if (Object.keys(markerData).length) {
        await transaction.playerAction.updateMany({ where: { matchId }, data: { period: null } });
        if (nextMarkers.firstHalfStartSeconds !== null && nextMarkers.firstHalfEndSeconds !== null) {
          await transaction.playerAction.updateMany({ where: { matchId, eventTimeSeconds: { gte: nextMarkers.firstHalfStartSeconds, lte: nextMarkers.firstHalfEndSeconds } }, data: { period: 1 } });
        }
        if (nextMarkers.secondHalfStartSeconds !== null && nextMarkers.secondHalfEndSeconds !== null) {
          await transaction.playerAction.updateMany({ where: { matchId, eventTimeSeconds: { gte: nextMarkers.secondHalfStartSeconds, lte: nextMarkers.secondHalfEndSeconds } }, data: { period: 2 } });
        }
      }
      return transaction.match.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude });
    });
    return ok({ ...updated, matchDate: updated.matchDate?.toISOString() || null, video: updated.video ? serializeVideo(updated.video) : null });
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireManagementAccount();
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match) return ok({ deleted: true });
    if (match.video?.ownerId === user.id && match.video.storageKey) {
      if (match.video.uploadId) await abortMultipartUpload(match.video.storageKey, match.video.uploadId).catch(() => undefined);
      await deleteR2Object(match.video.storageKey);
    }
    await prisma.match.delete({ where: { id: match.id } });
    return ok({ deleted: true });
  }
  catch (error) { return serverError(error); }
}

function uniquePlayerIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}
