import { badRequest, forbidden, ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignMultipartParts } from "@/lib/r2";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { user, workspace } = await requireAccount();
    const { matchId } = await context.params;
    const body = await request.json();
    const partNumbers: number[] = Array.isArray(body.partNumbers) ? [...new Set<number>(body.partNumbers.map(Number))] : [];
    if (!body.uploadId || !partNumbers.length || partNumbers.length > 500 || partNumbers.some((part) => !Number.isInteger(part) || part < 1 || part > 10_000)) return badRequest("Invalid multipart upload request.");
    const video = await prisma.video.findFirst({ where: { matchId, match: { workspaceId: workspace.id } } });
    if (!video || video.storageStatus !== "UPLOADING" || !video.storageKey || video.uploadId !== body.uploadId) return badRequest("The multipart upload is no longer active.");
    if (video.ownerId !== user.id) return forbidden("This video belongs to another user.");
    return ok({ parts: presignMultipartParts(video.storageKey, body.uploadId, partNumbers) });
  } catch (error) { return serverError(error); }
}
