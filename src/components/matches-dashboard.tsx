"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Film, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import type { MatchDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { MatchSquadSelector, type SquadPlayer } from "@/components/match-squad-selector";
import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";

type Match = { id: string; matchDate: string | null; roundName: string | null; venue: string | null; notes: string | null; firstHalfAttacksRight: boolean; competitionId: string; opponentClubId: string; club: { name: string }; opponentClub: { name: string }; competition: { name: string; season: { name: string } }; video: unknown | null; _count: { playerActions: number; squad: number } };
type Competition = { id: string; name: string; clubs: Array<{ id: string; name: string }> };
type Season = { id: string; name: string; competitions: Competition[] };

export function MatchesDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Match | null>(null);
  const load = useCallback(() => apiFetch<Match[]>("/api/matches").then(setMatches).catch((caught) => setError(caught.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this match and all of its actions?")) return;
    await apiFetch(`/api/matches/${id}`, { method: "DELETE" }); await load();
  }

  return <div className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><Label>Analysis centre</Label><h1 className="mt-1 text-2xl font-bold text-white">Matches</h1><p className="mt-1 text-sm text-slate-400">Select a match to analyse individual player actions.</p></div><Link href="/matches/new"><Button variant="primary"><Plus size={16}/>New match</Button></Link></div>
    {error ? <Panel className="border-red-400/20 p-4 text-sm text-red-200">{error}</Panel> : null}
    {!error && matches.length === 0 ? <Panel className="flex min-h-56 flex-col items-center justify-center p-6 text-center"><Film size={38} className="text-cyan-300"/><h2 className="mt-3 font-bold text-white">No matches yet</h2><p className="mt-1 text-sm text-slate-400">Set up your squad, then create the first match.</p><div className="mt-4 flex gap-2"><Link href="/structure"><Button><UsersRound size={15}/>Set up squad</Button></Link><Link href="/matches/new"><Button variant="primary"><Plus size={15}/>New match</Button></Link></div></Panel> : null}
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{matches.map((match) => <Panel key={match.id} className="group overflow-hidden"><Link href={`/analysis/${match.id}`} className="block p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[.15em] text-cyan-300">{match.competition.name} · {match.competition.season.name}</p><h2 className="mt-1 truncate text-lg font-bold text-white">{match.club.name} vs {match.opponentClub.name}</h2><p className="text-xs text-slate-400">{match.roundName || "Match"}</p></div><ChevronRight size={18} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300"/></div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1 rounded bg-white/[.05] px-2 py-1"><CalendarDays size={11}/>{match.matchDate ? new Date(match.matchDate).toLocaleDateString("en-GB") : "No date"}</span><span className="rounded bg-white/[.05] px-2 py-1">{match._count.playerActions} occurrences</span><span className="rounded bg-white/[.05] px-2 py-1">{match._count.squad || "Legacy"} players</span><span className={`rounded px-2 py-1 ${match.video ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[.05]"}`}>{match.video ? "Video linked" : "No video"}</span></div></Link><div className="flex justify-end gap-3 border-t border-white/[.06] px-4 py-2"><button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-300" onClick={() => setEditing(match)}><Pencil size={13}/>Edit</button><button className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-300" onClick={() => void remove(match.id)}><Trash2 size={13}/>Delete</button></div></Panel>)}</div>
    {editing ? <MatchEditDialog match={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }}/>: null}
  </div>;
}

function MatchEditDialog({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: () => void }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [players, setPlayers] = useState<SquadPlayer[]>([]);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [competitionId, setCompetitionId] = useState(match.competitionId);
  const [firstHalfAttacksRight, setFirstHalfAttacksRight] = useState(match.firstHalfAttacksRight);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<{ seasons: Season[]; clientClub: { players?: SquadPlayer[] } | null }>("/api/structure"), apiFetch<MatchDetail>(`/api/matches/${match.id}`)])
      .then(([structure, detail]) => { setSeasons(structure.seasons); setPlayers(structure.clientClub?.players || []); setPlayerIds(detail.squad.map((item) => item.playerId)); setFirstHalfAttacksRight(detail.firstHalfAttacksRight); })
      .catch((caught) => setError(caught.message));
  }, [match.id]);

  const competitions = useMemo(() => seasons.flatMap((season) => season.competitions.map((competition) => ({ ...competition, seasonName: season.name }))), [seasons]);
  const opponents = competitions.find((competition) => competition.id === competitionId)?.clubs || [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerIds.length) return setError("Select at least one player.");
    setSaving(true); setError(null);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { await apiFetch(`/api/matches/${match.id}`, { method: "PATCH", body: JSON.stringify({ ...body, competitionId, playerIds, firstHalfAttacksRight }) }); onSaved(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the match."); setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm"><Panel className="max-h-[96vh] w-full max-w-5xl overflow-y-auto p-4"><div className="flex items-center justify-between"><div><Label>Edit match</Label><h2 className="mt-1 text-lg font-bold text-white">{match.club.name} vs {match.opponentClub.name}</h2></div><Button size="icon" onClick={onClose}><X size={16}/></Button></div><form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Competition"><Select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.seasonName} · {competition.name}</option>)}</Select></Field><Field label="Opponent"><Select name="opponentClubId" defaultValue={match.opponentClubId}>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</Select></Field><Field label="Date"><Input name="matchDate" type="date" defaultValue={match.matchDate?.slice(0, 10) || ""}/></Field><Field label="Round"><Input name="roundName" defaultValue={match.roundName || ""}/></Field><Field label="Venue"><Input name="venue" defaultValue={match.venue || ""}/></Field><Field label="First-half direction"><Select value={firstHalfAttacksRight ? "right" : "left"} onChange={(event) => setFirstHalfAttacksRight(event.target.value === "right")}><option value="right">Left to right →</option><option value="left">← Right to left</option></Select></Field><div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><TextArea className="min-h-14" name="notes" defaultValue={match.notes || ""}/></Field></div></div><div className="border-t border-white/10 pt-3"><MatchSquadSelector players={players} value={playerIds} onChange={setPlayerIds}/></div>{error ? <p className="text-sm text-red-300">{error}</p> : null}<div className="flex justify-end gap-2"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !playerIds.length}>{saving ? "Saving…" : "Save changes"}</Button></div></form></Panel></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><Label>{label}</Label><div className="mt-1">{children}</div></label>; }
