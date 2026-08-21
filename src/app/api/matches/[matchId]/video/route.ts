import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createPlaybackUrl, deleteR2Object } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireAccount();
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match?.video) return notFound("This match does not have a video.");
    if (match.video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    if (match.video.storageStatus !== "READY" || !match.video.storageKey) return notFound("The video has not been uploaded to Cloudflare R2 yet.");
    return ok(createPlaybackUrl(match.video.storageKey));
  } catch (error) { return serverError(error); }
}

// Retained for legacy clients that only register a local file's metadata.
export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireAccount();
    const { matchId } = await context.params;
    const body = await request.json();
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match) return badRequest("Invalid match.");
    if (match.video && match.video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    if (!body.fileName || !Number.isFinite(Number(body.durationSeconds))) return badRequest("Invalid video metadata.");
    const data = {
      ownerId: user.id,
      fileName: String(body.fileName),
      fileSize: BigInt(body.fileSize || 0),
      durationSeconds: Number(body.durationSeconds),
      mimeType: body.mimeType || "video/mp4",
      lastModified: body.lastModified ? new Date(body.lastModified) : null,
    };
    const video = await prisma.video.upsert({ where: { matchId }, create: { matchId, ...data }, update: data });
    return ok(serializeVideo(video));
  } catch (error) { return serverError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireAccount();
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match?.video) return ok({ deleted: true });
    if (match.video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    if (match.video.storageKey && match.video.uploadId) await abortMultipartUpload(match.video.storageKey, match.video.uploadId).catch(() => undefined);
    if (match.video.storageKey) await deleteR2Object(match.video.storageKey);
    await prisma.video.delete({ where: { id: match.video.id } });
    return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
