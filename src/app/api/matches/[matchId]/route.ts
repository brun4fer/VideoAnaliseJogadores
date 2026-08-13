import { notFound, ok, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { club: { include: { players: { where: { active: true }, orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] } } }, competition: { include: { season: true } }, video: true, playerActions: { orderBy: { eventTimeSeconds: "asc" }, include: { player: true } } } });
    if (!match) return notFound("Jogo não encontrado.");
    return ok({ ...match, matchDate: match.matchDate?.toISOString() || null, video: match.video ? { ...match.video, fileSize: match.video.fileSize.toString() } : null });
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try { const { matchId } = await context.params; await prisma.match.delete({ where: { id: matchId } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}
