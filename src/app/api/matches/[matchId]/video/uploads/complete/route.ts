import { badRequest, forbidden, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeMultipartUpload } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

const MEBIBYTE = 1024 * 1024;
function partSizeFor(fileSize: number) { return Math.max(64 * MEBIBYTE, Math.ceil(fileSize / 10_000 / MEBIBYTE) * MEBIBYTE); }

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireAccount();
    const { matchId } = await context.params;
    const body = await request.json();
    const parts = Array.isArray(body.parts) ? body.parts.map((part: { partNumber?: unknown; etag?: unknown }) => ({ partNumber: Number(part.partNumber), etag: typeof part.etag === "string" ? part.etag : "" })) : [];
    const video = await prisma.video.findFirst({ where: { matchId, match: { workspaceId: workspace.id } } });
    if (!video || video.storageStatus !== "UPLOADING" || !video.storageKey || video.uploadId !== body.uploadId) return badRequest("The multipart upload is no longer active.");
    if (video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    const expectedParts = Math.ceil(Number(video.fileSize) / partSizeFor(Number(video.fileSize)));
    const unique = new Set(parts.map((part: { partNumber: number }) => part.partNumber));
    if (parts.length !== expectedParts || unique.size !== expectedParts || parts.some((part: { partNumber: number; etag: string }) => !Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > expectedParts || !part.etag)) return badRequest("The uploaded video is missing one or more parts.");
    const etag = await completeMultipartUpload(video.storageKey, body.uploadId, parts);
    const saved = await prisma.video.update({ where: { id: video.id }, data: { storageStatus: "READY", uploadId: null, etag, uploadedAt: new Date() } });
    return ok({ video: serializeVideo(saved) });
  } catch (error) { return serverError(error); }
}
