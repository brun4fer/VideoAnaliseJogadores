import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { workspace } = await requireAccount();
    const matches = await prisma.match.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ matchDate: "desc" }, { createdAt: "desc" }], include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true, _count: { select: { playerActions: true } } } });
    return ok(matches.map(({ video, ...match }) => ({ ...match, video: video ? { ...video, fileSize: video.fileSize.toString() } : null })));
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAccount(); const body = await request.json();
    if (!body.opponentClubId || !body.competitionId) return badRequest("Seleciona a competição e a equipa adversária.");
    const [clientClub, competition, opponent] = await Promise.all([
      prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } }),
      prisma.competition.findFirst({ where: { id: body.competitionId, workspaceId: workspace.id } }),
      prisma.club.findFirst({ where: { id: body.opponentClubId, workspaceId: workspace.id, isClientClub: false, competitions: { some: { id: body.competitionId } } } }),
    ]);
    if (!clientClub) return badRequest("Configura primeiro a equipa do cliente.");
    if (!competition || !opponent) return badRequest("A competição ou o adversário selecionado não é válido.");
    const match = await prisma.match.create({ data: { matchDate: body.matchDate ? new Date(body.matchDate) : null, roundName: body.roundName?.trim() || null, venue: body.venue?.trim() || null, notes: body.notes?.trim() || null, clubId: clientClub.id, opponentClubId: opponent.id, competitionId: competition.id, workspaceId: workspace.id } });
    return ok(match, 201);
  } catch (error) { return serverError(error); }
}
