import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const { user, workspace } = await requireAccount(); const clientClub = await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true } }); return ok({ id: user.id, name: user.name, username: user.username, workspaceName: workspace.name, teamName: clientClub?.name || null }); } catch (error) { return serverError(error); } }
