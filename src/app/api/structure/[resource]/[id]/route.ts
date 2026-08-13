import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { workspace } = await requireAccount(); const { resource, id } = await context.params;
    if (resource === "season") await prisma.season.deleteMany({ where: { id, workspaceId: workspace.id } });
    else if (resource === "competition") await prisma.competition.deleteMany({ where: { id, workspaceId: workspace.id } });
    else if (resource === "opponent") await prisma.club.deleteMany({ where: { id, workspaceId: workspace.id, isClientClub: false } });
    else if (resource === "player") await prisma.player.deleteMany({ where: { id, workspaceId: workspace.id, club: { isClientClub: true } } });
    else return badRequest("Invalid resource.");
    return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
