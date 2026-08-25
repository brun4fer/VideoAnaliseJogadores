import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { serializeMediaAsset } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { ensureMediaWorkspace } from "@/lib/media-workspace";

export async function GET() {
  try {
    const account = await requireAccount();
    const { mediaWorkspace } = await ensureMediaWorkspace(account);
    const assets = await mediaPrisma.mediaAsset.findMany({
      where: { mediaWorkspaceId: mediaWorkspace.id, storageStatus: "READY" },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
    return ok({ assets: assets.map(serializeMediaAsset) });
  } catch (error) {
    return serverError(error);
  }
}
