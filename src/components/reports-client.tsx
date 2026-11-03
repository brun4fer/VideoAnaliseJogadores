"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, CheckCircle2, Clipboard, Download, Film, Link2, Loader2, Pencil, Play, Trash2, Upload, UserRound, XCircle } from "lucide-react";
import JSZip from "jszip";
import { actionFilterGroups, actionMatchesFilter, actionTypeByKey, standaloneActionTypes } from "@/lib/action-types";
import { downloadBlob, safe } from "@/lib/action-video-export";
import { isExportPickerCancellation, pickExportDirectory, toCsv, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getRemoteVideoDownloadUrl, getRemoteVideoUrl } from "@/lib/remote-video-store";
import { SmartActionVideoExportSession } from "@/lib/smart-action-video-export";
import { formatTime } from "@/lib/time";
import { ActionClipPlayer, type ClipAction } from "@/components/action-clip-player";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";
import { ActionEditDialog } from "@/components/action-edit-dialog";
import { OutcomeButtons } from "@/components/outcome-buttons";
import type { MatchDetail, MatchScoreEventRecord } from "@/lib/domain";

type Player = { id: string; name: string; club: { name: string } };
type Match = { id: string; roundName: string | null; homeAway: "HOME" | "AWAY"; firstHalfStartSeconds: number | null; firstHalfEndSeconds: number | null; secondHalfStartSeconds: number | null; secondHalfEndSeconds: number | null; scoreboardEnabled: boolean; homeClubName: string | null; awayClubName: string | null; homeClubShortName: string | null; awayClubShortName: string | null; homeTeamColor: string; awayTeamColor: string; scoreEvents: MatchScoreEventRecord[]; club: { name: string }; opponentClub: { name: string }; competition: { id: string; name: string; season: { name: string } }; video: { fileName: string; storageStatus: "LOCAL" | "UPLOADING" | "READY" | "FAILED" } | null };
type ReportAction = ClipAction & { playerId: string; actionKey: string; outcome: string | null; fieldX?: number | null; fieldY?: number | null; notes?: string | null; matchId: string; parentActionId: string; sourceType: "subaction" | "occurrence"; match: Match };
type Competition = { id: string; name: string; season: { name: string } };
export function ReportsClient() {
  const files = useRef(new Map<string, File>()); const videoInput = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<{ players: Player[]; actions: ReportAction[]; matches: Match[]; competitions: Competition[] }>({ players: [], actions: [], matches: [], competitions: [] }); const [playerId, setPlayerId] = useState("all"); const [actionKey, setActionKey] = useState("all"); const [competitionId, setCompetitionId] = useState("all"); const [matchId, setMatchId] = useState("all"); const [selectedId, setSelectedId] = useState<string | null>(null); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [playbackRequest, setPlaybackRequest] = useState(0); const [error, setError] = useState<string | null>(null); const [exporting, setExporting] = useState<"download" | "link" | null>(null); const [downloadingMatchId, setDownloadingMatchId] = useState<string | null>(null); const [deletingId, setDeletingId] = useState<string | null>(null); const [outcomeSavingId, setOutcomeSavingId] = useState<string | null>(null); const [status, setStatus] = useState(""); const [editing, setEditing] = useState<ReportAction | null>(null); const [exportAudio, setExportAudio] = useState(true); const [includeScoreboard, setIncludeScoreboard] = useState(true);
  useEffect(() => { apiFetch<typeof data>("/api/analytics?area=reports").then(setData).catch((caught) => setError(caught.message)); }, []);
  const availableMatches = useMemo(() => data.matches.filter((match) => competitionId === "all" || match.competition.id === competitionId), [competitionId, data.matches]);
  useEffect(() => { if (matchId !== "all" && !availableMatches.some((match) => match.id === matchId)) setMatchId("all"); }, [availableMatches, matchId]);
  const filtered = useMemo(() => data.actions.filter((action) => (playerId === "all" || action.playerId === playerId) && actionMatchesFilter(action.actionKey, actionKey) && (competitionId === "all" || action.match.competition.id === competitionId) && (matchId === "all" || action.matchId === matchId)), [data.actions, playerId, actionKey, competitionId, matchId]);
  useEffect(() => { if (selectedId && !filtered.some((action) => action.id === selectedId)) setSelectedId(null); }, [filtered, selectedId]);
  useEffect(() => { setSelectedIds((current) => current.filter((id) => filtered.some((action) => action.id === id))); }, [filtered]);
  const selectedIndex = filtered.findIndex((action) => action.id === selectedId); const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null; const positive = filtered.filter((action) => action.outcome === "positive").length; const negative = filtered.filter((action) => action.outcome === "negative").length;
  async function addVideos(list: FileList | null) { if (!list) return; const unmatched: string[] = []; for (const file of Array.from(list)) { const match = data.matches.find((item) => item.video?.fileName.toLowerCase() === file.name.toLowerCase()); if (!match) { unmatched.push(file.name); continue; } files.current.set(match.id, file); await rememberMatchVideo(match.id, file).catch(() => undefined); } setError(unmatched.length ? `Could not match these files: ${unmatched.join(", ")}.` : null); }
  async function getVideo(match: Match) { const file = files.current.get(match.id) || await getRememberedMatchVideo(match.id).catch(() => null); if (file) { files.current.set(match.id, file); return file; } return match.video?.storageStatus === "READY" ? (await getRemoteVideoUrl(match.id, "reports")).url : null; }
  function editAction(action: ReportAction) {
    setEditing(action);
  }

  async function reload() { setData(await apiFetch<typeof data>("/api/analytics?area=reports")); }

  async function toggleOutcome(action: ReportAction, outcome: "positive" | "negative") {
    const nextOutcome = action.outcome === outcome ? null : outcome;
    const endpoint = action.sourceType === "subaction" ? `/api/subactions/${action.id}` : `/api/actions/${action.parentActionId}`;
    setOutcomeSavingId(action.id);
    setError(null);
    try {
      await apiFetch(endpoint, { method: "PATCH", body: JSON.stringify({ outcome: nextOutcome }) });
      setData((current) => ({
        ...current,
        actions: current.actions.map((item) => item.id === action.id ? { ...item, outcome: nextOutcome } : item),
      }));
      setEditing((current) => current?.id === action.id ? { ...current, outcome: nextOutcome } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The result classification could not be saved.");
    } finally {
      setOutcomeSavingId(null);
    }
  }

  async function copyDownloadLink() {
    const match = data.matches.find((item) => item.id === matchId);
    if (!match) return setError("Select one match before creating its download link.");
    try { const remote = await getRemoteVideoDownloadUrl(match.id); await navigator.clipboard.writeText(remote.url); setStatus("Secure temporary download link copied."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the download link."); }
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
      setSelectedIds((current) => current.filter((id) => id !== action.id));
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
  async function downloadFullMatch() {
    const match = data.matches.find((item) => item.id === matchId);
    if (!match) return setError("Select one match before downloading its full video.");
    setDownloadingMatchId(match.id);
    setError(null);
    try {
      const local = files.current.get(match.id) || await getRememberedMatchVideo(match.id).catch(() => null);
      if (local) {
        downloadBlob(local, match.video?.fileName || local.name);
        return;
      }
      if (match.video?.storageStatus !== "READY") throw new Error("This match video is not available in the cloud. Select its local fallback first.");
      const remote = await getRemoteVideoDownloadUrl(match.id);
      const link = document.createElement("a");
      link.href = remote.url;
      link.download = match.video.fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The full match video could not be downloaded.");
    } finally {
      setDownloadingMatchId(null);
    }
  }
  async function exportSelected(destination: "download" | "link") {
    if (!selectedIds.length || exporting) return;
    const selected = new Set(selectedIds);
    const actions = filtered.filter((action) => selected.has(action.id));
    let directory = null;
    if (destination === "download") {
      try {
        directory = await pickExportDirectory();
      } catch (caught) {
        if (isExportPickerCancellation(caught)) return;
        return setError(caught instanceof Error ? caught.message : "Could not open the export folder.");
      }
    }
    setExporting(destination);
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
        const result = await exportSession.exportActionClip({ ...currentAction, actionName }, matchName, (message) => setStatus(`${index + 1}/${actions.length} · ${message}`), { includeAudio: exportAudio, scoreboardMatch: includeScoreboard ? currentAction.match as unknown as MatchDetail : null });
        const path = `${safe(currentAction.player.name)}/${safe(actionName)}/${String(index + 1).padStart(3, "0")}-${result.fileName}`;
        if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
        else zip?.file(`${root}/${path}`, result.blob);
        rows.push([currentAction.player.name, actionName, matchName, formatTime(currentAction.eventTimeSeconds), formatTime(currentAction.startTimeSeconds), formatTime(currentAction.endTimeSeconds), path]);
      }
      const csv = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
      if (directory) {
        await writeBlobToDirectory(directory, `${root}/index.csv`, csv);
        setStatus("Selected clips exported.");
      }
      else {
        zip?.file(`${root}/index.csv`, csv);
        setStatus("Creating ZIP file…");
        const archive = await zip!.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (metadata) => setStatus(`Creating ZIP file: ${Math.round(metadata.percent)}%`));
        if (destination === "link") {
          await uploadSelectedExport(archive, `${root}.zip`, setStatus);
          setStatus("Temporary download link copied. It expires in one hour.");
        } else {
          downloadBlob(archive, `${root}.zip`);
          setStatus("Selected clips exported.");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export the clips.");
      setStatus("");
    } finally {
      exportSessions.forEach((session) => session.dispose());
      setExporting(null);
    }
  }
  return <div className="space-y-5"><input ref={videoInput} type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addVideos(event.target.files)}/><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><Label>Aggregated analysis</Label><h1 className="mt-2 text-3xl font-bold text-white">Reports and clips</h1><p className="mt-2 text-sm text-slate-400">Filter actions, export clips and download the complete video for a selected match.</p></div><div className="flex flex-wrap gap-2"><Button disabled={matchId === "all" || Boolean(downloadingMatchId)} title={matchId === "all" ? "Select one match first" : "Download the complete match video"} onClick={() => void downloadFullMatch()}>{downloadingMatchId ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>}Download full match</Button><Button disabled={matchId === "all"} onClick={() => void copyDownloadLink()}><Clipboard size={15}/>Copy download link</Button><Button onClick={() => videoInput.current?.click()}><Upload size={15}/>Local fallback</Button></div></div>{error ? <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}{status ? <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{status}</p> : null}
    <Panel className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Filter label="Player" value={playerId} onChange={setPlayerId}><option value="all">All players</option>{data.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</Filter><Filter label="Action" value={actionKey} onChange={setActionKey}><option value="all">All actions</option><ActionFilterOptions/></Filter><Filter label="Competition" value={competitionId} onChange={setCompetitionId}><option value="all">All competitions</option>{data.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.season.name} · {competition.name}</option>)}</Filter><Filter label="Match" value={matchId} onChange={setMatchId}><option value="all">All matches</option>{availableMatches.map((match) => <option key={match.id} value={match.id}>{match.club.name} vs {match.opponentClub.name}</option>)}</Filter></Panel>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Activity} label="Filtered actions" value={filtered.length}/><Metric icon={Film} label="Matches" value={new Set(filtered.map((action) => action.matchId)).size}/><Metric icon={CheckCircle2} label="Positive" value={positive}/><Metric icon={XCircle} label="Negative" value={negative}/></div>
    <div data-video-workspace className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <ActionClipPlayer key={playbackRequest} area="reports" action={selected} onClipEnd={selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? () => setSelectedId(filtered[selectedIndex + 1].id) : undefined} onEdit={selected ? () => editAction(selected) : undefined} onDelete={selected ? () => void deleteAction(selected) : undefined} deleting={deletingId === selected?.id}/>
      <Panel className="overflow-hidden xl:max-h-[42rem]">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between"><div><Label>Filtered actions</Label><p className="mt-1 text-xs text-slate-500">Select one clip or play the complete filtered list</p></div><Badge>{filtered.length}</Badge></div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2 text-xs">
            <Label>Selected clip export</Label>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={exportAudio} onChange={(event) => setExportAudio(event.target.checked)}/>Include sound</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeScoreboard} onChange={(event) => setIncludeScoreboard(event.target.checked)}/>Include scoreboard when enabled</label>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button size="sm" variant="primary" disabled={!filtered.length} onClick={playAll}><Play size={14}/>Play all</Button>
            <Button size="sm" disabled={!selectedIds.length || Boolean(exporting)} onClick={() => void exportSelected("download")}>{exporting === "download" ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14}/>}Download ({selectedIds.length})</Button>
            <Button size="sm" disabled={!selectedIds.length || Boolean(exporting)} title="Create a temporary ZIP download link for the selected clips" onClick={() => void exportSelected("link")}>{exporting === "link" ? <Loader2 size={14} className="animate-spin"/> : <Link2 size={14}/>}Copy link</Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-slate-500">{selectedIds.length} selected · playback always uses all {filtered.length} results</span>
            <span className="flex shrink-0 gap-2"><button type="button" disabled={!filtered.length} onClick={() => setSelectedIds(filtered.map((action) => action.id))} className="font-semibold text-cyan-200 disabled:opacity-40">Select all</button><button type="button" disabled={!selectedIds.length} onClick={() => setSelectedIds([])} className="font-semibold text-slate-400 disabled:opacity-40">Clear</button></span>
          </div>
        </div>
        <div className="max-h-[36rem] divide-y divide-white/[.06] overflow-y-auto">
          {filtered.length ? filtered.map((action) => <div key={action.id} className={`flex items-center gap-2 p-2 transition ${selectedId === action.id ? "bg-cyan-300/10" : "hover:bg-white/[.03]"}`}>
            <input type="checkbox" aria-label={`Select ${action.player.name} · ${action.actionName} for export`} checked={selectedIds.includes(action.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, action.id])] : current.filter((id) => id !== action.id))} className="h-4 w-4 shrink-0 accent-cyan-300"/>
            <button type="button" onClick={() => playAction(action)} className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left">
              <Play size={15} className="shrink-0 text-cyan-300"/>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{action.player.name} · {actionTypeByKey.get(action.actionKey)?.name || action.actionName}</span><span className="block truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.eventTimeSeconds)}</span></span>
            </button>
            <OutcomeButtons compact disabled={Boolean(outcomeSavingId)} value={action.outcome === "positive" || action.outcome === "negative" ? action.outcome : null} onChange={(outcome) => void toggleOutcome(action, outcome)}/>
            <button type="button" aria-label={`Edit ${action.actionName}`} title="Edit clip" onClick={() => editAction(action)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[.04] text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-200"><Pencil size={12}/></button>
            <button type="button" disabled={deletingId === action.id} aria-label={`Delete ${action.actionName}`} title="Delete clip" onClick={() => void deleteAction(action)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-400/20 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 disabled:opacity-50">{deletingId === action.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}</button>
          </div>) : <div className="p-10 text-center text-sm text-slate-500"><Film className="mx-auto mb-3"/>No actions match these filters.</div>}
        </div>
      </Panel>
    </div>
    {editing ? <ActionEditDialog action={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }}/> : null}
  </div>;
}
function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><Label>{label}</Label><Select className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>; }
function ActionFilterOptions() { return <>{actionFilterGroups.flatMap((group) => [<option key={group.key} value={group.key}>{group.name}</option>, ...group.actionKeys.map((key) => { const action = actionTypeByKey.get(key); return action ? <option key={key} value={key}>　↳ {action.name}</option> : null; })])}{standaloneActionTypes.map((action) => <option key={action.key} value={action.key}>{action.name}</option>)}</>; }
function Metric({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: number }) { return <Panel className="p-4"><div className="flex items-center justify-between"><Label>{label}</Label><Icon size={18} className="text-cyan-300"/></div><p className="mt-3 text-3xl font-bold text-white">{value}</p></Panel>; }

async function uploadSelectedExport(blob: Blob, fileName: string, onStatus: (message: string) => void) {
  const prepared = await apiFetch<{ uploadUrl: string; storageKey: string; fileName: string }>("/api/report-exports", {
    method: "POST",
    body: JSON.stringify({ fileName, fileSize: blob.size }),
  });
  try {
    await putExportBlob(prepared.uploadUrl, blob, (progress) => onStatus(`Uploading selected clips: ${Math.round(progress * 100)}%`));
    const ready = await apiFetch<{ downloadUrl: string; expiresAt: string }>("/api/report-exports", {
      method: "PATCH",
      body: JSON.stringify({ storageKey: prepared.storageKey, fileName: prepared.fileName, fileSize: blob.size }),
    });
    try {
      await navigator.clipboard.writeText(ready.downloadUrl);
    } catch {
      window.prompt("Copy this temporary download link:", ready.downloadUrl);
    }
  } catch (error) {
    await apiFetch(`/api/report-exports?storageKey=${encodeURIComponent(prepared.storageKey)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

function putExportBlob(url: string, blob: Blob, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", "application/zip");
    request.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : blob.size;
      onProgress(total ? event.loaded / total : 0);
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Cloudflare rejected the selected clip export (${request.status}).`));
    request.onerror = () => reject(new Error(`Cloudflare blocked or interrupted the selected clip upload from ${window.location.origin}. Check the R2 CORS policy.`));
    request.send(blob);
  });
}
