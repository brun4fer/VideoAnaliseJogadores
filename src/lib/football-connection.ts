import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import { prisma } from "@/lib/prisma";

type LinkCode = { version: 1; origin: string; token: string };

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

async function normalizeRemoteOrigin(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("The linking code contains an invalid destination.");
  const localDevelopment = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("The FootballOurPlayers destination must use HTTPS.");
  }
  if (!localDevelopment) {
    const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
      throw new Error("The linking code points to a private or unavailable server address.");
    }
  }
  return url.origin;
}

function decodeLinkCode(code: string): LinkCode {
  try {
    const parsed = JSON.parse(Buffer.from(code.trim(), "base64url").toString("utf8")) as Partial<LinkCode>;
    if (parsed.version !== 1 || typeof parsed.origin !== "string" || typeof parsed.token !== "string" || parsed.token.length < 20) throw new Error();
    return parsed as LinkCode;
  } catch {
    throw new Error("Enter a valid FootballOurPlayers linking code.");
  }
}

export async function getFootballConnectionStatus(workspaceId: string) {
  const connection = await prisma.footballOurPlayersConnection.findUnique({ where: { workspaceId } });
  return {
    connected: Boolean(connection),
    connection: connection ? {
      destinationWorkspaceName: connection.destinationWorkspaceName,
      remoteBaseUrl: connection.remoteBaseUrl,
      connectedAt: connection.createdAt.toISOString(),
      lastUsedAt: connection.lastUsedAt?.toISOString() || null,
    } : null,
  };
}

async function remoteRevoke(connection: { remoteBaseUrl: string; remoteConnectionId: string; accessToken: string }) {
  await fetch(`${connection.remoteBaseUrl}/api/integrations/video-analysis`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "X-Integration-Connection": connection.remoteConnectionId,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
}

export async function claimFootballConnection(workspace: { id: string; name: string }, code: string) {
  const decoded = decodeLinkCode(code);
  const remoteBaseUrl = await normalizeRemoteOrigin(decoded.origin);
  const response = await fetch(`${remoteBaseUrl}/api/integrations/video-analysis/link/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: decoded.token,
      sourceWorkspaceId: workspace.id,
      sourceWorkspaceName: workspace.name,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `FootballOurPlayers returned HTTP ${response.status}.`);
  if (!result?.connectionId || !result?.accessToken || !result?.destinationWorkspace?.id || !result?.destinationWorkspace?.name) {
    throw new Error("FootballOurPlayers returned an invalid linking response.");
  }

  const previous = await prisma.footballOurPlayersConnection.findUnique({ where: { workspaceId: workspace.id } });
  await prisma.footballOurPlayersConnection.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      remoteBaseUrl,
      remoteConnectionId: result.connectionId,
      accessToken: result.accessToken,
      destinationWorkspaceId: result.destinationWorkspace.id,
      destinationWorkspaceName: result.destinationWorkspace.name,
    },
    update: {
      remoteBaseUrl,
      remoteConnectionId: result.connectionId,
      accessToken: result.accessToken,
      destinationWorkspaceId: result.destinationWorkspace.id,
      destinationWorkspaceName: result.destinationWorkspace.name,
      lastUsedAt: null,
    },
  });
  if (previous && (previous.remoteBaseUrl !== remoteBaseUrl || previous.remoteConnectionId !== result.connectionId)) {
    await remoteRevoke(previous);
  }
  return getFootballConnectionStatus(workspace.id);
}

export async function revokeFootballConnection(workspaceId: string) {
  const connection = await prisma.footballOurPlayersConnection.findUnique({ where: { workspaceId } });
  if (connection) {
    await remoteRevoke(connection);
    await prisma.footballOurPlayersConnection.delete({ where: { workspaceId } });
  }
  return { connected: false, connection: null };
}
