import { badRequest, ok, serverError } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json(); const username = body.username?.trim().toLowerCase(); const password = String(body.password || "");
    const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
    if (!user || !verifyPassword(password, user.passwordHash)) return badRequest("Incorrect username or password.");
    await createSession(user.id); return ok({ id: user.id, name: user.name, username: user.username });
  } catch (error) { return serverError(error); }
}
