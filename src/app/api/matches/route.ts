import { badRequest, ok, serverError } from "@/lib/api";
import { getWorkspace, prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const workspace = await getWorkspace();
    const matches = await prisma.match.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ matchDate: "desc" }, { createdAt: "desc" }], include: { club: true, competition: { include: { season: true } }, video: true, _count: { select: { playerActions: true } } } });
    return ok(matches.map(({ video, ...match }) => ({ ...match, video: video ? { ...video, fileSize: video.fileSize.toString() } : null })));
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  try {
    const workspace = await getWorkspace();
    const body = await request.json();
    if (!body.title?.trim() || !body.opponentName?.trim() || !body.clubId || !body.competitionId) return badRequest("Preenche o título, adversário, campeonato e clube.");
    const competition = await prisma.competition.findFirst({ where: { id: body.competitionId, workspaceId: workspace.id, clubs: { some: { id: body.clubId } } } });
    if (!competition) return badRequest("O clube não pertence ao campeonato selecionado.");
    const match = await prisma.match.create({ data: { title: body.title.trim(), opponentName: body.opponentName.trim(), matchDate: body.matchDate ? new Date(body.matchDate) : null, roundName: body.roundName?.trim() || null, venue: body.venue?.trim() || null, notes: body.notes?.trim() || null, clubId: body.clubId, competitionId: body.competitionId, workspaceId: workspace.id } });
    return ok(match, 201);
  } catch (error) { return serverError(error); }
}
