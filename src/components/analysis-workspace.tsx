"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Archive, ArrowLeft, ChevronLeft, ChevronRight, Clock3, FileVideo, GripVertical, Loader2, Pause, Play, Tags, Trash2, Upload, UserRound, X } from "lucide-react";
import JSZip from "jszip";

import { Badge, Button, Label, Panel } from "@/components/ui";
import { downloadBlob, exportActionClip, safe } from "@/lib/action-video-export";
import type { ActionRecord, MatchDetail, PlayerRecord } from "@/lib/domain";
import { isExportPickerCancellation, pickExportDirectory, toCsv, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getMatchPeriodAtTime, matchPeriodLabel, periodMarkers, type PeriodMarkerKey } from "@/lib/match-periods";
import { playerPositionLabel } from "@/lib/player-positions";
import { getRemoteVideoUrl, uploadMatchVideo } from "@/lib/remote-video-store";
import { formatTime, roundTime } from "@/lib/time";

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPanelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const flashTimer = useRef<number | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [filterPlayerId, setFilterPlayerId] = useState("all");
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const [taggingPlayerIds, setTaggingPlayerIds] = useState<string[]>([]);
  const [recentPlayerId, setRecentPlayerId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [sideHeight, setSideHeight] = useState<number>();
  const [showIdentifyPrompt, setShowIdentifyPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = useCallback(async () => {
    try { const data = await apiFetch<MatchDetail>(`/api/matches/${matchId}`); setMatch(data); return data; }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not load the match."); }
  }, [matchId]);

  useEffect(() => {
    let active = true;
    load().then(async (data) => {
      if (!active) return;
      if (data?.video?.storageStatus === "READY") {
        const remote = await getRemoteVideoUrl(matchId).catch(() => null);
        if (active && remote) { setSourceUrl(remote.url); setDuration(data.video!.durationSeconds); return; }
      }
      const file = await getRememberedMatchVideo(matchId).catch(() => null);
      if (active && file) setSourceUrl(URL.createObjectURL(file));
    });
    return () => { active = false; };
  }, [load, matchId]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, [sourceUrl]);

  useEffect(() => {
    const node = videoPanelRef.current;
    if (!node) return;
    const measure = () => setSideHeight(Math.ceil(node.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [sourceUrl]);

  async function chooseVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    await rememberMatchVideo(matchId, file).catch(() => undefined);
    setUploading(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      const result = await uploadMatchVideo(matchId, file, ({ progress, detail }) => { setUploadProgress(progress); setNotice(`${detail} ${Math.round(progress * 100)}%`); }, controller.signal);
      setDuration(result.durationSeconds);
      const remote = await getRemoteVideoUrl(matchId);
      setSourceUrl(remote.url);
      await load();
      setNotice(result.resumed ? "Video upload resumed and completed successfully." : "Video stored securely in Cloudflare R2.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The video could not be uploaded.");
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null;
      setUploading(false);
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(duration || video.duration || 0, seconds));
    setPreviewEnd(null);
    video.currentTime = next;
    setCurrentTime(next);
  }

  async function tagPlayer(player: PlayerRecord) {
    if (!sourceUrl) return setNotice("Select this match video first.");
    if (taggingPlayerIds.includes(player.id)) return;
    const eventTimeSeconds = roundTime(videoRef.current?.currentTime ?? currentTime);
    setTaggingPlayerIds((current) => [...current, player.id]);
    try {
      const saved = await apiFetch<ActionRecord>(`/api/matches/${matchId}/actions`, { method: "POST", body: JSON.stringify({ playerId: player.id, eventTimeSeconds }) });
      setMatch((current) => current ? { ...current, playerActions: [...current.playerActions, saved].sort((a, b) => a.eventTimeSeconds - b.eventTimeSeconds) } : current);
      setRecentPlayerId(player.id);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setRecentPlayerId(null), 800);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the player occurrence."); }
    finally { setTaggingPlayerIds((current) => current.filter((id) => id !== player.id)); }
  }

  async function reorderPlayers(playerIds: string[]) {
    if (!match) return;
    const previous = match;
    const byId = new Map(match.squad.map((item) => [item.playerId, item]));
    setMatch({ ...match, squad: playerIds.map((playerId, sortOrder) => ({ ...byId.get(playerId)!, sortOrder })) });
    try {
      setMatch(await apiFetch<MatchDetail>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify({ playerIds }) }));
      setNotice("Player photo order saved for this match.");
    } catch (error) {
      setMatch(previous);
      setNotice(error instanceof Error ? error.message : "Could not save the player order.");
    }
  }

  async function setPeriodMarker(key: PeriodMarkerKey) {
    try {
      const saved = await apiFetch<MatchDetail>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify({ [key]: roundTime(currentTime) }) });
      setMatch(saved);
      setNotice(`Match period saved at ${formatTime(currentTime)}. Occurrences were reassigned automatically.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the match period."); }
  }

  function preview(action: ActionRecord) {
    const video = videoRef.current;
    if (!video) return setNotice("Select the video again to play this clip.");
    setPreviewEnd(action.endTimeSeconds);
    video.currentTime = action.startTimeSeconds;
    void video.play();
  }

  async function removeAction(action: ActionRecord) {
    if (!confirm(`Delete ${action.player.name}'s occurrence at ${formatTime(action.eventTimeSeconds)} and all its subactions?`)) return;
    await apiFetch(`/api/actions/${action.id}`, { method: "DELETE" });
    setMatch((current) => current ? { ...current, playerActions: current.playerActions.filter((item) => item.id !== action.id) } : current);
  }

  async function removeLastAction(action: ActionRecord | null) {
    if (!action) return;
    try {
      await apiFetch(`/api/actions/${action.id}`, { method: "DELETE" });
      setMatch((current) => current ? { ...current, playerActions: current.playerActions.filter((item) => item.id !== action.id) } : current);
      setNotice(`Last occurrence removed: ${action.player.name} at ${formatTime(action.eventTimeSeconds)}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the last occurrence."); }
  }

  async function exportActions(actions: ActionRecord[]) {
    if (!match || !actions.length || exporting) return;
    const localFile = await getRememberedMatchVideo(match.id).catch(() => null);
    const source = localFile || (match.video?.storageStatus === "READY" ? (await getRemoteVideoUrl(match.id).catch(() => null))?.url : null);
    if (!source) return setNotice("Upload this match video before exporting clips.");
    let directory = null;
    try { directory = await pickExportDirectory(); }
    catch (error) { if (isExportPickerCancellation(error)) return; return setNotice(error instanceof Error ? error.message : "Could not open the export folder."); }
    setExporting(true);
    setNotice(null);
    const matchName = `${match.club.name} vs ${match.opponentClub.name}`;
    const root = `${safe(matchName)}-${actions.length}-clips`;
    const zip = directory ? null : new JSZip();
    const rows = [["player", "period", "event", "start", "end", "subactions", "files"]];
    try {
      for (const [index, action] of actions.entries()) {
        const names = [...new Set(action.subActions.map((item) => item.actionName))];
        const folders = names.length ? names : ["Unclassified"];
        const label = names.join(" + ") || "Unclassified";
        setExportStatus(`Exporting ${index + 1} of ${actions.length}: ${action.player.name}`);
        const result = await exportActionClip(source, { ...action, actionName: label }, matchName, (status) => setExportStatus(`${index + 1}/${actions.length} · ${status}`));
        const fileName = `${String(index + 1).padStart(3, "0")}-${result.fileName}`;
        const paths = folders.map((folder) => `${safe(action.player.name)}/${safe(folder)}/${fileName}`);
        for (const path of paths) {
          if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
          else zip?.file(`${root}/${path}`, result.blob);
        }
        rows.push([action.player.name, matchPeriodLabel(action.period), formatTime(action.eventTimeSeconds), formatTime(action.startTimeSeconds), formatTime(action.endTimeSeconds), folders.join(" | "), paths.join(" | ")]);
      }
      const csv = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
      if (directory) await writeBlobToDirectory(directory, `${root}/index.csv`, csv);
      else {
        zip?.file(`${root}/index.csv`, csv);
        setExportStatus("Creating ZIP file…");
        downloadBlob(await zip!.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (metadata) => setExportStatus(`Creating ZIP file: ${Math.round(metadata.percent)}%`)), `${root}.zip`);
      }
      setNotice(`${actions.length} clips exported successfully${directory ? ` to ${root}` : " in a ZIP file"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not export the clips."); }
    finally { setExporting(false); setExportStatus(""); }
  }

  if (!match) return <Panel className="p-8 text-center text-slate-400">{notice || "Loading analysis…"}</Panel>;
  const players = match.squad.map((item) => item.player);
  const filtered = filterPlayerId === "all" ? match.playerActions : match.playerActions.filter((action) => action.playerId === filterPlayerId);
  const timelineDuration = duration || match.video?.durationSeconds || Math.max(1, ...match.playerActions.map((action) => action.endTimeSeconds));
  const currentPeriod = getMatchPeriodAtTime(match, currentTime);
  const lastAction = match.playerActions.reduce<ActionRecord | null>((latest, action) => !latest || Date.parse(action.createdAt) > Date.parse(latest.createdAt) ? action : latest, null);
  const sideStyle = sideHeight ? ({ "--analysis-side-height": `${sideHeight}px` } as CSSProperties) : undefined;

  return <div className="space-y-2 sm:space-y-3">
    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => void chooseVideo(event.target.files?.[0])}/>
    <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[.045] px-3 py-2"><div className="min-w-0"><Link href="/" className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><ArrowLeft size={11}/>Matches</Link><h1 className="truncate text-lg font-bold text-white">{match.club.name} vs {match.opponentClub.name}</h1><p className="truncate text-xs text-slate-500">{match.competition.name}{match.roundName ? ` · ${match.roundName}` : ""}</p></div><Button size="sm" variant={uploading ? "danger" : "secondary"} onClick={() => uploading ? uploadAbort.current?.abort() : fileRef.current?.click()}>{uploading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} {uploading ? `Cancel · ${Math.round(uploadProgress * 100)}%` : match.video?.storageStatus === "READY" ? "Replace video" : match.video ? "Upload existing video" : "Upload video"}</Button></header>
    {notice || exporting ? <div role="status" className="fixed bottom-3 right-3 z-50 flex max-w-sm gap-3 rounded-lg border border-cyan-300/25 bg-pitch-950/95 px-3 py-2 text-xs text-cyan-100 shadow-2xl"><span>{exporting ? exportStatus : notice}</span>{!exporting ? <button onClick={() => setNotice(null)}><X size={14}/></button> : null}</div> : null}

    <PlayerRail players={players} taggingPlayerIds={taggingPlayerIds} recentPlayerId={recentPlayerId} onTag={tagPlayer} onReorder={reorderPlayers}/>
    <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div ref={videoPanelRef} className="min-w-0"><VideoPanel sourceUrl={sourceUrl} videoRef={videoRef} duration={duration} currentTime={currentTime} rate={rate} playing={playing} previewEnd={previewEnd} lastAction={lastAction} setDuration={setDuration} setCurrentTime={setCurrentTime} setPlaying={setPlaying} setPreviewEnd={setPreviewEnd} setRate={setRate} seekTo={seekTo} onChoose={() => fileRef.current?.click()} onDeleteLast={() => void removeLastAction(lastAction)} onEnded={() => { if (previewEnd === null && match.playerActions.length) setShowIdentifyPrompt(true); }}/></div>
      <RecordedOccurrences actions={filtered} players={players} match={match} currentTime={currentTime} currentPeriod={currentPeriod} sourceUrl={sourceUrl} sideStyle={sideStyle} filterPlayerId={filterPlayerId} exporting={exporting} onFilter={setFilterPlayerId} onPreview={preview} onDelete={removeAction} onExport={() => void exportActions(filtered)} onSeek={seekTo} onSetPeriodMarker={setPeriodMarker}/>
    </div>

    <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><div><Label>Identification</Label><h2 className="mt-1 text-sm font-bold text-white">Subactions</h2><p className="mt-1 text-xs text-slate-500">After recording the players, identify every occurrence in the dedicated workspace.</p></div><Button variant="primary" disabled={!match.playerActions.length} onClick={() => router.push(`/analysis/${matchId}/subactions`)}><Tags size={15}/>Identify subactions</Button></Panel>
    <Timeline players={players} actions={filtered} duration={timelineDuration} onSelect={preview}/>

    {showIdentifyPrompt ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><Panel className="w-full max-w-md p-5"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300"><Tags size={20}/></div><h2 className="mt-4 text-lg font-bold text-white">The video has finished</h2><p className="mt-2 text-sm text-slate-400">Do you want to identify the recorded subactions now?</p><div className="mt-5 flex justify-end gap-2"><Button onClick={() => setShowIdentifyPrompt(false)}>Not now</Button><Button variant="primary" onClick={() => router.push(`/analysis/${matchId}/subactions`)}><Tags size={15}/>Identify subactions</Button></div></Panel></div> : null}
  </div>;
}

function PlayerRail({ players, taggingPlayerIds, recentPlayerId, onTag, onReorder }: { players: PlayerRecord[]; taggingPlayerIds: string[]; recentPlayerId: string | null; onTag: (player: PlayerRecord) => void; onReorder: (playerIds: string[]) => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  function swap(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const ids = players.map((player) => player.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorder(ids);
  }
  return <Panel className="flex min-w-0 items-center overflow-hidden"><div className="shrink-0 border-r border-white/10 px-3 py-2"><Label>Players</Label><p className="whitespace-nowrap text-[9px] text-slate-500">Click · drag to reorder</p></div><div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-2">{players.map((player) => <button key={player.id} data-player-id={player.id} draggable type="button" title={`${player.shirtNumber ? `${player.shirtNumber} · ` : ""}${player.name} · ${playerPositionLabel(player.position)} · Drag to reorder`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingId(player.id); suppressClick.current = true; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); swap(player.id); setDraggingId(null); }} onDragEnd={() => { setDraggingId(null); window.setTimeout(() => { suppressClick.current = false; }, 100); }} onClick={() => { if (!suppressClick.current) void onTag(player); }} className={`group relative flex h-12 w-12 shrink-0 cursor-grab items-center justify-center overflow-hidden rounded-md border bg-cyan-300/10 bg-cover bg-center transition active:cursor-grabbing ${draggingId === player.id ? "opacity-40" : ""} ${recentPlayerId === player.id ? "border-emerald-300 ring-2 ring-emerald-300/50" : "border-white/10 hover:border-cyan-300"}`} style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}>{!player.photoUrl ? <UserRound className="text-cyan-200" size={18}/> : null}<GripVertical size={10} className="absolute right-0 top-0 rounded-bl bg-black/70 text-white/80"/>{taggingPlayerIds.includes(player.id) ? <span className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 size={15} className="animate-spin text-cyan-200"/></span> : null}</button>)}</div></Panel>;
}

function VideoPanel({ sourceUrl, videoRef, duration, currentTime, rate, playing, previewEnd, lastAction, setDuration, setCurrentTime, setPlaying, setPreviewEnd, setRate, seekTo, onChoose, onDeleteLast, onEnded }: { sourceUrl: string | null; videoRef: RefObject<HTMLVideoElement | null>; duration: number; currentTime: number; rate: number; playing: boolean; previewEnd: number | null; lastAction: ActionRecord | null; setDuration: (value: number) => void; setCurrentTime: (value: number) => void; setPlaying: (value: boolean) => void; setPreviewEnd: (value: number | null) => void; setRate: (value: number) => void; seekTo: (value: number) => void; onChoose: () => void; onDeleteLast: () => void; onEnded: () => void }) {
  return <Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" className="h-full w-full" playsInline onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.playbackRate = rate; }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); if (previewEnd !== null && event.currentTarget.currentTime >= previewEnd - .04) { event.currentTarget.pause(); event.currentTarget.currentTime = previewEnd; setPreviewEnd(null); } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={onEnded}/> : <button onClick={onChoose} className="flex h-full w-full flex-col items-center justify-center p-6 text-center"><FileVideo size={38} className="text-cyan-300"/><h2 className="mt-3 text-sm font-bold text-white">Upload the match video</h2><p className="mt-1 text-xs text-slate-500">It will be stored privately in Cloudflare R2.</p></button>}</div><div className="border-t border-white/10 p-2"><input aria-label="Video position" type="range" min={0} max={duration || 0} step={.1} value={Math.min(currentTime, duration || 0)} disabled={!sourceUrl} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-cyan-300"/><div className="mt-1.5 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1"><Button size="icon" className="h-8 w-8" disabled={!sourceUrl} onClick={() => seekTo(currentTime - 5)}><ChevronLeft size={15}/></Button><Button size="icon" className="h-8 w-8" variant="primary" disabled={!sourceUrl} onClick={() => { const video = videoRef.current; if (video?.paused) void video.play(); else video?.pause(); }}>{playing ? <Pause size={15}/> : <Play size={15}/>}</Button><Button size="icon" className="h-8 w-8" disabled={!sourceUrl} onClick={() => seekTo(currentTime + 5)}><ChevronRight size={15}/></Button><div className="flex overflow-hidden rounded-md border border-white/10">{[.5, 1, 2, 4].map((value) => <button key={value} type="button" onClick={() => { setRate(value); if (videoRef.current) videoRef.current.playbackRate = value; }} className={`h-8 px-2 text-[10px] ${rate === value ? "bg-cyan-300 text-slate-950" : "bg-white/[.04] text-slate-300"}`}>{value}×</button>)}</div><Button size="icon" variant="danger" className="h-8 w-8" disabled={!lastAction} title={lastAction ? `Delete last occurrence: ${lastAction.player.name} at ${formatTime(lastAction.eventTimeSeconds)}` : "No occurrence to delete"} aria-label="Delete last recorded occurrence" onClick={onDeleteLast}><Trash2 size={14}/></Button></div><span className="inline-flex items-center gap-1 font-mono text-xs text-white"><Clock3 size={13} className="text-cyan-300"/>{formatTime(currentTime)} / {formatTime(duration)}</span></div></div></Panel>;
}

function RecordedOccurrences({ actions, players, match, currentTime, currentPeriod, sourceUrl, sideStyle, filterPlayerId, exporting, onFilter, onPreview, onDelete, onExport, onSeek, onSetPeriodMarker }: { actions: ActionRecord[]; players: PlayerRecord[]; match: MatchDetail; currentTime: number; currentPeriod: number | null; sourceUrl: string | null; sideStyle?: CSSProperties; filterPlayerId: string; exporting: boolean; onFilter: (id: string) => void; onPreview: (action: ActionRecord) => void; onDelete: (action: ActionRecord) => void; onExport: () => void; onSeek: (seconds: number) => void; onSetPeriodMarker: (key: PeriodMarkerKey) => void }) {
  return <Panel style={sideStyle} className="flex min-h-0 flex-col overflow-hidden xl:h-[var(--analysis-side-height)]"><div className="shrink-0 border-b border-white/10 p-2"><div className="flex items-center justify-between gap-2"><div><Label>Recorded actions</Label><p className="text-[10px] text-slate-500">{actions.length} occurrences</p></div><select aria-label="Filter by player" value={filterPlayerId} onChange={(event) => onFilter(event.target.value)} className="min-w-0 max-w-28 rounded-md border border-white/10 bg-pitch-900 p-1.5 text-[10px]"><option value="all">All</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div><Button size="sm" className="mt-2 h-7 w-full text-[10px]" disabled={!actions.length || exporting} onClick={onExport}>{exporting ? <Loader2 size={12} className="animate-spin"/> : <Archive size={12}/>}Export {filterPlayerId === "all" ? "all clips" : "player clips"}</Button></div><div className="min-h-0 flex-1 overflow-y-auto">{actions.length ? actions.map((action) => { const names = action.subActions.map((item) => item.actionName); return <div key={action.id} className="border-b border-white/[.06] p-2"><button onClick={() => onPreview(action)} className="flex w-full items-center gap-2 text-left"><span className={`h-2 w-2 rounded-full ${names.length ? "bg-emerald-400" : "bg-amber-300"}`}/><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-white">{action.player.name}</span><span className="block truncate text-[9px] text-slate-500">{names.join(" · ") || "Unclassified"}</span></span><span className="text-right font-mono text-[9px] text-slate-500"><span className="block">{formatTime(action.eventTimeSeconds)}</span><span>{matchPeriodLabel(action.period)}</span></span></button><div className="mt-1.5 flex items-center gap-1"><Badge className="px-1.5 py-0.5 text-[9px]">{action.subActions.length} sub.</Badge><button aria-label="Delete occurrence" onClick={() => void onDelete(action)} className="ml-auto p-1 text-slate-600 hover:text-red-300"><Trash2 size={11}/></button></div></div>; }) : <p className="p-4 text-center text-xs text-slate-500">No occurrences yet.</p>}</div><div className="shrink-0 border-t border-white/10 p-2"><div className="flex items-center justify-between"><div><Label>Match periods</Label><p className="text-[9px] text-slate-500">Current: {matchPeriodLabel(currentPeriod)}</p></div><span className="font-mono text-[9px] text-slate-500">{formatTime(currentTime)}</span></div><div className="mt-1.5 space-y-1">{periodMarkers.map(([key, label]) => { const seconds = match[key]; return <div key={key} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-1"><Button size="sm" className="h-7 justify-between px-2 text-[9px]" variant={seconds === null ? "secondary" : "primary"} disabled={!sourceUrl && seconds === null} onClick={() => seconds === null ? void onSetPeriodMarker(key) : onSeek(seconds)}><span className="truncate">{label}</span><span className="ml-1 font-mono">{seconds === null ? "Mark" : formatTime(seconds)}</span></Button><Button size="sm" className="h-7 px-1 text-[9px]" disabled={!sourceUrl} onClick={() => void onSetPeriodMarker(key)}>Set</Button></div>; })}</div></div></Panel>;
}

function Timeline({ players, actions, duration, onSelect }: { players: PlayerRecord[]; actions: ActionRecord[]; duration: number; onSelect: (action: ActionRecord) => void }) {
  const visible = players.filter((player) => actions.some((action) => action.playerId === player.id));
  return <Panel className="p-2"><div className="flex items-center justify-between"><div><Label>Timeline</Label><span className="ml-2 text-[10px] text-slate-500">One row per player</span></div><span className="text-[10px] text-slate-500">−4s / +6s</span></div><div className="mt-2 overflow-x-auto"><div className="min-w-[620px] overflow-hidden rounded-md border border-white/10">{visible.length ? visible.map((player) => <div key={player.id} className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-white/[.07] last:border-0"><div className="truncate border-r border-white/[.07] px-2 py-1.5 text-[10px] text-slate-300">{player.name}</div><div className="relative min-h-7 bg-black/20">{actions.filter((action) => action.playerId === player.id).map((action) => { const left = Math.max(0, (action.startTimeSeconds / duration) * 100); const width = Math.max(.6, ((action.endTimeSeconds - action.startTimeSeconds) / duration) * 100); const color = action.subActions[0] ? "#34d399" : "#fbbf24"; return <button key={action.id} title={`${action.subActions.map((item) => item.actionName).join(", ") || "Unclassified"} · ${formatTime(action.eventTimeSeconds)}`} onClick={() => onSelect(action)} className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border border-white/25 hover:h-5" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}/>; })}</div></div>) : <p className="p-3 text-xs text-slate-500">No occurrences yet.</p>}</div></div></Panel>;
}
