"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter(); const search = useSearchParams(); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(null); const body = Object.fromEntries(new FormData(event.currentTarget)); try { await apiFetch(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(body) }); router.push(mode === "login" ? search.get("next") || "/" : "/structure"); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível continuar."); setBusy(false); } }
  const register = mode === "register";
  return <div className="flex min-h-screen items-center justify-center p-4"><Panel className="w-full max-w-md p-6"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><UsersRound/></span><div><Label>Player Analysis</Label><h1 className="mt-1 text-2xl font-bold text-white">{register ? "Criar conta" : "Iniciar sessão"}</h1></div></div><p className="mt-4 text-sm text-slate-400">{register ? "Cada conta tem um espaço privado, a sua equipa, jogadores, jogos e análises." : "Acede aos dados privados da tua equipa."}</p><form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">{register ? <Field label="Nome"><Input name="name" autoComplete="name" required/></Field> : null}<Field label="Utilizador"><Input name="username" autoComplete="username" required/></Field><Field label="Palavra-passe"><Input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required/></Field>{error ? <p className="text-sm text-red-300">{error}</p> : null}<Button className="w-full" variant="primary" disabled={busy}>{register ? <UserPlus size={16}/> : <LogIn size={16}/>} {busy ? "A processar…" : register ? "Criar conta" : "Entrar"}</Button></form><p className="mt-5 text-center text-sm text-slate-500">{register ? "Já tens conta?" : "Ainda não tens conta?"} <Link className="text-cyan-300 hover:text-cyan-200" href={register ? "/login" : "/register"}>{register ? "Entrar" : "Registar"}</Link></p></Panel></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
