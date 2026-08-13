"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Film, Plus, Trash2, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Button, Label, Panel } from "@/components/ui";

type Match = { id: string; title: string; opponentName: string; matchDate: string | null; roundName: string | null; club: { name: string }; competition: { name: string; season: { name: string } }; video: unknown | null; _count: { playerActions: number } };
export function MatchesDashboard() {
  const [matches, setMatches] = useState<Match[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => apiFetch<Match[]>("/api/matches").then(setMatches).catch((e) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function remove(id: string) { if (!confirm("Eliminar este jogo e todas as ações?") ) return; await apiFetch(`/api/matches/${id}`, { method: "DELETE" }); await load(); }
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Label>Centro de análise</Label><h1 className="mt-2 text-3xl font-bold text-white">Jogos</h1><p className="mt-2 text-sm text-slate-400">Seleciona um jogo para analisar as ações individuais dos jogadores.</p></div><Link href="/matches/new"><Button variant="primary"><Plus size={16}/>Novo jogo</Button></Link></div>
    {error ? <Panel className="border-red-400/20 p-5 text-sm text-red-200"><p>{error}</p><p className="mt-2 text-slate-400">Confirma a ligação à base de dados e executa <code>npm run prisma:push</code>.</p></Panel> : null}
    {!error && matches.length === 0 ? <Panel className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Film size={42} className="text-cyan-300"/><h2 className="mt-4 text-lg font-bold text-white">Ainda não existem jogos</h2><p className="mt-2 max-w-md text-sm text-slate-400">Cria primeiro a estrutura do plantel e depois adiciona o primeiro jogo.</p><div className="mt-5 flex gap-2"><Link href="/structure"><Button><UsersRound size={15}/>Criar plantel</Button></Link><Link href="/matches/new"><Button variant="primary"><Plus size={15}/>Novo jogo</Button></Link></div></Panel> : null}
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{matches.map((match) => <Panel key={match.id} className="group overflow-hidden"><Link href={`/analysis/${match.id}`} className="block p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">{match.competition.name} · {match.competition.season.name}</p><h2 className="mt-2 text-xl font-bold text-white">{match.title}</h2><p className="mt-1 text-sm text-slate-400">{match.club.name} vs {match.opponentName}</p></div><ChevronRight className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300"/></div><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5 rounded-md bg-white/[.05] px-2 py-1"><CalendarDays size={13}/>{match.matchDate ? new Date(match.matchDate).toLocaleDateString("pt-PT") : "Sem data"}</span><span className="rounded-md bg-white/[.05] px-2 py-1">{match._count.playerActions} ações</span><span className={`rounded-md px-2 py-1 ${match.video ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[.05]"}`}>{match.video ? "Vídeo associado" : "Sem vídeo"}</span></div></Link><div className="border-t border-white/[.06] px-5 py-2 text-right"><button className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-300" onClick={() => void remove(match.id)}><Trash2 size={13}/>Eliminar</button></div></Panel>)}</div>
  </div>;
}
