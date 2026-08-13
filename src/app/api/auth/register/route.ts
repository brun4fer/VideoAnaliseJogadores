import { badRequest, ok, serverError } from "@/lib/api";
import { createSession, hashPassword, validatePassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json(); const name = body.name?.trim(); const username = body.username?.trim().toLowerCase(); const password = String(body.password || "");
    if (!name || !username) return badRequest("Enter your name and username.");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return badRequest("The username must be 3 to 40 characters and use only letters, numbers, dots, hyphens or underscores.");
    try { validatePassword(password); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid password."); }
    if (await prisma.user.findUnique({ where: { username } })) return badRequest("This username already exists.");
    const user = await prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.create({ data: { name: `${name}'s workspace` } });
      return transaction.user.create({ data: { name, username, passwordHash: hashPassword(password), workspaceId: workspace.id } });
    });
    await createSession(user.id); return ok({ id: user.id, name: user.name, username: user.username }, 201);
  } catch (error) { return serverError(error); }
}
