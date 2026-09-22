import { ok, serverError } from "@/lib/api";
import { accessAreas, areaPasswordsEnabled } from "@/lib/access-areas";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const { user, workspace, session } = await requireAccount(); const clientClub = await prisma.club.findFirst({ where: { id: workspace.activeClientClubId || undefined, workspaceId: workspace.id, isClientClub: true } }) || await prisma.club.findFirst({ where: { workspaceId: workspace.id, isClientClub: true }, orderBy: { createdAt: "asc" } }); const globalUnlocked = !areaPasswordsEnabled || Boolean(session.globalAccessUnlockedAt); return ok({ id: user.id, name: user.name, username: user.username, workspaceName: workspace.name, teamName: clientClub?.name || null, accessControl: { globalUnlocked, unlockedAreas: globalUnlocked ? [...accessAreas] : session.unlockedAccessAreas } }); } catch (error) { return serverError(error); } }
