import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

export async function DELETE(_: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { workspace } = await requireAccount(); const { resource, id } = await context.params;
    if (resource === "season") await prisma.season.deleteMany({ where: { id, workspaceId: workspace.id } });
    else if (resource === "competition") await prisma.competition.deleteMany({ where: { id, workspaceId: workspace.id } });
    else if (resource === "opponent") {
      const club = await prisma.club.findFirst({ where: { id, workspaceId: workspace.id, isClientClub: false }, select: { badgeStorageKey: true } });
      await prisma.club.deleteMany({ where: { id, workspaceId: workspace.id, isClientClub: false } });
      if (club?.badgeStorageKey) await deleteR2Object(club.badgeStorageKey).catch(() => undefined);
    }
    else if (resource === "player") {
      const player = await prisma.player.findFirst({ where: { id, workspaceId: workspace.id, club: { isClientClub: true } }, select: { photoStorageKey: true } });
      await prisma.player.deleteMany({ where: { id, workspaceId: workspace.id, club: { isClientClub: true } } });
      if (player?.photoStorageKey) await deleteR2Object(player.photoStorageKey).catch(() => undefined);
    }
    else return badRequest("Invalid resource.");
    return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
