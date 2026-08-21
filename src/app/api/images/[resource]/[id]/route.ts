import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { requireAccount, requireManagementAccount } from "@/lib/auth";
import { IMAGE_TYPES, MAX_IMAGE_FILE_SIZE, imagePath, isImageMimeType, type ImageResource } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { createObjectUploadUrl, createPlaybackUrl, deleteR2Object, headR2Object } from "@/lib/r2";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

async function findTarget(resource: ImageResource, id: string, workspaceId: string) {
  if (resource === "clubs") {
    const record = await prisma.club.findFirst({
      where: { id, workspaceId },
      select: { id: true, badgeStorageKey: true, badgeUrl: true },
    });
    return record ? { resource, storageKey: record.badgeStorageKey, imageUrl: record.badgeUrl } as const : null;
  }
  const record = await prisma.player.findFirst({
    where: { id, workspaceId },
    select: { id: true, photoStorageKey: true, photoUrl: true },
  });
  return record ? { resource, storageKey: record.photoStorageKey, imageUrl: record.photoUrl } as const : null;
}

function parseResource(value: string): ImageResource | null {
  return value === "clubs" || value === "players" ? value : null;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { workspace } = await requireAccount();
    const { resource: rawResource, id } = await context.params;
    const resource = parseResource(rawResource);
    if (!resource) return notFound("Image not found.");
    const target = await findTarget(resource, id, workspace.id);
    if (!target?.storageKey) return notFound("Image not found.");

    const response = NextResponse.redirect(createPlaybackUrl(target.storageKey).url, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { user, workspace } = await requireManagementAccount();
    const { resource: rawResource, id } = await context.params;
    const resource = parseResource(rawResource);
    if (!resource) return badRequest("Invalid image resource.");
    const target = await findTarget(resource, id, workspace.id);
    if (!target) return notFound("The image owner was not found.");

    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 255) : "";
    const fileSize = Number(body.fileSize);
    const mimeType = body.mimeType;
    if (!fileName || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_IMAGE_FILE_SIZE) {
      return badRequest("The image must be smaller than 10 MB.");
    }
    if (!isImageMimeType(mimeType)) return badRequest("Unsupported image format.");

    const label = resource === "clubs" ? "badge" : "photo";
    const storageKey = `users/${user.id}/images/${resource}/${id}/${label}-${randomUUID()}.${IMAGE_TYPES[mimeType]}`;
    const signed = createObjectUploadUrl(storageKey);
    return ok({ uploadUrl: signed.url, expiresAt: signed.expiresAt, storageKey });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user, workspace } = await requireManagementAccount();
    const { resource: rawResource, id } = await context.params;
    const resource = parseResource(rawResource);
    if (!resource) return badRequest("Invalid image resource.");
    const target = await findTarget(resource, id, workspace.id);
    if (!target) return notFound("The image owner was not found.");

    const body = await request.json();
    const storageKey = typeof body.storageKey === "string" ? body.storageKey : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 255) : "";
    const fileSize = Number(body.fileSize);
    const mimeType = body.mimeType;
    const expectedPrefix = `users/${user.id}/images/${resource}/${id}/`;
    if (!storageKey.startsWith(expectedPrefix) || storageKey.includes("..")) return badRequest("Invalid image storage key.");
    if (!fileName || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_IMAGE_FILE_SIZE) return badRequest("Invalid image size.");
    if (!isImageMimeType(mimeType) || !storageKey.endsWith(`.${IMAGE_TYPES[mimeType]}`)) return badRequest("Unsupported image format.");

    const uploaded = await headR2Object(storageKey);
    if (uploaded.contentLength !== fileSize) return badRequest("The uploaded image size does not match the selected file.");
    if (uploaded.contentType !== mimeType) return badRequest("The uploaded image type does not match the selected file.");
    if (!uploaded.etag) return badRequest("Cloudflare did not confirm the uploaded image.");
    if (typeof body.etag === "string" && body.etag !== uploaded.etag) return badRequest("The uploaded image ETag does not match.");

    const uploadedAt = new Date();
    const imageUrl = imagePath(resource, id);
    if (resource === "clubs") {
      await prisma.club.update({ where: { id }, data: {
        badgeUrl: imageUrl,
        badgeStorageKey: storageKey,
        badgeFileName: fileName,
        badgeFileSize: fileSize,
        badgeMimeType: mimeType,
        badgeEtag: uploaded.etag,
        badgeUploadedAt: uploadedAt,
      } });
    } else {
      await prisma.player.update({ where: { id }, data: {
        photoUrl: imageUrl,
        photoStorageKey: storageKey,
        photoFileName: fileName,
        photoFileSize: fileSize,
        photoMimeType: mimeType,
        photoEtag: uploaded.etag,
        photoUploadedAt: uploadedAt,
      } });
    }

    if (target.storageKey && target.storageKey !== storageKey) {
      await deleteR2Object(target.storageKey).catch(() => undefined);
    }
    return ok({ imageUrl, uploadedAt: uploadedAt.toISOString() });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { user, workspace } = await requireManagementAccount();
    const { resource: rawResource, id } = await context.params;
    const resource = parseResource(rawResource);
    if (!resource) return badRequest("Invalid image resource.");
    const target = await findTarget(resource, id, workspace.id);
    if (!target) return ok({ deleted: true });

    const pendingKey = new URL(request.url).searchParams.get("pendingKey");
    if (pendingKey) {
      const expectedPrefix = `users/${user.id}/images/${resource}/${id}/`;
      if (!pendingKey.startsWith(expectedPrefix) || pendingKey.includes("..") || pendingKey === target.storageKey) return badRequest("Invalid pending image key.");
      await deleteR2Object(pendingKey).catch(() => undefined);
      return ok({ deleted: true });
    }

    if (resource === "clubs") {
      await prisma.club.update({ where: { id }, data: {
        badgeUrl: null, badgeStorageKey: null, badgeFileName: null, badgeFileSize: null,
        badgeMimeType: null, badgeEtag: null, badgeUploadedAt: null,
      } });
    } else {
      await prisma.player.update({ where: { id }, data: {
        photoUrl: null, photoStorageKey: null, photoFileName: null, photoFileSize: null,
        photoMimeType: null, photoEtag: null, photoUploadedAt: null,
      } });
    }
    if (target.storageKey) await deleteR2Object(target.storageKey).catch(() => undefined);
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
