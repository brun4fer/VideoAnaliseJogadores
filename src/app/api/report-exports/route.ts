import { randomUUID } from "node:crypto";

import { badRequest, ok, serverError } from "@/lib/api";
import { requireAreaAccount } from "@/lib/auth";
import { createDownloadUrl, createObjectUploadUrl, deleteR2Object, headR2Object } from "@/lib/r2";

const MAX_EXPORT_SIZE = 2 * 1024 * 1024 * 1024;
const MIME_TYPE = "application/zip";

function exportPrefix(userId: string) {
  return `users/${userId}/temporary-report-exports/`;
}

function validSize(value: unknown) {
  const size = Number(value);
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_EXPORT_SIZE ? size : null;
}

function safeFileName(value: unknown) {
  const name = typeof value === "string" ? value.trim().slice(0, 180) : "";
  if (!name) return null;
  return `${name.replace(/\.zip$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "selected-clips"}.zip`;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAreaAccount("reports");
    const body = await request.json();
    const fileName = safeFileName(body.fileName);
    const fileSize = validSize(body.fileSize);
    if (!fileName || !fileSize) return badRequest("The selected clip export must be a ZIP smaller than 2 GB.");

    const storageKey = `${exportPrefix(user.id)}${Date.now()}-${randomUUID()}.zip`;
    const upload = createObjectUploadUrl(storageKey);
    return ok({ uploadUrl: upload.url, storageKey, fileName });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAreaAccount("reports");
    const body = await request.json();
    const storageKey = typeof body.storageKey === "string" ? body.storageKey : "";
    const fileName = safeFileName(body.fileName);
    const fileSize = validSize(body.fileSize);
    if (!storageKey.startsWith(exportPrefix(user.id)) || storageKey.includes("..") || !storageKey.endsWith(".zip")) return badRequest("Invalid report export key.");
    if (!fileName || !fileSize) return badRequest("Invalid report export.");

    const uploaded = await headR2Object(storageKey);
    if (uploaded.contentLength !== fileSize || uploaded.contentType !== MIME_TYPE || !uploaded.etag) {
      return badRequest("Cloudflare did not confirm the selected clip ZIP correctly.");
    }
    const download = createDownloadUrl(storageKey, fileName);
    return ok({ downloadUrl: download.url, expiresAt: download.expiresAt });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireAreaAccount("reports");
    const storageKey = new URL(request.url).searchParams.get("storageKey") || "";
    if (!storageKey.startsWith(exportPrefix(user.id)) || storageKey.includes("..") || !storageKey.endsWith(".zip")) return badRequest("Invalid report export key.");
    await deleteR2Object(storageKey).catch(() => undefined);
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
