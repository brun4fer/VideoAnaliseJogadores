"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { accessAreaDetails, type AccessArea } from "@/lib/access-areas";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel } from "@/components/ui";

type AccessState = { globalUnlocked: boolean; unlockedAreas: AccessArea[] };

export function ManagementAccessDialog({ area, canDismiss, onDismiss, onUnlocked }: {
  area: AccessArea;
  canDismiss: boolean;
  onDismiss: () => void;
  onUnlocked: (access: AccessState) => void;
}) {
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const details = accessAreaDetails[area];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmation") || "");
    if (recovering && password !== confirmation) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const access = await apiFetch<AccessState>("/api/access-control", {
        method: "POST",
        body: JSON.stringify(recovering ? {
          action: "resetGlobal",
          password,
          accountPassword: data.get("accountPassword"),
        } : {
          action: "unlock",
          area,
          password,
        }),
      });
      onUnlocked(access);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This area could not be unlocked.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="area-access-title">
    <Panel className="relative w-full max-w-lg overflow-hidden border-cyan-300/20 bg-pitch-950 p-5 shadow-2xl sm:p-6">
      {canDismiss ? <button type="button" aria-label="Close" onClick={onDismiss} className="absolute right-4 top-4 text-slate-500 hover:text-white"><X size={17}/></button> : null}
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
        {recovering ? <KeyRound size={21}/> : <LockKeyhole size={21}/>}
      </div>
      <Label className="mt-4 block">Protected area</Label>
      <h2 id="area-access-title" className="mt-1 text-xl font-bold text-white">{recovering ? "Reset the global password" : `Unlock ${details.label}`}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {recovering
          ? "Confirm the account sign-in password, then choose a new global password. Other open sessions will be locked."
          : `Enter the ${details.label} password to unlock only this area, or enter the global password to unlock the entire application.`}
      </p>

      <form className="mt-5 space-y-3" onSubmit={(event) => void submit(event)}>
        {recovering ? <div><Label htmlFor="account-password">Account sign-in password</Label><Input id="account-password" name="accountPassword" type="password" autoComplete="current-password" className="mt-1" required/></div> : null}
        <div><Label htmlFor="area-password">{recovering ? "New global password" : "Area or global password"}</Label><Input id="area-password" name="password" type="password" autoComplete={recovering ? "new-password" : "current-password"} className="mt-1" required autoFocus/></div>
        {recovering ? <div><Label htmlFor="area-confirmation">Confirm global password</Label><Input id="area-confirmation" name="confirmation" type="password" autoComplete="new-password" className="mt-1" required/><p className="mt-1.5 text-[10px] text-slate-500">Use at least 4 characters.</p></div> : null}
        {error ? <p role="alert" className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p> : null}
        <Button variant="primary" className="w-full" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin"/> : recovering ? <ShieldCheck size={15}/> : <LockKeyhole size={15}/>} {recovering ? "Reset global password and unlock all" : `Unlock ${details.label}`}</Button>
      </form>

      <button type="button" onClick={() => { setRecovering((value) => !value); setError(null); }} className="mt-3 w-full text-center text-xs text-slate-500 hover:text-cyan-200">{recovering ? "Back to area access" : "Forgot the global password?"}</button>
    </Panel>
  </div>;
}
