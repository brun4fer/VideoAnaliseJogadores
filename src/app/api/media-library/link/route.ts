import { badRequest, ok, serverError } from "@/lib/api";
import { requireManagementAccount } from "@/lib/auth";
import { claimMediaLinkToken, createMediaLinkToken, getMediaLinkStatus } from "@/lib/media-link";

export async function GET() {
  try {
    return ok(await getMediaLinkStatus(await requireManagementAccount()));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireManagementAccount();
    const body = await request.json();
    if (body.action === "create") return ok(await createMediaLinkToken(account), 201);
    if (body.action === "claim") return ok(await claimMediaLinkToken(account, typeof body.token === "string" ? body.token : ""));
    return badRequest("Invalid cloud library linking action.");
  } catch (error) {
    return serverError(error);
  }
}
