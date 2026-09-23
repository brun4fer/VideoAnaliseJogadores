"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldAlert, Trophy, UsersRound } from "lucide-react";

import { Badge, Button, Input, Label, Panel, Select } from "@/components/ui";
import {
  footballStatLabels,
  type FootballSyncKind,
  type FootballSyncPreview,
} from "@/lib/football-sync-contract";
import { apiFetch } from "@/lib/http";

type SyncResponse = {
  synchronized: true;
  kind: FootballSyncKind;
  remote: { destinationUrl?: string };
  preview: FootballSyncPreview;
};

export function FootballSyncWorkspace({ matchId }: { matchId: string }) {
  const [preview, setPreview] = useState<FootballSyncPreview | null>(null);
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [homeAway, setHomeAway] = useState<"HOME" | "AWAY">("HOME");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<FootballSyncKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<FootballSyncPreview>(`/api/matches/${matchId}/football-sync`);
    setPreview(data);
    setHomeAway(data.match.homeAway);
    setMinutes(Object.fromEntries(data.players.map((player) => [player.id, player.minutesPlayed == null ? "" : String(player.minutesPlayed)])));
  }, [matchId]);

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not prepare synchronization.")); }, [load]);

  const minutesComplete = useMemo(() => preview?.players.every((player) => {
    const value = Number(minutes[player.id]);
    return minutes[player.id] !== "" && Number.isInteger(value) && value >= 0 && value <= 180;
  }) ?? false, [minutes, preview]);

  async function synchronize(kind: FootballSyncKind) {
    setBusy(kind); setError(null); setMessage(null); setDestinationUrl(null);
    try {
      const result = await apiFetch<SyncResponse>(`/api/matches/${matchId}/football-sync`, {
        method: "POST",
        body: JSON.stringify({ kind, ...(kind === "match" ? { minutes, homeAway, confirmed } : {}) }),
      });
      setPreview(result.preview);
      setDestinationUrl(result.remote.destinationUrl || null);
      setMessage(kind === "match" ? "The complete match and its statistics were synchronized." : `${kindLabel(kind)} synchronized successfully.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Synchronization failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!preview) return <Panel className="p-8 text-center text-sm text-slate-400">{error || "Preparing synchronization…"}</Panel>;
  const blockers = [
    !preview.configured ? "This workspace is not linked to FootballOurPlayers." : null,
    !preview.match.date ? "The match date is missing." : null,
    preview.unclassifiedOccurrences ? `${preview.unclassifiedOccurrences} occurrences are still unclassified.` : null,
    !minutesComplete ? "Enter minutes played for every squad player." : null,
  ].filter(Boolean) as string[];

  return <div className="mx-auto max-w-6xl space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <Link href={`/analysis/${matchId}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13}/>Back to analysis</Link>
        <Label className="mt-4 block">FootballOurPlayers</Label>
        <h1 className="mt-1 text-2xl font-bold text-white">Review and synchronize</h1>
        <p className="mt-1 text-sm text-slate-400">Send each structure separately or confirm the complete analysed match.</p>
      </div>
      {destinationUrl ? <a href={destinationUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Open FootballOurPlayers<ExternalLink size={15}/></a> : null}
    </div>

    {!preview.configured ? <Panel className="border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100"><div className="flex gap-3"><ShieldAlert className="shrink-0" size={20}/><div><p className="font-semibold">Workspace not linked</p><p className="mt-1 text-xs text-amber-100/70">Open Structure, paste a linking code created in FootballOurPlayers, then return here.</p><Link href="/structure" className="mt-2 inline-block text-xs font-semibold text-cyan-200 hover:text-cyan-100">Open Structure</Link></div></div></Panel> : null}
    {message ? <Panel className="border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mr-2 inline" size={16}/>{message}</Panel> : null}
    {error ? <Panel className="border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</Panel> : null}

    <div className="grid gap-3 md:grid-cols-3">
      <SyncCard icon={CalendarDays} label="Season" value={preview.season.name} syncedAt={preview.season.syncedAt} busy={busy === "season"} disabled={Boolean(busy) || !preview.configured} onSync={() => void synchronize("season")}/>
      <SyncCard icon={Trophy} label="Competition" value={preview.competition.name} syncedAt={preview.competition.syncedAt} busy={busy === "competition"} disabled={Boolean(busy) || !preview.configured} onSync={() => void synchronize("competition")}/>
      <SyncCard icon={UsersRound} label="Team and squad" value={`${preview.team.name} · ${preview.team.playerCount} players`} syncedAt={preview.team.syncedAt} busy={busy === "team"} disabled={Boolean(busy) || !preview.configured} onSync={() => void synchronize("team")}/>
    </div>

    <Panel className="overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><Label>Complete match</Label><h2 className="mt-1 text-lg font-bold text-white">{preview.team.name} vs {preview.opponent.name}</h2><p className="mt-1 text-xs text-slate-500">{preview.season.name} · {preview.competition.name} · {preview.match.roundName || "Round not defined"} · {preview.match.date || "Date not defined"}</p></div>
          <div className="w-full sm:w-44"><Label htmlFor="homeAway">Venue</Label><Select id="homeAway" className="mt-1" value={homeAway} onChange={(event) => { setHomeAway(event.target.value as "HOME" | "AWAY"); setConfirmed(false); }}><option value="HOME">Home</option><option value="AWAY">Away</option></Select></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><Badge>{preview.players.length} players</Badge><Badge>{preview.totalActions} classified actions</Badge>{preview.unclassifiedOccurrences ? <Badge className="border-amber-300/30 text-amber-200">{preview.unclassifiedOccurrences} unclassified</Badge> : <Badge className="border-emerald-300/30 text-emerald-200">All occurrences classified</Badge>}</div>
      </div>

      <div className="divide-y divide-white/[.07]">
        {preview.players.map((player) => {
          const actionRows = [...Object.entries(player.stats), ...Object.entries(player.goalkeeperStats)].filter(([, value]) => value > 0);
          return <div key={player.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-start">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{player.name}</p>{player.isGoalkeeper ? <Badge>Goalkeeper</Badge> : null}<span className="text-xs text-slate-500">{player.lineupGroup || "No group"} · {player.totalActions} actions</span></div>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-cyan-200">View full statistical summary</summary><div className="mt-2 flex flex-wrap gap-1.5">{actionRows.length ? actionRows.map(([key, value]) => <span key={key} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300">{footballStatLabels[key] || key}: <strong className="text-white">{value}</strong></span>) : <span className="text-xs text-slate-500">No classified statistical actions.</span>}</div></details>
            </div>
            <div><Label htmlFor={`minutes-${player.id}`}>Minutes played</Label><Input id={`minutes-${player.id}`} className="mt-1" type="number" min={0} max={180} step={1} value={minutes[player.id] ?? ""} onChange={(event) => { setMinutes((current) => ({ ...current, [player.id]: event.target.value })); setConfirmed(false); }} placeholder="Required"/></div>
          </div>;
        })}
      </div>

      <div className="border-t border-white/10 bg-black/10 p-4">
        {blockers.length ? <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3"><p className="text-xs font-semibold text-amber-100">Complete these items before synchronizing:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/70">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
        <label className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[.035] p-3 text-sm text-slate-300"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-cyan-300" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/><span>I confirm that the match, squad, minutes and statistical summary above are correct. Re-synchronizing will replace the previous statistics for this match.</span></label>
        <div className="mt-4 flex justify-end"><Button variant="primary" size="lg" disabled={Boolean(busy) || blockers.length > 0 || !confirmed} onClick={() => void synchronize("match")}>{busy === "match" ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}Synchronize complete match</Button></div>
      </div>
    </Panel>
  </div>;
}

function kindLabel(kind: FootballSyncKind) {
  return kind === "season" ? "Season" : kind === "competition" ? "Competition" : kind === "team" ? "Team and squad" : "Match";
}

function SyncCard({ icon: Icon, label, value, syncedAt, busy, disabled, onSync }: { icon: typeof CalendarDays; label: string; value: string; syncedAt: string | null; busy: boolean; disabled: boolean; onSync: () => void }) {
  return <Panel className="p-4"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-200"><Icon size={18}/></span>{syncedAt ? <Badge className="border-emerald-300/20 text-emerald-200">Synced</Badge> : <Badge>Not synced</Badge>}</div><Label className="mt-4 block">{label}</Label><p className="mt-1 min-h-10 text-sm font-semibold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{syncedAt ? `Last sync: ${new Date(syncedAt).toLocaleString()}` : "Send only this structure."}</p><Button className="mt-4 w-full" disabled={disabled} onClick={onSync}>{busy ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}Synchronize {label.toLowerCase()}</Button></Panel>;
}
