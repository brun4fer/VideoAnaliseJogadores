import { actionsForPlayer, actionTypeByKey } from "@/lib/action-types";
import { badRequest, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundTime } from "@/lib/time";

export async function PATCH(request: Request, context: { params: Promise<{ subActionId: string }> }) {
  try {
    const { workspace } = await requireManagementAccount();
    const { subActionId } = await context.params;
    const body = await request.json();
    const current = await prisma.playerSubAction.findFirst({ where: { id: subActionId, playerAction: { match: { workspaceId: workspace.id } } }, include: { playerAction: { include: { player: true } } } });
    if (!current) return badRequest("Invalid subaction.");
    const type = body.actionKey ? actionTypeByKey.get(String(body.actionKey)) : actionTypeByKey.get(current.actionKey);
    if (!type || !actionsForPlayer(current.playerAction.player.isGoalkeeper).some((item) => item.key === type.key)) return badRequest("This action is not available for the selected player.");
    const eventTime = body.eventTimeSeconds === undefined ? current.eventTimeSeconds : Number(body.eventTimeSeconds);
    if (!Number.isFinite(eventTime) || eventTime < current.playerAction.startTimeSeconds || eventTime > current.playerAction.endTimeSeconds) return badRequest("The action time must be inside the occurrence clip.");
    return ok(await prisma.playerSubAction.update({ where: { id: current.id }, data: {
      actionKey: type.key, actionName: type.name, outcome: type.outcome || null, eventTimeSeconds: roundTime(eventTime),
      ...(body.fieldX !== undefined ? { fieldX: numberOrNull(body.fieldX) } : {}),
      ...(body.fieldY !== undefined ? { fieldY: numberOrNull(body.fieldY) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
    } }));
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ subActionId: string }> }) {
  try { const { workspace } = await requireManagementAccount(); const { subActionId } = await context.params; await prisma.playerSubAction.deleteMany({ where: { id: subActionId, playerAction: { match: { workspaceId: workspace.id } } } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}

function numberOrNull(value: unknown) { return value == null || value === "" ? null : Number(value); }
