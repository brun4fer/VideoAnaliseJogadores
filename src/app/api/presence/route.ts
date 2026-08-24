import { ok, serverError } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_WINDOW_MS = 90_000;

export async function POST() {
  try {
    const { user, session } = await requireAccount();
    const now = new Date();
    const activeAfter = new Date(now.getTime() - ACTIVE_WINDOW_MS);

    const [, otherActiveSessions] = await prisma.$transaction([
      prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }),
      prisma.session.count({
        where: {
          userId: user.id,
          id: { not: session.id },
          expiresAt: { gt: now },
          lastSeenAt: { gte: activeAfter },
        },
      }),
    ]);

    return ok({ activeElsewhere: otherActiveSessions > 0, otherActiveSessions });
  } catch (error) {
    return serverError(error);
  }
}
