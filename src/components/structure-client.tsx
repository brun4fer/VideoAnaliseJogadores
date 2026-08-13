"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Shield, Trash2, Trophy, UserRound, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel, Select } from "@/components/ui";
import { playerPositionLabel } from "@/lib/player-positions";

type Player = { id: string; name: string; shirtNumber: number | null; photoUrl: string | null; position: string | null; isGoalkeeper: boolean };
type Club = { id: string; name: string; shortName: string | null; badgeUrl: string | null; players?: Player[]; competitions?: Array<{ id: string; name: string }> };
type Competition = { id: string; name: string; clubs: Club[] };
type Season = { id: string; name: string; competitions: Competition[] };
type Data = { clientClub: Club | null; seasons: Season[]; opponents: Club[] };

const positions = ["Goalkeeper", "Right-Back", "Left-Back", "Centre-Back", "Right Wing-Back", "Left Wing-Back", "Defensive Midfielder", "Central Midfielder", "Attacking Midfielder", "Right Winger", "Left Winger", "Forward", "Striker"];

export function StructureClient() {
  const [data, setData] = useState<Data>({ clientClub: null, seasons: [], opponents: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Data>("/api/structure");
      setData(result);
      setSeasonId((value) => result.seasons.some((item) => item.id === value) ? value : result.seasons[0]?.id || "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The data could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const competitions = useMemo(() => data.seasons.find((season) => season.id === seasonId)?.competitions || [], [data.seasons, seasonId]);
  useEffect(() => {
    if (!competitions.some((item) => item.id === competitionId)) setCompetitionId(competitions[0]?.id || "");
  }, [competitions, competitionId]);
  const selectedCompetition = competitions.find((item) => item.id === competitionId) || null;

  async function submit(event: FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const formElement = event.currentTarget;
    const body = Object.fromEntries(new FormData(formElement));
    try {
      await apiFetch("/api/structure", { method: "POST", body: JSON.stringify({ ...body, kind, seasonId, competitionId, isGoalkeeper: body.isGoalkeeper === "on" }) });
      if (kind !== "clientClub") formElement.reset();
      setNotice("Saved successfully.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The data could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(resource: string, id: string, label: string) {
    if (!confirm(`Delete ${label}? Dependent data may also be deleted.`)) return;
    try {
      await apiFetch(`/api/structure/${resource}/${id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The item could not be deleted.");
    }
  }

  return <div className="space-y-5">
    <div><Label>Private setup</Label><h1 className="mt-2 text-3xl font-bold text-white">Team, competitions and opponents</h1><p className="mt-2 text-sm text-slate-400">The client team is always analysed and is the only team that can have players. Every other team is an opponent.</p></div>
    {notice ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
    <Panel className="p-5">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Shield/></span><div><Label>Client team</Label><h2 className="mt-1 text-xl font-bold text-white">{data.clientClub?.name || "Set up the team that will always be analysed"}</h2></div></div>
      <form key={data.clientClub?.id || "new-client"} className="mt-5 grid gap-3 md:grid-cols-[1fr_.45fr_1fr_auto] md:items-end" onSubmit={(event) => void submit(event, "clientClub")}>
        <Field label="Name"><Input name="name" defaultValue={data.clientClub?.name} required placeholder="Team name"/></Field>
        <Field label="Short name"><Input name="shortName" defaultValue={data.clientClub?.shortName || ""} placeholder="Abbreviation"/></Field>
        <Field label="Badge URL"><Input name="badgeUrl" type="url" defaultValue={data.clientClub?.badgeUrl || ""} placeholder="https://…"/></Field>
        <Button variant="primary" disabled={busy}>{data.clientClub ? "Save team" : "Create team"}</Button>
      </form>
      {data.clientClub ? <p className="mt-3 text-xs text-slate-500">Automatically linked to every competition in this account.</p> : null}
    </Panel>
    <div className="grid gap-4 xl:grid-cols-4">
      <Panel className="p-4"><Heading icon={Trophy} title="1. Season"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "season")}><Field label="Name"><Input name="name" placeholder="2026/27" required/></Field><Button variant="primary" className="w-full" disabled={busy}><Plus size={15}/>Add season</Button></form><div className="mt-5 space-y-2">{data.seasons.map((season) => <Row key={season.id} active={season.id === seasonId} label={season.name} onClick={() => setSeasonId(season.id)} onDelete={() => void remove("season", season.id, season.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={Shield} title="2. Competition"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "competition")}><Field label="Name"><Input name="name" placeholder="League" required/></Field><Button variant="primary" className="w-full" disabled={busy || !seasonId}><Plus size={15}/>Add competition</Button></form><div className="mt-5 space-y-2">{competitions.map((competition) => <Row key={competition.id} active={competition.id === competitionId} label={competition.name} onClick={() => setCompetitionId(competition.id)} onDelete={() => void remove("competition", competition.id, competition.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={Building2} title="3. Opponent"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "opponent")}><Field label="Name"><Input name="name" placeholder="Opponent team" required/></Field><Field label="Short name"><Input name="shortName" placeholder="Abbreviation"/></Field><Field label="Badge URL"><Input name="badgeUrl" type="url" placeholder="https://…"/></Field><Button variant="primary" className="w-full" disabled={busy || !competitionId}><Plus size={15}/>Add to competition</Button></form><div className="mt-5 space-y-2">{selectedCompetition?.clubs.map((club) => <Row key={club.id} label={club.name} active={false} onDelete={() => void remove("opponent", club.id, club.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={UsersRound} title="4. Player"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "player")}><Field label="Name"><Input name="name" placeholder="Full name" required/></Field><div className="grid grid-cols-2 gap-2"><Field label="Number"><Input name="shirtNumber" type="number" min="1" max="99"/></Field><Field label="Position"><Select name="position"><option value="">Select</option>{positions.map((position) => <option key={position}>{position}</option>)}</Select></Field></div><Field label="Photo URL"><Input name="photoUrl" type="url" placeholder="https://…"/></Field><label className="flex items-center gap-2 text-sm text-slate-300"><input name="isGoalkeeper" type="checkbox" className="accent-cyan-300"/> Goalkeeper</label><Button variant="primary" className="w-full" disabled={busy || !data.clientClub}><Plus size={15}/>Add player</Button></form></Panel>
    </div>
    <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Client team squad</Label><h2 className="mt-1 text-xl font-bold text-white">{data.clientClub?.name || "Set up the team first"}</h2></div><UserRound className="text-cyan-300"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">{data.clientClub?.players?.map((player) => <div key={player.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/15 p-2"><PlayerPhoto player={player}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{player.shirtNumber ? `${player.shirtNumber} · ` : ""}{player.name}</p><p className="truncate text-xs text-slate-500">{playerPositionLabel(player.position)}</p></div><button aria-label="Delete player" onClick={() => void remove("player", player.id, player.name)} className="text-slate-600 hover:text-red-300"><Trash2 size={14}/></button></div>)}</div></Panel>
  </div>;
}

function Heading({ icon: Icon, title }: { icon: typeof Trophy; title: string }) { return <div className="flex items-center gap-2"><Icon size={17} className="text-cyan-300"/><h2 className="font-bold text-white">{title}</h2></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function Row({ label, active, onClick, onDelete }: { label: string; active: boolean; onClick?: () => void; onDelete: () => void }) { return <div className={`flex items-center rounded-md border ${active ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-black/10"}`}><button type="button" onClick={onClick} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-white">{label}</button><button type="button" aria-label={`Delete ${label}`} onClick={onDelete} className="p-2 text-slate-600 hover:text-red-300"><Trash2 size={13}/></button></div>; }
function PlayerPhoto({ player }: { player: Player }) { return <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-300/10 bg-cover bg-center text-cyan-200" style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}>{!player.photoUrl ? <UserRound size={19}/> : null}</span>; }
