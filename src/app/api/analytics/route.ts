import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { workspace } = await requireAccount();
    const [players, actions, matches, competitions] = await Promise.all([
      prisma.player.findMany({ where: { workspaceId: workspace.id, club: { isClientClub: true } }, orderBy: { name: "asc" }, include: { club: true } }),
      prisma.playerAction.findMany({ where: { match: { workspaceId: workspace.id } }, orderBy: { eventTimeSeconds: "asc" }, include: { player: { include: { club: true } }, match: { include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true } } } }),
      prisma.match.findMany({ where: { workspaceId: workspace.id }, orderBy: { matchDate: "desc" }, include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true } }),
      prisma.competition.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" }, include: { season: true } }),
    ]);
    const serializeVideo = <T extends { video: { fileSize: bigint } | null }>(row: T) => ({ ...row, video: row.video ? { ...row.video, fileSize: row.video.fileSize.toString() } : null });
    return ok({ players, actions: actions.map((action) => ({ ...action, match: serializeVideo(action.match) })), matches: matches.map(serializeVideo), competitions });
  } catch (error) { return serverError(error); }
}
