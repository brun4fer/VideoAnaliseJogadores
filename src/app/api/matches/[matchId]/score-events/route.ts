import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { requireAreaAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateScoreEvent } from "@/lib/scoreboard";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAreaAccount("analysis"); const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match) return notFound("Match not found.");
    let data; try { data = validateScoreEvent(await request.json(), match.video?.durationSeconds); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid scoreboard event."); }
    return ok(await prisma.matchScoreEvent.create({ data: { matchId, ...data } }), 201);
  } catch (error) { return serverError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAreaAccount("analysis"); const { matchId } = await context.params; const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId) return badRequest("Select a scoreboard event.");
    const event = await prisma.matchScoreEvent.findFirst({ where: { id: eventId, matchId, match: { workspaceId: workspace.id } } });
    if (!event) return notFound("Scoreboard event not found.");
    await prisma.matchScoreEvent.delete({ where: { id: event.id } }); return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
