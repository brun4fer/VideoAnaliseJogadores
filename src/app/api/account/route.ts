import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const { user, workspace, session } = await requireAccount(); const clientClub = await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } }); return ok({ id: user.id, name: user.name, username: user.username, workspaceName: workspace.name, teamName: clientClub?.name || null, managementAccess: { configured: Boolean(workspace.managementPasswordHash), unlocked: Boolean(session.managementUnlockedAt) } }); } catch (error) { return serverError(error); } }
