"use client";

import { useMemo, useState } from "react";
import { GripVertical, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { playerPositionLabel, sortPlayersByPosition } from "@/lib/player-positions";
import { Badge, Label } from "@/components/ui";

export type SquadPlayer = {
  id: string; name: string; shirtNumber: number | null; photoUrl: string | null;
  position: string | null; isGoalkeeper: boolean;
};

export function MatchSquadSelector({ players, value, onChange, max = 18 }: { players: SquadPlayer[]; value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const sorted = useMemo(() => sortPlayersByPosition(players), [players]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selected = value.map((id) => playerById.get(id)).filter((player): player is SquadPlayer => Boolean(player));

  function toggle(playerId: string) {
    if (value.includes(playerId)) onChange(value.filter((id) => id !== playerId));
    else if (value.length < max) onChange([...value, playerId]);
  }

  function swap(firstId: string, secondId: string) {
    if (firstId === secondId) return;
    const next = [...value];
    const first = next.indexOf(firstId); const second = next.indexOf(secondId);
    if (first < 0 || second < 0) return;
    [next[first], next[second]] = [next[second], next[first]];
    onChange(next);
  }

  function selectSwap(playerId: string) {
    if (!swapId) return setSwapId(playerId);
    swap(swapId, playerId);
    setSwapId(null);
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between"><div><Label>Match squad</Label><p className="mt-1 text-xs text-slate-500">Select up to {max} players.</p></div><Badge>{value.length} / {max}</Badge></div>
    <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/10 p-2 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((player) => { const active = value.includes(player.id); return <button key={player.id} type="button" onClick={() => toggle(player.id)} disabled={!active && value.length >= max} className={cn("flex min-w-0 items-center gap-2 rounded-md border p-2 text-left transition", active ? "border-cyan-300/45 bg-cyan-300/10" : "border-white/10 bg-white/[.03] hover:bg-white/[.07]", !active && value.length >= max && "opacity-40")}><PlayerPhoto player={player} className="h-10 w-10"/><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{player.shirtNumber ? `${player.shirtNumber} · ` : ""}{player.name}</span><span className="block truncate text-[10px] text-slate-500">{playerPositionLabel(player.position)}</span></span></button>; })}
    </div>
    <div><div className="flex items-center justify-between"><Label>Photo order</Label><span className="text-[10px] text-slate-500">Drag to swap · tap two players on touch screens</span></div>
      <div className="mt-2 grid min-h-20 grid-cols-6 gap-1.5 rounded-lg border border-dashed border-white/15 bg-black/10 p-2 sm:grid-cols-9 lg:grid-cols-12 xl:grid-cols-[repeat(18,minmax(0,1fr))]">
        {selected.map((player, index) => <div key={player.id} draggable onDragStart={() => setDraggingId(player.id)} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) swap(draggingId, player.id); setDraggingId(null); }} onClick={() => selectSwap(player.id)} title={`${index + 1}. ${player.name} · ${playerPositionLabel(player.position)}`} className={cn("group relative flex cursor-grab flex-col items-center rounded-md border p-1 transition", swapId === player.id ? "border-amber-300 bg-amber-300/10" : draggingId === player.id ? "border-cyan-300 opacity-50" : "border-white/10 bg-white/[.04] hover:border-cyan-300/40")}>
          <GripVertical size={10} className="absolute left-0 top-0 text-slate-600"/><span className="absolute right-0 top-0 rounded-bl bg-black/65 px-1 text-[8px] text-slate-300">{index + 1}</span><PlayerPhoto player={player} className="h-10 w-10"/><button type="button" aria-label={`Remove ${player.name}`} onClick={(event) => { event.stopPropagation(); toggle(player.id); }} className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-slate-500 opacity-0 group-hover:opacity-100"><X size={9}/></button>
        </div>)}
        {!selected.length ? <p className="col-span-full self-center text-center text-xs text-slate-600">Select the players above.</p> : null}
      </div>
    </div>
  </div>;
}

function PlayerPhoto({ player, className }: { player: SquadPlayer; className?: string }) {
  return <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-300/10 bg-cover bg-center text-cyan-200", className)} style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}>{!player.photoUrl ? <UserRound size={17}/> : null}</span>;
}
