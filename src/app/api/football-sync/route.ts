import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { requireAreaAccount } from "@/lib/auth";
import { sendFootballPayload } from "@/lib/football-sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAreaAccount("squad");
    const body = await request.json();
    const kind = body.kind as "season" | "competition" | "team" | "player";
    const id = typeof body.id === "string" ? body.id : "";
    if (!id || !["season", "competition", "team", "player"].includes(kind)) return badRequest("Select a valid item to synchronize.");

    if (kind === "season") {
      const season = await prisma.season.findFirst({ where: { id, workspaceId: workspace.id } });
      if (!season) return notFound("Season not found.");
      const remote = await sendFootballPayload({
        version: 1,
        kind,
        sourceWorkspaceId: workspace.id,
        season: { id: season.id, name: season.name },
      }, workspace.id);
      await prisma.season.update({ where: { id: season.id }, data: { footballSyncedAt: new Date() } });
      return ok({ synchronized: true, kind, remote });
    }

    if (kind === "competition") {
      const competition = await prisma.competition.findFirst({
        where: { id, workspaceId: workspace.id },
        include: { season: true },
      });
      if (!competition) return notFound("Competition not found.");
      const remote = await sendFootballPayload({
        version: 1,
        kind,
        sourceWorkspaceId: workspace.id,
        season: { id: competition.season.id, name: competition.season.name },
        competition: { id: competition.id, name: competition.name },
      }, workspace.id);
      const now = new Date();
      await prisma.$transaction([
        prisma.season.update({ where: { id: competition.seasonId }, data: { footballSyncedAt: now } }),
        prisma.competition.update({ where: { id: competition.id }, data: { footballSyncedAt: now } }),
      ]);
      return ok({ synchronized: true, kind, remote });
    }

    if (kind === "player") {
      const player = await prisma.player.findFirst({
        where: { id, workspaceId: workspace.id, club: { isClientClub: true } },
        include: { club: true },
      });
      if (!player) return notFound("Player not found.");
      const remote = await sendFootballPayload({
        version: 1,
        kind,
        sourceWorkspaceId: workspace.id,
        team: { id: player.club.id, name: player.club.name },
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          isGoalkeeper: player.isGoalkeeper,
        },
      }, workspace.id);
      await prisma.player.update({ where: { id: player.id }, data: { footballSyncedAt: new Date() } });
      return ok({ synchronized: true, kind, remote });
    }

    const team = await prisma.club.findFirst({
      where: { id, workspaceId: workspace.id, isClientClub: true },
      include: { players: { where: { active: true }, orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] } },
    });
    if (!team) return notFound("Analysed team not found.");
    const remote = await sendFootballPayload({
      version: 1,
      kind,
      sourceWorkspaceId: workspace.id,
      team: {
        id: team.id,
        name: team.name,
        players: team.players.map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          isGoalkeeper: player.isGoalkeeper,
        })),
      },
    }, workspace.id);
    const now = new Date();
    await prisma.$transaction([
      prisma.club.update({ where: { id: team.id }, data: { footballSyncedAt: now } }),
      prisma.player.updateMany({ where: { clubId: team.id, active: true }, data: { footballSyncedAt: now } }),
    ]);
    return ok({ synchronized: true, kind, remote });
  } catch (error) {
    return serverError(error);
  }
}
