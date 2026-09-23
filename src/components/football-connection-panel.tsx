"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Unlink } from "lucide-react";

import { Button, Input, Label, Panel } from "@/components/ui";
import { apiFetch } from "@/lib/http";

type Status = {
  connected: boolean;
  connection: null | {
    destinationWorkspaceName: string;
    remoteBaseUrl: string;
    connectedAt: string;
    lastUsedAt: string | null;
  };
};

export function FootballConnectionPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Status>("/api/football-connection").then(setStatus).catch((error: Error) => setMessage(error.message));
  }, []);

  async function link() {
    setWorking(true); setMessage(null);
    try {
      const next = await apiFetch<Status>("/api/football-connection", { method: "POST", body: JSON.stringify({ code }) });
      setStatus(next); setCode(""); setMessage("FootballOurPlayers is now linked to this workspace.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not link FootballOurPlayers.");
    } finally {
      setWorking(false);
    }
  }

  async function unlink() {
    if (!confirm("Disconnect FootballOurPlayers? Synchronization history and already imported data will be kept.")) return;
    setWorking(true); setMessage(null);
    try {
      setStatus(await apiFetch<Status>("/api/football-connection", { method: "DELETE" }));
      setMessage("FootballOurPlayers was disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect FootballOurPlayers.");
    } finally {
      setWorking(false);
    }
  }

  return <Panel className="overflow-hidden">
    <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
      <div><div className="flex items-center gap-2"><Link2 size={17} className="text-cyan-300"/><Label>FootballOurPlayers</Label></div><p className="mt-1 max-w-2xl text-xs text-slate-500">Link this workspace to the account that will receive seasons, competitions, squads and analysed matches.</p></div>
      {status?.connected ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200"><Check size={11}/>Linked</span> : null}
    </div>
    <div className="p-4">
      {status?.connected && status.connection ? <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">{status.connection.destinationWorkspaceName}</p><p className="mt-1 text-xs text-slate-500">{status.connection.remoteBaseUrl}{status.connection.lastUsedAt ? ` · Last sync ${new Date(status.connection.lastUsedAt).toLocaleString()}` : " · No synchronization yet"}</p></div><Button disabled={working} onClick={() => void unlink()}>{working ? <Loader2 size={14} className="animate-spin"/> : <Unlink size={14}/>}Disconnect</Button></div> : <div><p className="text-sm font-semibold text-white">Paste a code from FootballOurPlayers</p><p className="mt-1 text-xs text-slate-500">In FootballOurPlayers open Administration → Integrations and create a temporary code. It expires after 30 minutes and works once.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste linking code" autoComplete="off"/><Button variant="primary" disabled={working || !code.trim()} onClick={() => void link()}>{working ? <Loader2 size={14} className="animate-spin"/> : <Link2 size={14}/>}Link account</Button></div></div>}
      {message ? <p className="mt-3 text-xs text-cyan-100">{message}</p> : null}
    </div>
  </Panel>;
}
