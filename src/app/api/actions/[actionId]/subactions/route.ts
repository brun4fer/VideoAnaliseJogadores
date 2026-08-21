import { actionsForPlayer, actionTypeByKey } from "@/lib/action-types";
import { badRequest, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundTime } from "@/lib/time";

export async function POST(request: Request, context: { params: Promise<{ actionId: string }> }) {
  try {
    const { workspace } = await requireManagementAccount();
    const { actionId } = await context.params;
    const body = await request.json();
    const occurrence = await prisma.playerAction.findFirst({ where: { id: actionId, match: { workspaceId: workspace.id } }, include: { player: true } });
    if (!occurrence) return badRequest("Invalid player occurrence.");
    const type = actionTypeByKey.get(String(body.actionKey));
    if (!type || !actionsForPlayer(occurrence.player.isGoalkeeper).some((item) => item.key === type.key)) return badRequest("This action is not available for the selected player.");
    const eventTime = Number(body.eventTimeSeconds);
    if (!Number.isFinite(eventTime) || eventTime < occurrence.startTimeSeconds || eventTime > occurrence.endTimeSeconds) return badRequest("The action time must be inside the occurrence clip.");
    const saved = await prisma.playerSubAction.create({ data: {
      playerActionId: occurrence.id,
      actionKey: type.key,
      actionName: type.name,
      eventTimeSeconds: roundTime(eventTime),
      fieldX: numberOrNull(body.fieldX), fieldY: numberOrNull(body.fieldY),
      notes: body.notes?.trim() || null,
      outcome: type.outcome || null,
    } });
    return ok(saved, 201);
  } catch (error) { return serverError(error); }
}

function numberOrNull(value: unknown) { return value == null || value === "" ? null : Number(value); }
