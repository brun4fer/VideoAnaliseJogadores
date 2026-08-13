"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import { actionTypeByKey, allActionTypes } from "@/lib/action-types";
import { apiFetch } from "@/lib/http";
import { formatTime } from "@/lib/time";
import { ActionClipPlayer, type ClipAction } from "@/components/action-clip-player";
import { Pitch } from "@/components/pitch";
import { Badge, Label, Panel, Select } from "@/components/ui";

type Player = { id: string; name: string; club: { name: string } };
type Match = { id: string; roundName: string | null; club: { name: string }; opponentClub: { name: string }; competition: { id: string; name: string; season: { name: string } }; video: { fileName: string } | null };
type MapAction = ClipAction & { playerId: string; actionKey: string; fieldX: number | null; fieldY: number | null; matchId: string; match: Match };
type Competition = { id: string; name: string; season: { name: string } };
export function MapsClient() {
  const [data, setData] = useState<{ players: Player[]; actions: MapAction[]; matches: Match[]; competitions: Competition[] }>({ players: [], actions: [], matches: [], competitions: [] }); const [playerId, setPlayerId] = useState("all"); const [actionKey, setActionKey] = useState("all"); const [competitionId, setCompetitionId] = useState("all"); const [matchId, setMatchId] = useState("all"); const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { apiFetch<typeof data>("/api/analytics").then(setData).catch(() => undefined); }, []);
  const availableMatches = useMemo(() => data.matches.filter((match) => competitionId === "all" || match.competition.id === competitionId), [competitionId, data.matches]);
  useEffect(() => { if (matchId !== "all" && !availableMatches.some((match) => match.id === matchId)) setMatchId("all"); }, [availableMatches, matchId]);
  const actions = useMemo(() => data.actions.filter((action) => action.fieldX != null && action.fieldY != null && (playerId === "all" || action.playerId === playerId) && (actionKey === "all" || action.actionKey === actionKey) && (competitionId === "all" || action.match.competition.id === competitionId) && (matchId === "all" || action.matchId === matchId)), [data.actions, playerId, actionKey, competitionId, matchId]);
  useEffect(() => { if (selectedId && !actions.some((action) => action.id === selectedId)) setSelectedId(null); }, [actions, selectedId]);
  const selected = actions.find((action) => action.id === selectedId) || null;
  const points = actions.map((action) => ({ id: action.id, x: action.fieldX!, y: action.fieldY!, color: actionTypeByKey.get(action.actionKey)?.color, active: action.id === selectedId, label: `${action.player.name} · ${action.actionName}`, details: [`Minuto: ${formatTime(action.eventTimeSeconds)}`, `Jogo: ${action.match.club.name} vs ${action.match.opponentClub.name}`, `${action.match.competition.season.name} · ${action.match.competition.name}`] }));
  const legend = [...new Set(actions.map((action) => action.actionKey))].map((key) => ({ key, count: actions.filter((action) => action.actionKey === key).length }));
  return <div className="space-y-5"><div><Label>Distribuição espacial</Label><h1 className="mt-2 text-3xl font-bold text-white">Mapas de ações</h1><p className="mt-2 text-sm text-slate-400">Passa o rato sobre um ponto para ver jogador, ação, minuto e jogo. Clica para reproduzir o lance.</p></div>
    <Panel className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Filter label="Jogador" value={playerId} onChange={setPlayerId}><option value="all">Todos os jogadores</option>{data.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</Filter><Filter label="Ação" value={actionKey} onChange={setActionKey}><option value="all">Todas as ações</option>{allActionTypes.map((action) => <option key={action.key} value={action.key}>{action.name}</option>)}</Filter><Filter label="Competição" value={competitionId} onChange={setCompetitionId}><option value="all">Todas as competições</option>{data.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.season.name} · {competition.name}</option>)}</Filter><Filter label="Jogo" value={matchId} onChange={setMatchId}><option value="all">Todos os jogos</option>{availableMatches.map((match) => <option key={match.id} value={match.id}>{match.club.name} vs {match.opponentClub.name}</option>)}</Filter></Panel>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]"><Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Campo</Label><p className="mt-1 text-xs text-slate-500">{actions.length} ações com localização</p></div><MapPinned className="text-cyan-300"/></div><Pitch className="mt-4" points={points} onPointSelect={setSelectedId}/></Panel><ActionClipPlayer action={selected}/></div>
    <Panel className="p-4"><div className="flex items-center justify-between"><Label>Legenda</Label><Badge>{actions.length} ocorrências</Badge></div><div className="mt-3 flex flex-wrap gap-2">{legend.map(({ key, count }) => <span key={key} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: actionTypeByKey.get(key)?.color }}/>{actionTypeByKey.get(key)?.name}<strong className="text-white">{count}</strong></span>)}</div></Panel>
  </div>;
}
function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><Label>{label}</Label><Select className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>; }
