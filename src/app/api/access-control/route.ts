import { badRequest, ok, serverError } from "@/lib/api";
import { accessAreas, isAccessArea, type AccessArea } from "@/lib/access-areas";
import {
  hashPassword,
  requireAccount,
  requireGlobalAccessAccount,
  validateAccessPassword,
  verifyAreaPassword,
  verifyGlobalAccessPassword,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readNewPassword(value: unknown) {
  const password = String(value || "");
  validateAccessPassword(password);
  return password;
}

function passwordUpdate(area: AccessArea, passwordHash: string) {
  switch (area) {
    case "matches": return { matchesAccessPasswordHash: passwordHash };
    case "newMatch": return { newMatchAccessPasswordHash: passwordHash };
    case "maps": return { mapsAccessPasswordHash: passwordHash };
    case "reports": return { reportsAccessPasswordHash: passwordHash };
    case "squad": return { squadAccessPasswordHash: passwordHash };
    case "analysis": return { analysisAccessPasswordHash: passwordHash };
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = await request.json();
    const action = String(body.action || "unlock");

    if (action === "unlock") {
      if (!isAccessArea(body.area)) return badRequest("Invalid access area.");
      const password = String(body.password || "");
      if (verifyGlobalAccessPassword(account, password)) {
        await prisma.session.update({ where: { id: account.session.id }, data: { globalAccessUnlockedAt: new Date() } });
        return ok({ globalUnlocked: true, unlockedAreas: [...accessAreas] });
      }
      if (!verifyAreaPassword(account, body.area, password)) return badRequest("Incorrect area or global password.");
      const unlockedAreas = [...new Set([...account.session.unlockedAccessAreas, body.area])];
      await prisma.session.update({ where: { id: account.session.id }, data: { unlockedAccessAreas: { set: unlockedAreas } } });
      return ok({ globalUnlocked: false, unlockedAreas });
    }

    if (action === "unlockGlobal") {
      const password = String(body.password || "");
      if (!verifyGlobalAccessPassword(account, password)) return badRequest("Incorrect global password.");
      await prisma.session.update({ where: { id: account.session.id }, data: { globalAccessUnlockedAt: new Date() } });
      return ok({ globalUnlocked: true, unlockedAreas: [...accessAreas] });
    }

    if (action === "resetGlobal") {
      if (!verifyPassword(String(body.accountPassword || ""), account.user.passwordHash)) return badRequest("Incorrect sign-in password.");
      const password = readNewPassword(body.password);
      await prisma.$transaction([
        prisma.workspace.update({ where: { id: account.workspace.id }, data: { globalAccessPasswordHash: hashPassword(password) } }),
        prisma.session.updateMany({ where: { userId: account.user.id }, data: { globalAccessUnlockedAt: null, unlockedAccessAreas: { set: [] } } }),
        prisma.session.update({ where: { id: account.session.id }, data: { globalAccessUnlockedAt: new Date() } }),
      ]);
      return ok({ globalUnlocked: true, unlockedAreas: [...accessAreas] });
    }

    return badRequest("Invalid access action.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The password must")) return badRequest(error.message);
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireGlobalAccessAccount();
    const body = await request.json();
    const target = String(body.target || "");
    const password = readNewPassword(body.password);
    const passwordHash = hashPassword(password);

    if (target === "global") {
      await prisma.$transaction([
        prisma.workspace.update({ where: { id: account.workspace.id }, data: { globalAccessPasswordHash: passwordHash } }),
        prisma.session.updateMany({ where: { userId: account.user.id }, data: { globalAccessUnlockedAt: null, unlockedAccessAreas: { set: [] } } }),
        prisma.session.update({ where: { id: account.session.id }, data: { globalAccessUnlockedAt: new Date() } }),
      ]);
      return ok({ changed: true, globalUnlocked: true });
    }

    if (!isAccessArea(target)) return badRequest("Invalid access area.");
    await prisma.$transaction([
      prisma.workspace.update({ where: { id: account.workspace.id }, data: passwordUpdate(target, passwordHash) }),
      prisma.session.updateMany({ where: { userId: account.user.id }, data: { unlockedAccessAreas: { set: [] } } }),
    ]);
    return ok({ changed: true, globalUnlocked: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The password must")) return badRequest(error.message);
    return serverError(error);
  }
}
