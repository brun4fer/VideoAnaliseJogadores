import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { workspace } = await requireAccount();
    const [clientClub, seasons, opponents] = await Promise.all([
      prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true }, include: { players: { orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] }, competitions: { select: { id: true, name: true } } } }),
      prisma.season.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, include: { competitions: { orderBy: { name: "asc" }, include: { clubs: { where: { isClientClub: false }, orderBy: { name: "asc" } } } } } }),
      prisma.club.findMany({ where: { workspaceId: workspace.id, isClientClub: false }, orderBy: { name: "asc" }, include: { competitions: { select: { id: true, name: true } } } }),
    ]);
    return ok({ workspace, clientClub, seasons, opponents });
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAccount(); const body = await request.json();
    if (body.kind === "clientClub") {
      if (!body.name?.trim()) return badRequest("Enter the client team name.");
      const existing = await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } });
      const data = { name: body.name.trim(), shortName: body.shortName?.trim() || null };
      if (existing) return ok(await prisma.club.update({ where: { id: existing.id }, data }));
      const competitions = await prisma.competition.findMany({ where: { workspaceId: workspace.id }, select: { id: true } });
      return ok(await prisma.club.create({ data: { ...data, isClientClub: true, workspaceId: workspace.id, competitions: { connect: competitions } } }), 201);
    }
    if (body.kind === "season") {
      if (!body.name?.trim()) return badRequest("Enter the season name.");
      return ok(await prisma.season.create({ data: { name: body.name.trim(), workspaceId: workspace.id } }), 201);
    }
    if (body.kind === "competition") {
      if (!body.name?.trim() || !body.seasonId) return badRequest("Select the season and enter the competition name.");
      const season = await prisma.season.findFirst({ where: { id: body.seasonId, workspaceId: workspace.id } });
      if (!season) return badRequest("The selected season does not belong to your account.");
      const clientClub = await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } });
      return ok(await prisma.competition.create({ data: { name: body.name.trim(), seasonId: season.id, workspaceId: workspace.id, ...(clientClub ? { clubs: { connect: { id: clientClub.id } } } : {}) } }), 201);
    }
    if (body.kind === "opponent") {
      if (!body.name?.trim() || !body.competitionId) return badRequest("Select the competition and enter the opponent.");
      const competition = await prisma.competition.findFirst({ where: { id: body.competitionId, workspaceId: workspace.id } });
      if (!competition) return badRequest("The selected competition does not belong to your account.");
      const name = body.name.trim();
      const existing = await prisma.club.findFirst({ where: { workspaceId: workspace.id, name } });
      if (existing?.isClientClub) return badRequest("The client team cannot be registered as an opponent.");
      if (existing) return ok(await prisma.club.update({ where: { id: existing.id }, data: { competitions: { connect: { id: competition.id } } } }));
      return ok(await prisma.club.create({ data: { name, shortName: body.shortName?.trim() || null, workspaceId: workspace.id, isClientClub: false, competitions: { connect: { id: competition.id } } } }), 201);
    }
    if (body.kind === "player") {
      if (!body.name?.trim()) return badRequest("Enter the player name.");
      const clientClub = await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } });
      if (!clientClub) return badRequest("Set up the client team first.");
      const shirtNumber = body.shirtNumber === "" || body.shirtNumber == null ? null : Number(body.shirtNumber);
      return ok(await prisma.player.create({ data: { name: body.name.trim(), shirtNumber, position: body.position?.trim() || null, isGoalkeeper: Boolean(body.isGoalkeeper), clubId: clientClub.id, workspaceId: workspace.id } }), 201);
    }
    return badRequest("Invalid record type.");
  } catch (error) { return serverError(error); }
}
