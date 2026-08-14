import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ actionId: string }> }) {
  try {
    const { workspace } = await requireAccount();
    const { actionId } = await context.params;
    const body = await request.json();
    const existing = await prisma.playerAction.findFirst({ where: { id: actionId, match: { workspaceId: workspace.id } } });
    if (!existing) return badRequest("Invalid player occurrence.");
    return ok(await prisma.playerAction.update({ where: { id: actionId }, data: {
      ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
    }, include: { player: true, subActions: { orderBy: { eventTimeSeconds: "asc" } } } }));
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ actionId: string }> }) {
  try { const { workspace } = await requireAccount(); const { actionId } = await context.params; await prisma.playerAction.deleteMany({ where: { id: actionId, match: { workspaceId: workspace.id } } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}
