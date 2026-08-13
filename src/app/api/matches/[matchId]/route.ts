import { notFound, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAccount(); const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { club: { include: { players: { where: { active: true }, orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] } } }, opponentClub: true, competition: { include: { season: true } }, video: true, playerActions: { orderBy: { eventTimeSeconds: "asc" }, include: { player: true } } } });
    if (!match) return notFound("Match not found.");
    return ok({ ...match, matchDate: match.matchDate?.toISOString() || null, video: match.video ? { ...match.video, fileSize: match.video.fileSize.toString() } : null });
  } catch (error) { return serverError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAccount(); const { matchId } = await context.params; const body = await request.json();
    const existing = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id } });
    if (!existing) return notFound("Match not found.");
    const competitionId = body.competitionId || existing.competitionId; const opponentClubId = body.opponentClubId || existing.opponentClubId;
    const opponent = await prisma.club.findFirst({ where: { id: opponentClubId, workspaceId: workspace.id, isClientClub: false, competitions: { some: { id: competitionId } } } });
    if (!opponent) return notFound("The selected opponent is not available in this competition.");
    return ok(await prisma.match.update({ where: { id: existing.id }, data: { competitionId, opponentClubId, matchDate: body.matchDate ? new Date(body.matchDate) : null, roundName: body.roundName?.trim() || null, venue: body.venue?.trim() || null, notes: body.notes?.trim() || null } }));
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try { const { workspace } = await requireAccount(); const { matchId } = await context.params; await prisma.match.deleteMany({ where: { id: matchId, workspaceId: workspace.id } }); return ok({ deleted: true }); }
  catch (error) { return serverError(error); }
}
