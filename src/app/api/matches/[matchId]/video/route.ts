import { badRequest, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireAccount(); const { matchId } = await context.params; const body = await request.json();
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id } });
    if (!match) return badRequest("Invalid match.");
    if (!body.fileName || !Number.isFinite(Number(body.durationSeconds))) return badRequest("Invalid video metadata.");
    const video = await prisma.video.upsert({ where: { matchId }, create: { matchId, fileName: body.fileName, fileSize: BigInt(body.fileSize || 0), durationSeconds: Number(body.durationSeconds), mimeType: body.mimeType || "video/mp4", lastModified: body.lastModified ? new Date(body.lastModified) : null }, update: { fileName: body.fileName, fileSize: BigInt(body.fileSize || 0), durationSeconds: Number(body.durationSeconds), mimeType: body.mimeType || "video/mp4", lastModified: body.lastModified ? new Date(body.lastModified) : null } });
    return ok({ ...video, fileSize: video.fileSize.toString() });
  } catch (error) { return serverError(error); }
}
