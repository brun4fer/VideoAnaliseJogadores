import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchPeriodAtTime } from "@/lib/match-periods";
import { actionWindow, roundTime } from "@/lib/time";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAccount();
    const { matchId } = await context.params;
    const body = await request.json();
    const eventTime = Number(body.eventTimeSeconds);
    if (!body.playerId || !Number.isFinite(eventTime)) return badRequest("Invalid player or video time.");
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true, squad: true } });
    const player = await prisma.player.findFirst({ where: { id: body.playerId, clubId: match?.clubId, workspaceId: workspace.id, club: { isClientClub: true } } });
    if (!match || !player) return badRequest("The player does not belong to this match’s club.");
    if (match.squad.length && !match.squad.some((item) => item.playerId === player.id)) return badRequest("The player is not in this match’s squad.");
    const window = actionWindow(eventTime, match.video?.durationSeconds);
    const period = getMatchPeriodAtTime(match, eventTime);
    const action = await prisma.playerAction.create({ data: {
      matchId, playerId: player.id, actionKey: "unclassified", actionName: "Unclassified",
      eventTimeSeconds: roundTime(eventTime), period, ...window,
    }, include: { player: true, subActions: true } });
    return ok(action, 201);
  } catch (error) { return serverError(error); }
}
