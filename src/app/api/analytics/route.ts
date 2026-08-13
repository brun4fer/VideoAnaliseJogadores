import { ok, serverError } from "@/lib/api";
import { getWorkspace, prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const workspace = await getWorkspace();
    const [players, actions] = await Promise.all([
      prisma.player.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" }, include: { club: true } }),
      prisma.playerAction.findMany({ where: { match: { workspaceId: workspace.id } }, orderBy: { createdAt: "desc" }, include: { player: { include: { club: true } }, match: { include: { competition: { include: { season: true } } } } } }),
    ]);
    return ok({ players, actions });
  } catch (error) { return serverError(error); }
}
