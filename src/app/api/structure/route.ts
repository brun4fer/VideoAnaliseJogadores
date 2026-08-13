import { badRequest, ok, serverError } from "@/lib/api";
import { getWorkspace, prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const workspace = await getWorkspace();
    const seasons = await prisma.season.findMany({
      where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" },
      include: { competitions: { orderBy: { name: "asc" }, include: { clubs: { orderBy: { name: "asc" }, include: { players: { orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] } } } } } },
    });
    return ok({ workspace, seasons });
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  try {
    const workspace = await getWorkspace();
    const body = await request.json();
    if (body.kind === "season") {
      if (!body.name?.trim()) return badRequest("Indica o nome da época.");
      return ok(await prisma.season.create({ data: { name: body.name.trim(), workspaceId: workspace.id } }), 201);
    }
    if (body.kind === "competition") {
      if (!body.name?.trim() || !body.seasonId) return badRequest("Indica a época e o nome do campeonato.");
      return ok(await prisma.competition.create({ data: { name: body.name.trim(), seasonId: body.seasonId, workspaceId: workspace.id } }), 201);
    }
    if (body.kind === "club") {
      if (!body.name?.trim() || !body.competitionId) return badRequest("Indica o campeonato e o clube.");
      const club = await prisma.club.create({ data: { name: body.name.trim(), shortName: body.shortName?.trim() || null, badgeUrl: body.badgeUrl?.trim() || null, workspaceId: workspace.id, competitionId: body.competitionId } });
      return ok(club, 201);
    }
    if (body.kind === "player") {
      if (!body.name?.trim() || !body.clubId) return badRequest("Indica o clube e o nome do jogador.");
      const shirtNumber = body.shirtNumber === "" || body.shirtNumber == null ? null : Number(body.shirtNumber);
      return ok(await prisma.player.create({ data: { name: body.name.trim(), shirtNumber, photoUrl: body.photoUrl?.trim() || null, position: body.position?.trim() || null, isGoalkeeper: Boolean(body.isGoalkeeper), clubId: body.clubId, workspaceId: workspace.id } }), 201);
    }
    return badRequest("Tipo de registo inválido.");
  } catch (error) { return serverError(error); }
}
