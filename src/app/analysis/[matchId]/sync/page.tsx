import { FootballSyncWorkspace } from "@/components/football-sync-workspace";

export default async function FootballSyncPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <FootballSyncWorkspace matchId={matchId}/>;
}
