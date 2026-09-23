import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { requireAreaAccount } from "@/lib/auth";
import { buildFootballPayload, buildFootballSyncPreview, sendFootballPayload } from "@/lib/football-sync";
import type { FootballSyncKind } from "@/lib/football-sync-contract";
import { prisma } from "@/lib/prisma";

const kinds = new Set<FootballSyncKind>(["season", "competition", "team", "match"]);

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAreaAccount(["analysis", "matches"]);
    const { matchId } = await context.params;
    return ok(await buildFootballSyncPreview(matchId, workspace.id));
  } catch (error) {
    if (error instanceof Error && error.message === "Match not found.") return notFound(error.message);
    return serverError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAreaAccount("analysis");
    const { matchId } = await context.params;
    const body = await request.json();
    const kind = body.kind as FootballSyncKind;
    if (!kinds.has(kind)) return badRequest("Select a valid synchronization type.");
    const match = await prisma.match.findFirst({
      where: { id: matchId, workspaceId: workspace.id },
      include: { squad: true, competition: true },
    });
    if (!match) return notFound("Match not found.");

    if (kind === "match") {
      if (body.confirmed !== true) return badRequest("Confirm the match summary before synchronizing.");
      const minutes = body.minutes && typeof body.minutes === "object" ? body.minutes as Record<string, unknown> : {};
      const parsedMinutes = match.squad.map((item) => ({ playerId: item.playerId, value: Number(minutes[item.playerId]) }));
      if (parsedMinutes.some((item) => !Number.isInteger(item.value) || item.value < 0 || item.value > 180)) {
        return badRequest("Enter valid minutes between 0 and 180 for every player in the match squad.");
      }
      if (!parsedMinutes.some((item) => item.value > 0)) return badRequest("At least one player must have minutes played.");
      if (body.homeAway !== "HOME" && body.homeAway !== "AWAY") return badRequest("Select whether the match was home or away.");
      await prisma.$transaction([
        prisma.match.update({ where: { id: match.id }, data: { homeAway: body.homeAway } }),
        ...parsedMinutes.map((item) => prisma.matchSquad.update({
          where: { matchId_playerId: { matchId: match.id, playerId: item.playerId } },
          data: { minutesPlayed: item.value },
        })),
      ]);
      const preview = await buildFootballSyncPreview(matchId, workspace.id);
      if (preview.unclassifiedOccurrences > 0) {
        return badRequest(`${preview.unclassifiedOccurrences} recorded occurrences still need to be classified before synchronization.`);
      }
    }

    const payload = await buildFootballPayload(matchId, workspace.id, kind);
    const remote = await sendFootballPayload(payload, workspace.id);
    const now = new Date();
    if (kind === "season") await prisma.season.update({ where: { id: match.competition.seasonId }, data: { footballSyncedAt: now } });
    if (kind === "competition") {
      await prisma.$transaction([
        prisma.season.update({ where: { id: match.competition.seasonId }, data: { footballSyncedAt: now } }),
        prisma.competition.update({ where: { id: match.competitionId }, data: { footballSyncedAt: now } }),
      ]);
    }
    if (kind === "team") await prisma.club.update({ where: { id: match.clubId }, data: { footballSyncedAt: now } });
    if (kind === "match") {
      await prisma.$transaction([
        prisma.season.update({ where: { id: match.competition.seasonId }, data: { footballSyncedAt: now } }),
        prisma.competition.update({ where: { id: match.competitionId }, data: { footballSyncedAt: now } }),
        prisma.club.update({ where: { id: match.clubId }, data: { footballSyncedAt: now } }),
        prisma.player.updateMany({ where: { id: { in: match.squad.map((item) => item.playerId) } }, data: { footballSyncedAt: now } }),
        prisma.match.update({ where: { id: match.id }, data: { footballSyncedAt: now } }),
      ]);
    }
    return ok({ synchronized: true, kind, remote, preview: await buildFootballSyncPreview(matchId, workspace.id) });
  } catch (error) {
    return serverError(error);
  }
}
