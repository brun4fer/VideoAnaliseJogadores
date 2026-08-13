import { actionTypeByKey } from "@/lib/action-types";
import { badRequest, ok, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ actionId: string }> }) {
  try {
    const { actionId } = await context.params; const body = await request.json();
    const type = body.actionKey ? actionTypeByKey.get(body.actionKey) : null;
    if (body.actionKey && !type) return badRequest("Ação inválida.");
    const action = await prisma.playerAction.update({ where: { id: actionId }, data: { ...(type ? { actionKey: type.key, actionName: type.name } : {}), ...(body.fieldX !== undefined ? { fieldX: body.fieldX == null ? null : Number(body.fieldX) } : {}), ...(body.fieldY !== undefined ? { fieldY: body.fieldY == null ? null : Number(body.fieldY) } : {}), ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}), ...(body.outcome !== undefined ? { outcome: body.outcome || null } : {}) }, include: { player: true } });
    return ok(action);
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ actionId: string }> }) {
  try { const { actionId } = await context.params; await prisma.playerAction.delete({ where: { id: actionId } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}
