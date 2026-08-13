import { badRequest, ok, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (resource === "season") await prisma.season.delete({ where: { id } });
    else if (resource === "competition") await prisma.competition.delete({ where: { id } });
    else if (resource === "club") await prisma.club.delete({ where: { id } });
    else if (resource === "player") await prisma.player.delete({ where: { id } });
    else return badRequest("Recurso inválido.");
    return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
