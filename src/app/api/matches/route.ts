import { badRequest, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeVideo } from "@/lib/video";

export async function GET() {
  try {
    const { workspace } = await requireManagementAccount();
    const matches = await prisma.match.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ matchDate: "desc" }, { createdAt: "desc" }], include: { club: true, opponentClub: true, competition: { include: { season: true } }, video: true, _count: { select: { playerActions: true, squad: true } } } });
    return ok(matches.map(({ video, ...match }) => ({ ...match, video: video ? serializeVideo(video) : null }))) ;
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  try {
    const { workspace } = await requireManagementAccount();
    const body = await request.json();
    if (!body.opponentClubId || !body.competitionId) return badRequest("Select the competition and opponent.");
    const playerIds = uniquePlayerIds(body.playerIds);
    if (playerIds.length < 1 || playerIds.length > 18) return badRequest("Select between 1 and 18 players for the match squad.");
    const [clientClub, competition, opponent] = await Promise.all([
      prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } }),
      prisma.competition.findFirst({ where: { id: body.competitionId, workspaceId: workspace.id } }),
      prisma.club.findFirst({ where: { id: body.opponentClubId, workspaceId: workspace.id, isClientClub: false, competitions: { some: { id: body.competitionId } } } }),
    ]);
    if (!clientClub) return badRequest("Set up the client team first.");
    if (!competition || !opponent) return badRequest("The selected competition or opponent is invalid.");
    const validCount = await prisma.player.count({ where: { id: { in: playerIds }, workspaceId: workspace.id, clubId: clientClub.id, active: true } });
    if (validCount !== playerIds.length) return badRequest("One or more selected players are invalid.");
    const match = await prisma.match.create({ data: {
      matchDate: body.matchDate ? new Date(body.matchDate) : null,
      roundName: body.roundName?.trim() || null,
      venue: body.venue?.trim() || null,
      notes: body.notes?.trim() || null,
      firstHalfAttacksRight: body.firstHalfAttacksRight !== false,
      clubId: clientClub.id,
      opponentClubId: opponent.id,
      competitionId: competition.id,
      workspaceId: workspace.id,
      squad: { create: playerIds.map((playerId, sortOrder) => ({ playerId, sortOrder })) },
    } });
    return ok(match, 201);
  } catch (error) { return serverError(error); }
}

function uniquePlayerIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}
