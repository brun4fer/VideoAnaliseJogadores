import { badRequest, ok, serverError } from "@/lib/api";
import { requireAreaAccount } from "@/lib/auth";
import { claimFootballConnection, getFootballConnectionStatus, revokeFootballConnection } from "@/lib/football-connection";

export async function GET() {
  try {
    const { workspace } = await requireAreaAccount("squad");
    return ok(await getFootballConnectionStatus(workspace.id));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAreaAccount("squad");
    const body = await request.json();
    if (typeof body.code !== "string" || !body.code.trim()) return badRequest("Paste the linking code created in FootballOurPlayers.");
    return ok(await claimFootballConnection({ id: workspace.id, name: workspace.name }, body.code));
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE() {
  try {
    const { workspace } = await requireAreaAccount("squad");
    return ok(await revokeFootballConnection(workspace.id));
  } catch (error) {
    return serverError(error);
  }
}
