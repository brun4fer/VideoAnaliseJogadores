"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";

type Club = { id: string; name: string };
type Competition = { id: string; name: string; clubs: Club[] };
type Season = { id: string; name: string; competitions: Competition[] };

export function NewMatchForm() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [clientClub, setClientClub] = useState<Club | null>(null);
  const [competitionId, setCompetitionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ seasons: Season[]; clientClub: Club | null }>("/api/structure")
      .then((data) => {
        setSeasons(data.seasons);
        setClientClub(data.clientClub);
        setCompetitionId(data.seasons.flatMap((season) => season.competitions)[0]?.id || "");
      })
      .catch((caught) => setError(caught.message));
  }, []);

  const competitions = useMemo(
    () => seasons.flatMap((season) => season.competitions.map((competition) => ({ ...competition, seasonName: season.name }))),
    [seasons],
  );
  const opponents = competitions.find((competition) => competition.id === competitionId)?.clubs || [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const match = await apiFetch<{ id: string }>("/api/matches", { method: "POST", body: JSON.stringify({ ...data, competitionId }) });
      router.push(`/analysis/${match.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The match could not be created.");
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-3xl">
    <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-white"><ArrowLeft size={14}/>Matches</Link>
    <div className="mt-4"><Label>New record</Label><h1 className="mt-2 text-3xl font-bold text-white">Create match</h1><p className="mt-2 text-sm text-slate-400">The analysed team is always {clientClub?.name || "the client team"}. The match name is generated automatically.</p></div>
    <Panel className="mt-5 p-5">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field label="Competition"><Select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} required><option value="">Select</option>{competitions.map((competition) => <option value={competition.id} key={competition.id}>{competition.seasonName} · {competition.name}</option>)}</Select></Field>
        <Field label="Opponent"><Select name="opponentClubId" required><option value="">Select</option>{opponents.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</Select></Field>
        <Field label="Date"><Input name="matchDate" type="date"/></Field>
        <Field label="Round"><Input name="roundName" placeholder="Round 1"/></Field>
        <Field label="Venue"><Input name="venue" placeholder="Stadium / pitch"/></Field>
        <div className="sm:col-span-2"><Field label="Notes"><TextArea name="notes" placeholder="Match notes"/></Field></div>
        {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end sm:col-span-2"><Button variant="primary" disabled={busy || !clientClub || opponents.length === 0}><Save size={15}/>{busy ? "Saving…" : "Create and analyse"}</Button></div>
      </form>
      {!clientClub ? <p className="mt-4 text-sm text-amber-200">Set up the client team in the Squad area.</p> : competitions.length === 0 ? <p className="mt-4 text-sm text-amber-200">Create a season and competition before adding a match.</p> : opponents.length === 0 ? <p className="mt-4 text-sm text-amber-200">Add at least one opponent to the selected competition.</p> : null}
    </Panel>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>;
}
