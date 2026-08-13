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
  const router = useRouter(); const [seasons, setSeasons] = useState<Season[]>([]); const [competitionId, setCompetitionId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiFetch<{ seasons: Season[] }>("/api/structure").then((data) => { setSeasons(data.seasons); setCompetitionId(data.seasons.flatMap((s) => s.competitions)[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const competitions = useMemo(() => seasons.flatMap((season) => season.competitions.map((competition) => ({ ...competition, seasonName: season.name }))), [seasons]);
  const clubs = competitions.find((competition) => competition.id === competitionId)?.clubs || [];
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(null); const data = Object.fromEntries(new FormData(event.currentTarget)); try { const match = await apiFetch<{ id: string }>("/api/matches", { method: "POST", body: JSON.stringify({ ...data, competitionId }) }); router.push(`/analysis/${match.id}`); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o jogo."); setBusy(false); } }
  return <div className="mx-auto max-w-3xl"><Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-white"><ArrowLeft size={14}/>Jogos</Link><div className="mt-4"><Label>Novo registo</Label><h1 className="mt-2 text-3xl font-bold text-white">Criar jogo</h1></div><Panel className="mt-5 p-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)}><Field label="Título"><Input name="title" placeholder="Jornada 1 · Jogo completo" required/></Field><Field label="Adversário"><Input name="opponentName" placeholder="Nome do adversário" required/></Field><Field label="Campeonato"><Select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} required><option value="">Selecionar</option>{competitions.map((c) => <option value={c.id} key={c.id}>{c.seasonName} · {c.name}</option>)}</Select></Field><Field label="Clube analisado"><Select name="clubId" required><option value="">Selecionar</option>{clubs.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</Select></Field><Field label="Data"><Input name="matchDate" type="date"/></Field><Field label="Jornada"><Input name="roundName" placeholder="Jornada 1"/></Field><Field label="Local"><Input name="venue" placeholder="Estádio / campo"/></Field><div className="sm:col-span-2"><Field label="Notas"><TextArea name="notes" placeholder="Observações sobre o jogo"/></Field></div>{error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}<div className="flex justify-end sm:col-span-2"><Button variant="primary" disabled={busy || clubs.length === 0}><Save size={15}/>{busy ? "A guardar…" : "Criar e analisar"}</Button></div></form>{competitions.length === 0 ? <p className="mt-4 text-sm text-amber-200">Cria uma época, campeonato e clube na área Plantel antes de adicionar um jogo.</p> : null}</Panel></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
