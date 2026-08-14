"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { MatchSquadSelector, type SquadPlayer } from "@/components/match-squad-selector";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";

type Club = { id: string; name: string; players?: SquadPlayer[] };
type Competition = { id: string; name: string; clubs: Club[] };
type Season = { id: string; name: string; competitions: Competition[] };

export function NewMatchForm() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [clientClub, setClientClub] = useState<Club | null>(null);
  const [competitionId, setCompetitionId] = useState("");
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [firstHalfAttacksRight, setFirstHalfAttacksRight] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ seasons: Season[]; clientClub: Club | null }>("/api/structure")
      .then((data) => {
        setSeasons(data.seasons); setClientClub(data.clientClub);
        setCompetitionId(data.seasons.flatMap((season) => season.competitions)[0]?.id || "");
      }).catch((caught) => setError(caught.message));
  }, []);

  const competitions = useMemo(() => seasons.flatMap((season) => season.competitions.map((competition) => ({ ...competition, seasonName: season.name }))), [seasons]);
  const opponents = competitions.find((competition) => competition.id === competitionId)?.clubs || [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerIds.length) return setError("Select at least one player for the match squad.");
    setBusy(true); setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const match = await apiFetch<{ id: string }>("/api/matches", { method: "POST", body: JSON.stringify({ ...data, competitionId, playerIds, firstHalfAttacksRight }) });
      router.push(`/analysis/${match.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The match could not be created."); setBusy(false); }
  }

  return <div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-white"><ArrowLeft size={14}/>Matches</Link>
    <div className="mt-3"><Label>New record</Label><h1 className="mt-1 text-2xl font-bold text-white">Create match</h1><p className="mt-1 text-sm text-slate-400">Choose the match details, the first-half direction and up to 18 players.</p></div>
    <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
      <Panel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Competition"><Select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} required><option value="">Select</option>{competitions.map((competition) => <option value={competition.id} key={competition.id}>{competition.seasonName} · {competition.name}</option>)}</Select></Field>
        <Field label="Opponent"><Select name="opponentClubId" required><option value="">Select</option>{opponents.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</Select></Field>
        <Field label="Date"><Input name="matchDate" type="date"/></Field>
        <Field label="Round"><Input name="roundName" placeholder="Round 1"/></Field>
        <Field label="Venue"><Input name="venue" placeholder="Stadium / pitch"/></Field>
        <Field label="First-half attack direction"><Select value={firstHalfAttacksRight ? "right" : "left"} onChange={(event) => setFirstHalfAttacksRight(event.target.value === "right")}><option value="right">Left to right →</option><option value="left">← Right to left</option></Select></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><TextArea className="min-h-16" name="notes" placeholder="Match notes"/></Field></div>
      </Panel>
      <Panel className="p-4"><MatchSquadSelector players={clientClub?.players || []} value={playerIds} onChange={setPlayerIds}/></Panel>
      {error ? <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      <div className="flex justify-end"><Button variant="primary" disabled={busy || !clientClub || opponents.length === 0 || !playerIds.length}><Save size={15}/>{busy ? "Saving…" : "Create and analyse"}</Button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
