import { actionsForPlayer } from "@/lib/action-types";
import { badRequest, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { getMatchPeriodAtTime } from "@/lib/match-periods";
import { prisma } from "@/lib/prisma";
import { roundTime } from "@/lib/time";

export async function PATCH(request: Request, context: { params: Promise<{ actionId: string }> }) {
  try {
    const { workspace } = await requireManagementAccount();
    const { actionId } = await context.params;
    const body = await request.json();
    const existing = await prisma.playerAction.findFirst({
      where: { id: actionId, match: { workspaceId: workspace.id } },
      include: { player: true, subActions: true, match: { include: { squad: true, video: true } } },
    });
    if (!existing) return badRequest("Invalid player occurrence.");
    const playerId = body.playerId === undefined ? existing.playerId : String(body.playerId);
    const player = playerId === existing.playerId ? existing.player : await prisma.player.findFirst({
      where: { id: playerId, clubId: existing.match.clubId, workspaceId: workspace.id, club: { isClientClub: true } },
    });
    const playerChanged = playerId !== existing.playerId;
    if (!player) return badRequest("The selected player does not belong to this match's club.");
    if (playerChanged && existing.match.squad.length && !existing.match.squad.some((item) => item.playerId === player.id)) return badRequest("The selected player is not in this match's squad.");

    const eventTimeSeconds = body.eventTimeSeconds === undefined ? existing.eventTimeSeconds : Number(body.eventTimeSeconds);
    const startTimeSeconds = body.startTimeSeconds === undefined ? existing.startTimeSeconds : Number(body.startTimeSeconds);
    const endTimeSeconds = body.endTimeSeconds === undefined ? existing.endTimeSeconds : Number(body.endTimeSeconds);
    const timesChanged = body.eventTimeSeconds !== undefined || body.startTimeSeconds !== undefined || body.endTimeSeconds !== undefined;
    if (timesChanged) {
      if (![eventTimeSeconds, startTimeSeconds, endTimeSeconds].every((value) => Number.isFinite(value))) return badRequest("Enter valid occurrence times.");
      if (startTimeSeconds < 0 || endTimeSeconds <= startTimeSeconds) return badRequest("The clip end must be after its start.");
      if (eventTimeSeconds < startTimeSeconds || eventTimeSeconds > endTimeSeconds) return badRequest("The occurrence time must be inside the clip.");
      if (existing.match.video?.durationSeconds && endTimeSeconds > existing.match.video.durationSeconds + 0.1) return badRequest("The clip cannot end after the match video.");
      if (existing.subActions.some((item) => item.eventTimeSeconds < startTimeSeconds || item.eventTimeSeconds > endTimeSeconds)) return badRequest("The clip must continue to include every saved subaction.");
    }
    if (playerChanged) {
      const allowedActionKeys = new Set(actionsForPlayer(player.isGoalkeeper).map((item) => item.key));
      if (existing.subActions.some((item) => !allowedActionKeys.has(item.actionKey))) return badRequest("This player cannot use one or more of the saved subactions.");
    }

    return ok(await prisma.playerAction.update({ where: { id: actionId }, data: {
      ...(body.playerId !== undefined ? { playerId: player.id } : {}),
      ...(timesChanged ? {
        eventTimeSeconds: roundTime(eventTimeSeconds),
        startTimeSeconds: roundTime(startTimeSeconds),
        endTimeSeconds: roundTime(endTimeSeconds),
        period: getMatchPeriodAtTime(existing.match, eventTimeSeconds),
      } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
    }, include: { player: true, subActions: { orderBy: { eventTimeSeconds: "asc" } } } }));
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ actionId: string }> }) {
  try { const { workspace } = await requireManagementAccount(); const { actionId } = await context.params; await prisma.playerAction.deleteMany({ where: { id: actionId, match: { workspaceId: workspace.id } } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}
