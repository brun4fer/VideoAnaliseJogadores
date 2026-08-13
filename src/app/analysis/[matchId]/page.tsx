import { AnalysisWorkspace } from "@/components/analysis-workspace";
export default async function AnalysisPage({ params }: { params: Promise<{ matchId: string }> }) { const { matchId } = await params; return <AnalysisWorkspace matchId={matchId}/>; }
