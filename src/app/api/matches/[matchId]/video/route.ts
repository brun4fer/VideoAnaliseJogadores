import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { requireAccount, requireManagementAccount } from "@/lib/auth";
import { removeMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { abortMediaMultipartUpload, createMediaPlaybackUrl } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createPlaybackUrl, deleteR2Object } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const account = await requireAccount();
    const { user, workspace } = account;
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match?.video) return notFound("This match does not have a video.");
    if (match.video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    if (match.video.mediaAssetId) {
      const { mediaWorkspace } = await ensureMediaWorkspace(account);
      const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: match.video.mediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "READY" } });
      if (!asset) return notFound("The shared cloud video is not available.");
      return ok(createMediaPlaybackUrl(asset.storageKey));
    }
    if (match.video.storageStatus !== "READY" || !match.video.storageKey) return notFound("The video has not been uploaded to Cloudflare R2 yet.");
    return ok(createPlaybackUrl(match.video.storageKey));
  } catch (error) { return serverError(error); }
}

// Retained for legacy clients that only register a local file's metadata.
export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const account = await requireManagementAccount();
    const { user, workspace } = account;
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
    const account = await requireManagementAccount();
    const { user, workspace } = account;
    const { matchId } = await context.params;
    const match = await prisma.match.findFirst({ where: { id: matchId, workspaceId: workspace.id }, include: { video: true } });
    if (!match?.video) return ok({ deleted: true });
    if (match.video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    if (match.video.mediaAssetId) {
      const { appId, mediaWorkspace } = await ensureMediaWorkspace(account);
      const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: match.video.mediaAssetId, mediaWorkspaceId: mediaWorkspace.id } });
      if (asset?.storageStatus === "UPLOADING" && asset.uploadId) {
        await abortMediaMultipartUpload(asset.storageKey, asset.uploadId).catch(() => undefined);
        await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "FAILED", uploadId: null } });
      }
      await removeMediaReference(appId, match.video.id);
      await prisma.video.delete({ where: { id: match.video.id } });
      return ok({ deleted: true });
    }
    if (match.video.storageKey && match.video.uploadId) await abortMultipartUpload(match.video.storageKey, match.video.uploadId).catch(() => undefined);
    if (match.video.storageKey) await deleteR2Object(match.video.storageKey);
    await prisma.video.delete({ where: { id: match.video.id } });
    return ok({ deleted: true });
  } catch (error) { return serverError(error); }
}
