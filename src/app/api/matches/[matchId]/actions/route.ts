import { actionTypeByKey } from "@/lib/action-types";
import { badRequest, ok, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { actionWindow, roundTime } from "@/lib/time";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params; const body = await request.json();
    const type = actionTypeByKey.get(body.actionKey); const eventTime = Number(body.eventTimeSeconds);
    if (!body.playerId || !type || !Number.isFinite(eventTime)) return badRequest("Jogador, instante ou ação inválidos.");
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { video: true } });
    const player = await prisma.player.findFirst({ where: { id: body.playerId, clubId: match?.clubId } });
    if (!match || !player) return badRequest("O jogador não pertence ao clube deste jogo.");
    const window = actionWindow(eventTime, match.video?.durationSeconds);
    const action = await prisma.playerAction.create({ data: { matchId, playerId: player.id, actionKey: type.key, actionName: type.name, eventTimeSeconds: roundTime(eventTime), ...window, fieldX: body.fieldX == null ? null : Number(body.fieldX), fieldY: body.fieldY == null ? null : Number(body.fieldY), notes: body.notes?.trim() || null, outcome: body.outcome || type.outcome || null }, include: { player: true } });
    return ok(action, 201);
  } catch (error) { return serverError(error); }
}
