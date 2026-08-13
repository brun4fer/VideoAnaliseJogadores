"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Shield, Trash2, Trophy, UserRound, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel, Select } from "@/components/ui";

type Player = { id: string; name: string; shirtNumber: number | null; photoUrl: string | null; position: string | null; isGoalkeeper: boolean };
type Club = { id: string; name: string; shortName: string | null; badgeUrl: string | null; players: Player[] };
type Competition = { id: string; name: string; clubs: Club[] };
type Season = { id: string; name: string; competitions: Competition[] };
type Data = { seasons: Season[] };
const positions = ["Guarda-Redes", "Defesa Direito", "Defesa Esquerdo", "Defesa Central", "Lateral Direito", "Lateral Esquerdo", "Médio Defensivo", "Médio Centro", "Médio Ofensivo", "Extremo Direito", "Extremo Esquerdo", "Avançado", "Ponta de Lança"];

export function StructureClient() {
  const [data, setData] = useState<Data>({ seasons: [] }); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState(""); const [competitionId, setCompetitionId] = useState(""); const [clubId, setClubId] = useState("");
  const load = useCallback(async () => { try { const result = await apiFetch<Data>("/api/structure"); setData(result); setSeasonId((v) => v || result.seasons[0]?.id || ""); } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível carregar."); } }, []);
  useEffect(() => { void load(); }, [load]);
  const competitions = useMemo(() => data.seasons.find((s) => s.id === seasonId)?.competitions || [], [data, seasonId]);
  useEffect(() => { if (!competitions.some((c) => c.id === competitionId)) setCompetitionId(competitions[0]?.id || ""); }, [competitions, competitionId]);
  const clubs = useMemo(() => competitions.find((c) => c.id === competitionId)?.clubs || [], [competitions, competitionId]);
  useEffect(() => { if (!clubs.some((c) => c.id === clubId)) setClubId(clubs[0]?.id || ""); }, [clubs, clubId]);

  async function submit(event: FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault(); setBusy(true); setNotice(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement); const body = Object.fromEntries(form.entries());
    try { await apiFetch("/api/structure", { method: "POST", body: JSON.stringify({ ...body, kind, seasonId, competitionId, clubId, isGoalkeeper: body.isGoalkeeper === "on" }) }); formElement.reset(); setNotice("Guardado com sucesso."); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível guardar."); } finally { setBusy(false); }
  }
  async function remove(resource: string, id: string, label: string) { if (!confirm(`Eliminar ${label}? Os dados dependentes também serão eliminados.`)) return; try { await apiFetch(`/api/structure/${resource}/${id}`, { method: "DELETE" }); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível eliminar."); } }

  return <div className="space-y-5">
    <div><Label>Estrutura desportiva</Label><h1 className="mt-2 text-3xl font-bold text-white">Épocas, campeonatos, clubes e jogadores</h1><p className="mt-2 text-sm text-slate-400">Cria a estrutura pela ordem apresentada. A fotografia do jogador é, nesta fase, indicada através de um link.</p></div>
    {notice ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
    <div className="grid gap-4 xl:grid-cols-4">
      <Panel className="p-4"><Heading icon={Trophy} title="1. Época" /><form className="mt-4 space-y-3" onSubmit={(e) => void submit(e, "season")}><Field label="Nome"><Input name="name" placeholder="2026/27" required /></Field><Button variant="primary" className="w-full" disabled={busy}><Plus size={15}/>Adicionar época</Button></form><div className="mt-5 space-y-2">{data.seasons.map((season) => <Row key={season.id} active={season.id === seasonId} label={season.name} onClick={() => setSeasonId(season.id)} onDelete={() => void remove("season", season.id, season.name)} />)}</div></Panel>
      <Panel className="p-4"><Heading icon={Shield} title="2. Campeonato" /><form className="mt-4 space-y-3" onSubmit={(e) => void submit(e, "competition")}><Field label="Nome"><Input name="name" placeholder="Liga 3" required /></Field><Button variant="primary" className="w-full" disabled={busy || !seasonId}><Plus size={15}/>Adicionar campeonato</Button></form><div className="mt-5 space-y-2">{competitions.map((competition) => <Row key={competition.id} active={competition.id === competitionId} label={competition.name} onClick={() => setCompetitionId(competition.id)} onDelete={() => void remove("competition", competition.id, competition.name)} />)}</div></Panel>
      <Panel className="p-4"><Heading icon={Building2} title="3. Clube" /><form className="mt-4 space-y-3" onSubmit={(e) => void submit(e, "club")}><Field label="Nome"><Input name="name" placeholder="Nome do clube" required /></Field><Field label="Nome curto"><Input name="shortName" placeholder="Sigla" /></Field><Field label="Link do emblema"><Input name="badgeUrl" type="url" placeholder="https://…" /></Field><Button variant="primary" className="w-full" disabled={busy || !competitionId}><Plus size={15}/>Adicionar clube</Button></form><div className="mt-5 space-y-2">{clubs.map((club) => <Row key={club.id} active={club.id === clubId} label={club.name} onClick={() => setClubId(club.id)} onDelete={() => void remove("club", club.id, club.name)} />)}</div></Panel>
      <Panel className="p-4"><Heading icon={UsersRound} title="4. Jogador" /><form className="mt-4 space-y-3" onSubmit={(e) => void submit(e, "player")}><Field label="Nome"><Input name="name" placeholder="Nome completo" required /></Field><div className="grid grid-cols-2 gap-2"><Field label="Número"><Input name="shirtNumber" type="number" min="1" max="99" /></Field><Field label="Posição"><Select name="position"><option value="">Selecionar</option>{positions.map((p) => <option key={p}>{p}</option>)}</Select></Field></div><Field label="Link da fotografia"><Input name="photoUrl" type="url" placeholder="https://…" /></Field><label className="flex items-center gap-2 text-sm text-slate-300"><input name="isGoalkeeper" type="checkbox" className="accent-cyan-300" /> Guarda-redes</label><Button variant="primary" className="w-full" disabled={busy || !clubId}><Plus size={15}/>Adicionar jogador</Button></form></Panel>
    </div>
    <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Plantel selecionado</Label><h2 className="mt-1 text-xl font-bold text-white">{clubs.find((club) => club.id === clubId)?.name || "Seleciona um clube"}</h2></div><UserRound className="text-cyan-300" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">{clubs.find((club) => club.id === clubId)?.players.map((player) => <div key={player.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/15 p-2"><PlayerPhoto player={player}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{player.shirtNumber ? `${player.shirtNumber} · ` : ""}{player.name}</p><p className="truncate text-xs text-slate-500">{player.position || "Sem posição"}</p></div><button aria-label="Eliminar jogador" onClick={() => void remove("player", player.id, player.name)} className="text-slate-600 hover:text-red-300"><Trash2 size={14}/></button></div>)}</div></Panel>
  </div>;
}

function Heading({ icon: Icon, title }: { icon: typeof Trophy; title: string }) { return <div className="flex items-center gap-2"><Icon size={17} className="text-cyan-300"/><h2 className="font-bold text-white">{title}</h2></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function Row({ label, active, onClick, onDelete }: { label: string; active: boolean; onClick: () => void; onDelete: () => void }) { return <div className={`flex items-center rounded-md border ${active ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-black/10"}`}><button type="button" onClick={onClick} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-white">{label}</button><button type="button" onClick={onDelete} className="p-2 text-slate-600 hover:text-red-300"><Trash2 size={13}/></button></div>; }
function PlayerPhoto({ player }: { player: Player }) { return <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-300/10 bg-cover bg-center text-cyan-200" style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}>{!player.photoUrl ? <UserRound size={19}/> : null}</span>; }
