"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { accessAreaDetails, accessAreas, type AccessArea } from "@/lib/access-areas";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel } from "@/components/ui";

type AccountAccess = { accessControl: { globalUnlocked: boolean; unlockedAreas: AccessArea[] } };

export function ManagementPasswordPanel() {
  const [globalUnlocked, setGlobalUnlocked] = useState<boolean | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiFetch<AccountAccess>("/api/account").then((account) => setGlobalUnlocked(account.accessControl.globalUnlocked)).catch((error: Error) => {
      setGlobalUnlocked(false);
      setMessage({ kind: "error", text: error.message });
    });
  }, []);

  async function unlockGlobal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyTarget("unlock");
    setMessage(null);
    try {
      await apiFetch("/api/access-control", { method: "POST", body: JSON.stringify({ action: "unlockGlobal", password: data.get("password") }) });
      setGlobalUnlocked(true);
      form.reset();
      window.location.reload();
    } catch (cause) {
      setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "Global access could not be unlocked." });
    } finally {
      setBusyTarget(null);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>, target: AccessArea | "global") {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    if (password !== String(data.get("confirmation") || "")) return setMessage({ kind: "error", text: "The new passwords do not match." });
    setBusyTarget(target);
    setMessage(null);
    try {
      await apiFetch("/api/access-control", { method: "PATCH", body: JSON.stringify({ target, password }) });
      form.reset();
      setMessage({ kind: "success", text: `${target === "global" ? "Global" : accessAreaDetails[target].label} password changed. Area-only access was locked in other sessions.` });
    } catch (cause) {
      setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The password could not be changed." });
    } finally {
      setBusyTarget(null);
    }
  }

  return <Panel className="p-4">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200"><ShieldCheck size={19}/></span><div><Label>Security</Label><h2 className="mt-1 text-lg font-bold text-white">Area and global passwords</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">Each area has its own password. The global password unlocks everything and is required to change these settings.</p></div></div>
    {message ? <p role="status" className={`mt-3 rounded-md border px-3 py-2 text-xs ${message.kind === "success" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>{message.text}</p> : null}
    {globalUnlocked === null ? <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin"/>Checking global access…</div> : !globalUnlocked ? <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => void unlockGlobal(event)}><label className="min-w-0 flex-1"><Label htmlFor="settings-global-password">Global password</Label><Input id="settings-global-password" name="password" type="password" autoComplete="current-password" className="mt-1" required/></label><Button variant="primary" disabled={busyTarget === "unlock"}>{busyTarget === "unlock" ? <Loader2 size={14} className="animate-spin"/> : <KeyRound size={14}/>}Unlock password settings</Button></form> : <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {[...accessAreas, "global" as const].map((target) => <PasswordForm key={target} target={target} busy={busyTarget === target} onSubmit={changePassword}/>) }
    </div>}
  </Panel>;
}

function PasswordForm({ target, busy, onSubmit }: { target: AccessArea | "global"; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>, target: AccessArea | "global") => void }) {
  const label = target === "global" ? "Global" : accessAreaDetails[target].label;
  return <form className={`rounded-lg border p-3 ${target === "global" ? "border-violet-400/25 bg-violet-400/[.06]" : "border-white/10 bg-black/10"}`} onSubmit={(event) => void onSubmit(event, target)}>
    <div className="flex items-center justify-between"><Label>{label}</Label>{target === "global" ? <ShieldCheck size={14} className="text-violet-200"/> : <KeyRound size={14} className="text-cyan-300"/>}</div>
    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label><span className="text-[10px] text-slate-500">New password</span><Input name="password" type="password" autoComplete="new-password" className="mt-1" minLength={4} required/></label><label><span className="text-[10px] text-slate-500">Confirm</span><Input name="confirmation" type="password" autoComplete="new-password" className="mt-1" minLength={4} required/></label><Button size="sm" variant={target === "global" ? "primary" : "secondary"} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin"/> : "Change"}</Button></div>
  </form>;
}
