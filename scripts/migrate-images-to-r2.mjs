import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createObjectUploadUrl } from "../src/lib/r2.ts";

const MAX_SIZE = 10 * 1024 * 1024;
const prisma = new PrismaClient();
const temporaryRoot = resolve(tmpdir());
const temporaryDirectory = await mkdtemp(join(temporaryRoot, "video-analysis-images-"));
const curl = process.platform === "win32" ? "curl.exe" : "curl";
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";

let migrated = 0;
let failed = 0;

try {
  const [clubs, players] = await Promise.all([
    prisma.club.findMany({
      where: { badgeStorageKey: null, badgeUrl: { startsWith: "http" } },
      select: { id: true, name: true, workspaceId: true, badgeUrl: true },
    }),
    prisma.player.findMany({
      where: { photoStorageKey: null, photoUrl: { startsWith: "http" } },
      select: { id: true, name: true, workspaceId: true, photoUrl: true },
    }),
  ]);
  const workspaceIds = [...new Set([...clubs, ...players].map((item) => item.workspaceId))];
  const owners = await prisma.user.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true, workspaceId: true } });
  const ownerByWorkspace = new Map(owners.map((owner) => [owner.workspaceId, owner.id]));

  for (const club of clubs) {
    await migrate({ resource: "clubs", id: club.id, label: club.name, workspaceId: club.workspaceId, sourceUrl: club.badgeUrl, prefix: "badge" }, ownerByWorkspace);
  }
  for (const player of players) {
    await migrate({ resource: "players", id: player.id, label: player.name, workspaceId: player.workspaceId, sourceUrl: player.photoUrl, prefix: "photo" }, ownerByWorkspace);
  }
} finally {
  await prisma.$disconnect();
  const resolvedTemporaryDirectory = resolve(temporaryDirectory);
  if (resolvedTemporaryDirectory.startsWith(`${temporaryRoot}${process.platform === "win32" ? "\\" : "/"}`)) {
    await rm(resolvedTemporaryDirectory, { recursive: true, force: true });
  }
}

console.log(`Image migration finished: ${migrated} migrated, ${failed} failed.`);
if (failed) process.exitCode = 1;

async function migrate(item, ownerByWorkspace) {
  const ownerId = ownerByWorkspace.get(item.workspaceId);
  if (!ownerId || !item.sourceUrl) {
    failed += 1;
    console.error(`Skipped ${item.resource}/${item.label}: no owner or source URL.`);
    return;
  }

  const filePath = join(temporaryDirectory, `${item.resource}-${item.id}`);
  const headerPath = `${filePath}.headers`;
  try {
    download(item.sourceUrl, filePath);
    const file = await readFile(filePath);
    const fileInfo = await stat(filePath);
    if (!fileInfo.size || fileInfo.size > MAX_SIZE) throw new Error("image is empty or larger than 10 MB");
    const detected = detectImage(file);
    if (!detected) throw new Error("unsupported or invalid image format");

    const storageKey = `users/${ownerId}/images/${item.resource}/${item.id}/${item.prefix}-${randomUUID()}.${detected.extension}`;
    const { url } = createObjectUploadUrl(storageKey);
    const etag = upload(url, filePath, headerPath, detected.mimeType);
    const fileName = sourceFileName(item.sourceUrl, `${item.prefix}.${detected.extension}`);
    const uploadedAt = new Date();

    if (item.resource === "clubs") {
      await prisma.club.update({ where: { id: item.id }, data: {
        badgeUrl: `/api/images/clubs/${item.id}`,
        badgeStorageKey: storageKey,
        badgeFileName: fileName,
        badgeFileSize: fileInfo.size,
        badgeMimeType: detected.mimeType,
        badgeEtag: etag,
        badgeUploadedAt: uploadedAt,
      } });
    } else {
      await prisma.player.update({ where: { id: item.id }, data: {
        photoUrl: `/api/images/players/${item.id}`,
        photoStorageKey: storageKey,
        photoFileName: fileName,
        photoFileSize: fileInfo.size,
        photoMimeType: detected.mimeType,
        photoEtag: etag,
        photoUploadedAt: uploadedAt,
      } });
    }
    migrated += 1;
    console.log(`Migrated ${item.resource}/${item.label}.`);
  } catch (error) {
    failed += 1;
    console.error(`Failed ${item.resource}/${item.label}: ${error instanceof Error ? error.message : error}`);
  }
}

function download(url, destination) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("source URL must use HTTP or HTTPS");
  const result = spawnSync(curl, [
    "--location", "--fail", "--silent", "--show-error", "--max-time", "30",
    "--max-filesize", String(MAX_SIZE), "--output", destination, parsed.toString(),
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "download failed");
}

function upload(url, filePath, headerPath, mimeType) {
  const result = spawnSync(curl, [
    "--fail", "--silent", "--show-error", "--max-time", "60",
    "--dump-header", headerPath, "--output", nullDevice, "--write-out", "%{http_code}",
    "--request", "PUT", "--header", `Content-Type: ${mimeType}`, "--data-binary", `@${filePath}`, url,
  ], { encoding: "utf8" });
  if (result.status !== 0 || !/^2\d\d$/.test(result.stdout.trim())) throw new Error(result.stderr.trim() || `R2 upload returned ${result.stdout.trim()}`);
  const headers = readFileSync(headerPath, "utf8");
  const etags = [...headers.matchAll(/^etag:\s*(.+)$/gim)];
  const etag = etags.at(-1)?.[1]?.trim();
  if (!etag) throw new Error("R2 did not return an ETag");
  return etag;
}

function detectImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png", extension: "png" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString() === "GIF87a" || bytes.subarray(0, 6).toString() === "GIF89a")) return { mimeType: "image/gif", extension: "gif" };
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString() === "ftyp" && /avif|avis/.test(bytes.subarray(8, 32).toString())) return { mimeType: "image/avif", extension: "avif" };
  return null;
}

function sourceFileName(url, fallback) {
  try {
    const name = decodeURIComponent(basename(new URL(url).pathname)).trim();
    return (name || fallback).slice(0, 255);
  } catch {
    return fallback;
  }
}
