"use client";

import { useEffect, useMemo, useState } from "react";
import { actionTypeByKey, allActionTypes } from "@/lib/action-types";
import { apiFetch } from "@/lib/http";
import { Pitch } from "@/components/pitch";
import { Label, Panel, Select } from "@/components/ui";

type Player = { id: string; name: string; club: { name: string } };
type MapAction = { id: string; playerId: string; actionKey: string; actionName: string; fieldX: number | null; fieldY: number | null; player: Player; match: { title: string } };
export function MapsClient() {
  const [data, setData] = useState<{ players: Player[]; actions: MapAction[] }>({ players: [], actions: [] }); const [playerId, setPlayerId] = useState("all"); const [actionKey, setActionKey] = useState("all");
  useEffect(() => { apiFetch<typeof data>("/api/analytics").then(setData).catch(() => undefined); }, []);
  const actions = useMemo(() => data.actions.filter((a) => a.fieldX != null && a.fieldY != null && (playerId === "all" || a.playerId === playerId) && (actionKey === "all" || a.actionKey === actionKey)), [data.actions, playerId, actionKey]);
  const points = actions.map((action) => ({ id: action.id, x: action.fieldX!, y: action.fieldY!, color: actionTypeByKey.get(action.actionKey)?.color, label: `${action.player.name} · ${action.actionName} · ${action.match.title}` }));
  return <div className="space-y-5"><div><Label>Distribuição espacial</Label><h1 className="mt-2 text-3xl font-bold text-white">Heatmap de ações</h1><p className="mt-2 text-sm text-slate-400">Explora as posições registadas para cada jogador e tipo de ação.</p></div><Panel className="grid gap-3 p-4 sm:grid-cols-2"><div><Label>Jogador</Label><Select className="mt-1" value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="all">Todos os jogadores</option>{data.players.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.club.name}</option>)}</Select></div><div><Label>Ação</Label><Select className="mt-1" value={actionKey} onChange={(e) => setActionKey(e.target.value)}><option value="all">Todas as ações</option>{allActionTypes.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</Select></div></Panel><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]"><Panel className="p-4"><Pitch points={points}/></Panel><Panel className="p-4"><Label>Legenda</Label><p className="mt-2 text-3xl font-bold text-white">{actions.length}</p><p className="text-sm text-slate-500">ações com localização</p><div className="mt-5 space-y-2">{[...new Set(actions.map((a) => a.actionKey))].map((key) => <div key={key} className="flex items-center gap-2 text-xs text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: actionTypeByKey.get(key)?.color }}/>{actionTypeByKey.get(key)?.name}</div>)}</div></Panel></div></div>;
}
