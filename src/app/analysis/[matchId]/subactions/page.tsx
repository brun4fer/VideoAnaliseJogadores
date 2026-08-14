import { SubactionWorkspace } from "@/components/subaction-workspace";

export default async function SubactionsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <SubactionWorkspace matchId={matchId}/>;
}
