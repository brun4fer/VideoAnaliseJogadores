import { badRequest, ok, serverError } from "@/lib/api";
import { hashPassword, requireAccount, requireManagementAccount, validatePassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readPassword(value: unknown) {
  const password = String(value || "");
  validatePassword(password);
  return password;
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "setup") {
      if (account.workspace.managementPasswordHash) return badRequest("A management password has already been created.");
      const password = readPassword(body.password);
      await prisma.$transaction([
        prisma.workspace.update({ where: { id: account.workspace.id }, data: { managementPasswordHash: hashPassword(password) } }),
        prisma.session.update({ where: { id: account.session.id }, data: { managementUnlockedAt: new Date() } }),
      ]);
      return ok({ configured: true, unlocked: true });
    }

    if (action === "unlock") {
      const password = String(body.password || "");
      if (!account.workspace.managementPasswordHash || !verifyPassword(password, account.workspace.managementPasswordHash)) {
        return badRequest("Incorrect management password.");
      }
      await prisma.session.update({ where: { id: account.session.id }, data: { managementUnlockedAt: new Date() } });
      return ok({ configured: true, unlocked: true });
    }

    if (action === "reset") {
      const accountPassword = String(body.accountPassword || "");
      if (!verifyPassword(accountPassword, account.user.passwordHash)) return badRequest("Incorrect sign-in password.");
      const password = readPassword(body.password);
      const passwordHash = hashPassword(password);
      await prisma.$transaction([
        prisma.workspace.update({ where: { id: account.workspace.id }, data: { managementPasswordHash: passwordHash } }),
        prisma.session.updateMany({ where: { userId: account.user.id }, data: { managementUnlockedAt: null } }),
        prisma.session.update({ where: { id: account.session.id }, data: { managementUnlockedAt: new Date() } }),
      ]);
      return ok({ configured: true, unlocked: true });
    }

    return badRequest("Invalid management access action.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The password must")) return badRequest(error.message);
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireManagementAccount();
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    if (!account.workspace.managementPasswordHash || !verifyPassword(currentPassword, account.workspace.managementPasswordHash)) {
      return badRequest("The current management password is incorrect.");
    }
    const password = readPassword(body.password);
    await prisma.$transaction([
      prisma.workspace.update({ where: { id: account.workspace.id }, data: { managementPasswordHash: hashPassword(password) } }),
      prisma.session.updateMany({ where: { userId: account.user.id }, data: { managementUnlockedAt: null } }),
      prisma.session.update({ where: { id: account.session.id }, data: { managementUnlockedAt: new Date() } }),
    ]);
    return ok({ changed: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The password must")) return badRequest(error.message);
    return serverError(error);
  }
}
