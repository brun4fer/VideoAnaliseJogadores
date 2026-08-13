"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, CheckCircle2, Film, Loader2, Play, Upload, UserRound, XCircle } from "lucide-react";
import JSZip from "jszip";
import { allActionTypes, actionTypeByKey } from "@/lib/action-types";
import { downloadBlob, exportActionClip, safe } from "@/lib/action-video-export";
import { isExportPickerCancellation, pickExportDirectory, toCsv, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { formatTime } from "@/lib/time";
import { ActionClipPlayer, type ClipAction } from "@/components/action-clip-player";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";

type Player = { id: string; name: string; club: { name: string } };
type Match = { id: string; roundName: string | null; club: { name: string }; opponentClub: { name: string }; competition: { id: string; name: string; season: { name: string } }; video: { fileName: string } | null };
type ReportAction = ClipAction & { playerId: string; actionKey: string; outcome: string | null; matchId: string; match: Match };
type Competition = { id: string; name: string; season: { name: string } };
export function ReportsClient() {
  const files = useRef(new Map<string, File>()); const videoInput = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<{ players: Player[]; actions: ReportAction[]; matches: Match[]; competitions: Competition[] }>({ players: [], actions: [], matches: [], competitions: [] }); const [playerId, setPlayerId] = useState("all"); const [actionKey, setActionKey] = useState("all"); const [competitionId, setCompetitionId] = useState("all"); const [matchId, setMatchId] = useState("all"); const [selectedId, setSelectedId] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [exporting, setExporting] = useState(false); const [status, setStatus] = useState("");
  useEffect(() => { apiFetch<typeof data>("/api/analytics").then(setData).catch((caught) => setError(caught.message)); }, []);
  const availableMatches = useMemo(() => data.matches.filter((match) => competitionId === "all" || match.competition.id === competitionId), [competitionId, data.matches]);
  useEffect(() => { if (matchId !== "all" && !availableMatches.some((match) => match.id === matchId)) setMatchId("all"); }, [availableMatches, matchId]);
  const filtered = useMemo(() => data.actions.filter((action) => (playerId === "all" || action.playerId === playerId) && (actionKey === "all" || action.actionKey === actionKey) && (competitionId === "all" || action.match.competition.id === competitionId) && (matchId === "all" || action.matchId === matchId)), [data.actions, playerId, actionKey, competitionId, matchId]);
  useEffect(() => { if (selectedId && !filtered.some((action) => action.id === selectedId)) setSelectedId(null); }, [filtered, selectedId]);
  const selected = filtered.find((action) => action.id === selectedId) || null; const positive = filtered.filter((action) => action.outcome === "positive").length; const negative = filtered.filter((action) => action.outcome === "negative").length;
  async function addVideos(list: FileList | null) { if (!list) return; const unmatched: string[] = []; for (const file of Array.from(list)) { const match = data.matches.find((item) => item.video?.fileName.toLowerCase() === file.name.toLowerCase()); if (!match) { unmatched.push(file.name); continue; } files.current.set(match.id, file); await rememberMatchVideo(match.id, file).catch(() => undefined); } setError(unmatched.length ? `Could not match these files: ${unmatched.join(", ")}.` : null); }
  async function getVideo(match: Match) { const file = files.current.get(match.id) || await getRememberedMatchVideo(match.id).catch(() => null); if (file) files.current.set(match.id, file); return file; }
  async function exportFiltered() {
    if (!filtered.length || exporting) return;
    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (caught) {
      if (isExportPickerCancellation(caught)) return;
      return setError(caught instanceof Error ? caught.message : "Could not open the export folder.");
    }
    setExporting(true);
    setError(null);
    const root = `player-analysis-${filtered.length}-clips`;
    const zip = directory ? null : new JSZip();
    const rows = [["player", "action", "match", "event", "start", "end", "file"]];
    try {
      for (const [index, action] of filtered.entries()) {
        const file = await getVideo(action.match);
        const matchName = `${action.match.club.name} vs ${action.match.opponentClub.name}`;
        if (!file) throw new Error(`Load the local video for “${matchName}” before exporting.`);
        const actionName = actionTypeByKey.get(action.actionKey)?.name || action.actionName;
        setStatus(`Exporting ${index + 1} of ${filtered.length}: ${action.player.name}`);
        const result = await exportActionClip(file, { ...action, actionName }, matchName, (message) => setStatus(`${index + 1}/${filtered.length} · ${message}`));
        const path = `${safe(action.player.name)}/${safe(actionName)}/${String(index + 1).padStart(3, "0")}-${result.fileName}`;
        if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
        else zip?.file(`${root}/${path}`, result.blob);
        rows.push([action.player.name, actionName, matchName, formatTime(action.eventTimeSeconds), formatTime(action.startTimeSeconds), formatTime(action.endTimeSeconds), path]);
      }
      const csv = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
      if (directory) await writeBlobToDirectory(directory, `${root}/index.csv`, csv);
      else {
        zip?.file(`${root}/index.csv`, csv);
        setStatus("Creating ZIP file…");
        downloadBlob(await zip!.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (metadata) => setStatus(`Creating ZIP file: ${Math.round(metadata.percent)}%`)), `${root}.zip`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export the clips.");
    } finally {
      setExporting(false);
      setStatus("");
    }
  }
  return <div className="space-y-5"><input ref={videoInput} type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addVideos(event.target.files)}/><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><Label>Aggregated analysis</Label><h1 className="mt-2 text-3xl font-bold text-white">Reports and clips</h1><p className="mt-2 text-sm text-slate-400">Filter actions, review any clip and export the filtered results.</p></div><div className="flex gap-2"><Button onClick={() => videoInput.current?.click()}><Upload size={15}/>Load videos</Button><Button variant="primary" disabled={!filtered.length || exporting} onClick={() => void exportFiltered()}>{exporting ? <Loader2 size={15} className="animate-spin"/> : <Archive size={15}/>}Export filtered clips</Button></div></div>{error ? <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}{exporting ? <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{status}</p> : null}
    <Panel className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Filter label="Player" value={playerId} onChange={setPlayerId}><option value="all">All players</option>{data.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</Filter><Filter label="Action" value={actionKey} onChange={setActionKey}><option value="all">All actions</option>{allActionTypes.map((action) => <option key={action.key} value={action.key}>{action.name}</option>)}</Filter><Filter label="Competition" value={competitionId} onChange={setCompetitionId}><option value="all">All competitions</option>{data.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.season.name} · {competition.name}</option>)}</Filter><Filter label="Match" value={matchId} onChange={setMatchId}><option value="all">All matches</option>{availableMatches.map((match) => <option key={match.id} value={match.id}>{match.club.name} vs {match.opponentClub.name}</option>)}</Filter></Panel>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Activity} label="Filtered actions" value={filtered.length}/><Metric icon={Film} label="Matches" value={new Set(filtered.map((action) => action.matchId)).size}/><Metric icon={CheckCircle2} label="Positive" value={positive}/><Metric icon={XCircle} label="Negative" value={negative}/></div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"><ActionClipPlayer action={selected}/><Panel className="overflow-hidden xl:max-h-[42rem]"><div className="flex items-center justify-between border-b border-white/10 p-3"><div><Label>Filtered actions</Label><p className="mt-1 text-xs text-slate-500">Click to review the clip</p></div><Badge>{filtered.length}</Badge></div><div className="max-h-[36rem] divide-y divide-white/[.06] overflow-y-auto">{filtered.length ? filtered.map((action) => <button key={action.id} onClick={() => setSelectedId(action.id)} className={`flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[.06] ${selectedId === action.id ? "bg-cyan-300/10" : ""}`}><Play size={15} className="shrink-0 text-cyan-300"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{action.player.name} · {actionTypeByKey.get(action.actionKey)?.name || action.actionName}</span><span className="block truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.eventTimeSeconds)}</span></span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: actionTypeByKey.get(action.actionKey)?.color }}/></button>) : <div className="p-10 text-center text-sm text-slate-500"><Film className="mx-auto mb-3"/>No actions match these filters.</div>}</div></Panel></div>
  </div>;
}
function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><Label>{label}</Label><Select className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>; }
function Metric({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: number }) { return <Panel className="p-4"><div className="flex items-center justify-between"><Label>{label}</Label><Icon size={18} className="text-cyan-300"/></div><p className="mt-3 text-3xl font-bold text-white">{value}</p></Panel>; }
