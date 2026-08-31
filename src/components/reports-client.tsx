"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, CheckCircle2, Film, Loader2, Pencil, Play, Trash2, Upload, UserRound, XCircle } from "lucide-react";
import JSZip from "jszip";
import { actionFilterGroups, actionMatchesFilter, actionTypeByKey, standaloneActionTypes } from "@/lib/action-types";
import { downloadBlob, safe } from "@/lib/action-video-export";
import { isExportPickerCancellation, pickExportDirectory, toCsv, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { SmartActionVideoExportSession } from "@/lib/smart-action-video-export";
import { formatTime } from "@/lib/time";
import { ActionClipPlayer, type ClipAction } from "@/components/action-clip-player";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";

type Player = { id: string; name: string; club: { name: string } };
type Match = { id: string; roundName: string | null; club: { name: string }; opponentClub: { name: string }; competition: { id: string; name: string; season: { name: string } }; video: { fileName: string; storageStatus: "LOCAL" | "UPLOADING" | "READY" | "FAILED" } | null };
type ReportAction = ClipAction & { playerId: string; actionKey: string; outcome: string | null; matchId: string; parentActionId: string; sourceType: "subaction" | "occurrence"; match: Match };
type Competition = { id: string; name: string; season: { name: string } };
export function ReportsClient() {
  const files = useRef(new Map<string, File>()); const videoInput = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<{ players: Player[]; actions: ReportAction[]; matches: Match[]; competitions: Competition[] }>({ players: [], actions: [], matches: [], competitions: [] }); const [playerId, setPlayerId] = useState("all"); const [actionKey, setActionKey] = useState("all"); const [competitionId, setCompetitionId] = useState("all"); const [matchId, setMatchId] = useState("all"); const [selectedId, setSelectedId] = useState<string | null>(null); const [playbackRequest, setPlaybackRequest] = useState(0); const [error, setError] = useState<string | null>(null); const [exporting, setExporting] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [status, setStatus] = useState("");
  useEffect(() => { apiFetch<typeof data>("/api/analytics").then(setData).catch((caught) => setError(caught.message)); }, []);
  const availableMatches = useMemo(() => data.matches.filter((match) => competitionId === "all" || match.competition.id === competitionId), [competitionId, data.matches]);
  useEffect(() => { if (matchId !== "all" && !availableMatches.some((match) => match.id === matchId)) setMatchId("all"); }, [availableMatches, matchId]);
  const filtered = useMemo(() => data.actions.filter((action) => (playerId === "all" || action.playerId === playerId) && actionMatchesFilter(action.actionKey, actionKey) && (competitionId === "all" || action.match.competition.id === competitionId) && (matchId === "all" || action.matchId === matchId)), [data.actions, playerId, actionKey, competitionId, matchId]);
  useEffect(() => { if (selectedId && !filtered.some((action) => action.id === selectedId)) setSelectedId(null); }, [filtered, selectedId]);
  const selectedIndex = filtered.findIndex((action) => action.id === selectedId); const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null; const positive = filtered.filter((action) => action.outcome === "positive").length; const negative = filtered.filter((action) => action.outcome === "negative").length;
  async function addVideos(list: FileList | null) { if (!list) return; const unmatched: string[] = []; for (const file of Array.from(list)) { const match = data.matches.find((item) => item.video?.fileName.toLowerCase() === file.name.toLowerCase()); if (!match) { unmatched.push(file.name); continue; } files.current.set(match.id, file); await rememberMatchVideo(match.id, file).catch(() => undefined); } setError(unmatched.length ? `Could not match these files: ${unmatched.join(", ")}.` : null); }
  async function getVideo(match: Match) { const file = files.current.get(match.id) || await getRememberedMatchVideo(match.id).catch(() => null); if (file) { files.current.set(match.id, file); return file; } return match.video?.storageStatus === "READY" ? (await getRemoteVideoUrl(match.id)).url : null; }
  function editAction(action: ReportAction) {
    const edit = action.sourceType === "subaction" ? `&edit=${encodeURIComponent(action.id)}` : "";
    window.location.href = `/analysis/${action.matchId}/subactions?action=${encodeURIComponent(action.parentActionId)}${edit}`;
  }
  async function deleteAction(action: ReportAction) {
    const name = actionTypeByKey.get(action.actionKey)?.name || action.actionName;
    if (!confirm(`Delete ${action.player.name}'s ${name} clip? This cannot be undone.`)) return;
    setDeletingId(action.id);
    setError(null);
    try {
      const endpoint = action.sourceType === "subaction" ? `/api/subactions/${action.id}` : `/api/actions/${action.parentActionId}`;
      await apiFetch(endpoint, { method: "DELETE" });
      setData((current) => ({ ...current, actions: current.actions.filter((item) => item.id !== action.id) }));
      setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysed clip could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }
  function playAction(action: ReportAction) {
    setSelectedId(action.id);
    setPlaybackRequest((current) => current + 1);
  }
  function playAll() {
    if (filtered[0]) playAction(filtered[0]);
  }
  async function exportFiltered() {
    if (!filtered.length || exporting) return;
    const actions = filtered;
    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (caught) {
      if (isExportPickerCancellation(caught)) return;
      return setError(caught instanceof Error ? caught.message : "Could not open the export folder.");
    }
    setExporting(true);
    setError(null);
    const selectedPlayer = data.players.find((player) => player.id === playerId)?.name;
    const root = selectedPlayer ? `${safe(selectedPlayer)}-${actions.length}-clips` : `player-analysis-${actions.length}-clips`;
    const zip = directory ? null : new JSZip();
    const rows = [["player", "action", "match", "event", "start", "end", "file"]];
    const exportSessions = new Map<string, SmartActionVideoExportSession>();
    try {
      for (const [index, currentAction] of actions.entries()) {
        const matchName = `${currentAction.match.club.name} vs ${currentAction.match.opponentClub.name}`;
        let exportSession = exportSessions.get(currentAction.match.id);
        if (!exportSession) {
          const source = await getVideo(currentAction.match);
          if (!source) throw new Error(`Upload the video for “${matchName}” before exporting.`);
          exportSession = new SmartActionVideoExportSession(source);
          exportSessions.set(currentAction.match.id, exportSession);
        }
        const actionName = actionTypeByKey.get(currentAction.actionKey)?.name || currentAction.actionName;
        setStatus(`Exporting ${index + 1} of ${actions.length}: ${currentAction.player.name}`);
        const result = await exportSession.exportActionClip({ ...currentAction, actionName }, matchName, (message) => setStatus(`${index + 1}/${actions.length} · ${message}`));
        const path = `${safe(currentAction.player.name)}/${safe(actionName)}/${String(index + 1).padStart(3, "0")}-${result.fileName}`;
        if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
        else zip?.file(`${root}/${path}`, result.blob);
        rows.push([currentAction.player.name, actionName, matchName, formatTime(currentAction.eventTimeSeconds), formatTime(currentAction.startTimeSeconds), formatTime(currentAction.endTimeSeconds), path]);
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
      exportSessions.forEach((session) => session.dispose());
      setExporting(false);
      setStatus("");
    }
  }
  return <div className="space-y-5"><input ref={videoInput} type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addVideos(event.target.files)}/><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><Label>Aggregated analysis</Label><h1 className="mt-2 text-3xl font-bold text-white">Reports and clips</h1><p className="mt-2 text-sm text-slate-400">Filter actions and export every clip included in the active filters.</p></div><Button onClick={() => videoInput.current?.click()}><Upload size={15}/>Local fallback</Button></div>{error ? <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}{exporting ? <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{status}</p> : null}
    <Panel className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Filter label="Player" value={playerId} onChange={setPlayerId}><option value="all">All players</option>{data.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</Filter><Filter label="Action" value={actionKey} onChange={setActionKey}><option value="all">All actions</option><ActionFilterOptions/></Filter><Filter label="Competition" value={competitionId} onChange={setCompetitionId}><option value="all">All competitions</option>{data.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.season.name} · {competition.name}</option>)}</Filter><Filter label="Match" value={matchId} onChange={setMatchId}><option value="all">All matches</option>{availableMatches.map((match) => <option key={match.id} value={match.id}>{match.club.name} vs {match.opponentClub.name}</option>)}</Filter></Panel>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Activity} label="Filtered actions" value={filtered.length}/><Metric icon={Film} label="Matches" value={new Set(filtered.map((action) => action.matchId)).size}/><Metric icon={CheckCircle2} label="Positive" value={positive}/><Metric icon={XCircle} label="Negative" value={negative}/></div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <ActionClipPlayer key={playbackRequest} action={selected} onClipEnd={selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? () => setSelectedId(filtered[selectedIndex + 1].id) : undefined} onEdit={selected ? () => editAction(selected) : undefined} onDelete={selected ? () => void deleteAction(selected) : undefined} deleting={deletingId === selected?.id}/>
      <Panel className="overflow-hidden xl:max-h-[42rem]">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between"><div><Label>Filtered actions</Label><p className="mt-1 text-xs text-slate-500">Select one clip or play the complete filtered list</p></div><Badge>{filtered.length}</Badge></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="primary" disabled={!filtered.length} onClick={playAll}><Play size={14}/>Play all</Button>
            <Button size="sm" disabled={!filtered.length || exporting} onClick={() => void exportFiltered()}>{exporting ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14}/>}Export clips</Button>
          </div>
        </div>
        <div className="max-h-[36rem] divide-y divide-white/[.06] overflow-y-auto">
          {filtered.length ? filtered.map((action) => <div key={action.id} className={`flex items-center gap-2 p-2 transition ${selectedId === action.id ? "bg-cyan-300/10" : "hover:bg-white/[.03]"}`}>
            <button type="button" onClick={() => playAction(action)} className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left">
              <Play size={15} className="shrink-0 text-cyan-300"/>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{action.player.name} · {actionTypeByKey.get(action.actionKey)?.name || action.actionName}</span><span className="block truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.eventTimeSeconds)}</span></span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: actionTypeByKey.get(action.actionKey)?.color }}/>
            </button>
            <button type="button" aria-label={`Edit ${action.actionName}`} title="Edit clip" onClick={() => editAction(action)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[.04] text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-200"><Pencil size={12}/></button>
            <button type="button" disabled={deletingId === action.id} aria-label={`Delete ${action.actionName}`} title="Delete clip" onClick={() => void deleteAction(action)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-400/20 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 disabled:opacity-50">{deletingId === action.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}</button>
          </div>) : <div className="p-10 text-center text-sm text-slate-500"><Film className="mx-auto mb-3"/>No actions match these filters.</div>}
        </div>
      </Panel>
    </div>
  </div>;
}
function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><Label>{label}</Label><Select className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>; }
function ActionFilterOptions() { return <>{actionFilterGroups.flatMap((group) => [<option key={group.key} value={group.key}>{group.name}</option>, ...group.actionKeys.map((key) => { const action = actionTypeByKey.get(key); return action ? <option key={key} value={key}>　↳ {action.name}</option> : null; })])}{standaloneActionTypes.map((action) => <option key={action.key} value={action.key}>{action.name}</option>)}</>; }
function Metric({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: number }) { return <Panel className="p-4"><div className="flex items-center justify-between"><Label>{label}</Label><Icon size={18} className="text-cyan-300"/></div><p className="mt-3 text-3xl font-bold text-white">{value}</p></Panel>; }
