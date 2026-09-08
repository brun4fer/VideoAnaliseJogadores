"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, FileVideo, Loader2, Minimize2, Pause, Pencil, Play, Trash2, Upload } from "lucide-react";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { actionTypeByKey } from "@/lib/action-types";
import { formatTime } from "@/lib/time";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { Button, Label, Panel } from "@/components/ui";

export type ClipAction = {
  id: string; actionKey: string; actionName: string; startTimeSeconds: number; endTimeSeconds: number; eventTimeSeconds: number;
  player: { name: string };
  match: { id: string; roundName: string | null; club: { name: string }; opponentClub: { name: string }; video: { fileName: string; storageStatus: "LOCAL" | "UPLOADING" | "READY" | "FAILED" } | null };
};

type ClipArea = "maps" | "reports";

export function ActionClipPlayer({ action, area, className = "", onEdit, onDelete, onClipEnd, deleting = false }: {
  action: ClipAction | null;
  area: ClipArea;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onClipEnd?: () => void;
  deleting?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const completedActionRef = useRef<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    const request = ++requestRef.current;
    completedActionRef.current = null;
    setSourceUrl(null);
    setNotice(null);
    setPlaying(false);
    setCurrentTime(action?.startTimeSeconds || 0);
    setClipEnd(action?.endTimeSeconds || 0);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (!action) return () => { active = false; };
    setLoading(true);
    (action.match.video?.storageStatus === "READY" ? getRemoteVideoUrl(action.match.id, area).then((remote) => remote.url).catch(() => null) : Promise.resolve(null)).then(async (remoteUrl) => {
      if (!active || request !== requestRef.current) return;
      if (remoteUrl) {
        setSourceUrl(remoteUrl);
        return;
      }
      const file = await getRememberedMatchVideo(action.match.id);
      if (!active || request !== requestRef.current) return;
      if (file) {
        objectUrlRef.current = URL.createObjectURL(file);
        setSourceUrl(objectUrlRef.current);
      } else {
        setNotice(`Select the local video “${action.match.video?.fileName || `${action.match.club.name} vs ${action.match.opponentClub.name}`}”.`);
      }
    }).catch(() => {
      if (active) setNotice("The local video could not be restored.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [action, area]);

  useEffect(() => () => {
    requestRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement && panelRef.current?.closest("[data-video-workspace]") === document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!sourceUrl || !action || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      seekBy(event.key === "ArrowLeft" ? -5 : 5);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function bounds(video = videoRef.current) {
    const start = action?.startTimeSeconds || 0;
    const end = Math.min(video?.duration || action?.endTimeSeconds || 0, action?.endTimeSeconds || video?.duration || 0);
    return { start, end: Math.max(start, end) };
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const { start, end } = bounds(video);
    const next = Math.max(start, Math.min(end, seconds));
    completedActionRef.current = null;
    video.currentTime = next;
    setCurrentTime(next);
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (video) seekTo(video.currentTime + seconds);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !action) return;
    if (!video.paused) return video.pause();
    const { start, end } = bounds(video);
    if (video.currentTime < start || video.currentTime >= end) seekTo(start);
    void video.play();
  }

  async function toggleFullscreen() {
    const target = panelRef.current?.closest("[data-video-workspace]") as HTMLElement | null || panelRef.current;
    if (!target) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen();
  }

  async function selectVideo(file?: File) {
    if (!file || !action) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setSourceUrl(objectUrlRef.current);
    setNotice(null);
    await rememberMatchVideo(action.match.id, file).catch(() => setNotice("The video opened, but you may need to select it again in a future session."));
  }

  const actionName = action ? actionTypeByKey.get(action.actionKey)?.name || action.actionName : "";
  const start = action?.startTimeSeconds || 0;
  const end = Math.max(start, clipEnd || action?.endTimeSeconds || start);
  return <div ref={panelRef} data-clip-player className="min-h-0">
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void selectVideo(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3"><div className="min-w-0"><Label>Selected clip</Label>{action ? <><p className="mt-1 truncate text-sm font-semibold text-white">{action.player.name} · {actionName}</p><p className="mt-1 truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.startTimeSeconds)}–{formatTime(action.endTimeSeconds)}</p></> : null}</div>{action && (onEdit || onDelete) ? <div className="flex shrink-0 items-center gap-1">{onEdit ? <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[.05] px-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[.1] hover:text-cyan-200"><Pencil size={12}/>Edit</button> : null}{onDelete ? <button type="button" disabled={deleting} aria-label="Delete this analysed clip" title="Delete this analysed clip" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-md border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50">{deleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}</button> : null}</div> : null}</div>
      <div data-video-stage className="relative aspect-video min-h-0 bg-black">{sourceUrl && action ? <video ref={videoRef} key={`${sourceUrl}-${action.id}`} src={sourceUrl} crossOrigin="anonymous" playsInline className="h-full w-full cursor-pointer object-contain" onClick={togglePlayback} onLoadedMetadata={(event) => { const { start: clipStart, end: clipFinish } = bounds(event.currentTarget); setClipEnd(clipFinish); event.currentTarget.currentTime = clipStart; setCurrentTime(clipStart); void event.currentTarget.play(); }} onPlay={(event) => { const { start: clipStart, end: clipFinish } = bounds(event.currentTarget); if (event.currentTarget.currentTime < clipStart || event.currentTarget.currentTime >= clipFinish) { completedActionRef.current = null; event.currentTarget.currentTime = clipStart; } setPlaying(true); }} onPause={() => setPlaying(false)} onTimeUpdate={(event) => { const { end: clipFinish } = bounds(event.currentTarget); setCurrentTime(event.currentTarget.currentTime); if (event.currentTarget.currentTime >= clipFinish && completedActionRef.current !== action.id) { completedActionRef.current = action.id; event.currentTarget.pause(); event.currentTarget.currentTime = clipFinish; setCurrentTime(clipFinish); onClipEnd?.(); } }}/> : <div className="flex h-full flex-col items-center justify-center p-5 text-center"><FileVideo size={32} className="text-cyan-300"/><p className="mt-3 text-xs text-slate-400">{action ? loading ? "Restoring video…" : notice || "Upload this match’s video in its analysis page." : "Select an action to view its clip."}</p>{action && !loading ? <Button size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><Upload size={14}/>Use local fallback</Button> : null}</div>}</div>
      <div className="shrink-0 border-t border-white/10 p-2">
        <input aria-label="Clip position" type="range" min={start} max={end} step={0.1} value={Math.max(start, Math.min(currentTime, end))} disabled={!sourceUrl || !action || end <= start} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-cyan-300"/>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1"><Button size="icon" className="h-8 w-8" title="Back 5 seconds (←)" disabled={!sourceUrl} onClick={() => seekBy(-5)}><ChevronLeft size={15}/></Button><Button size="icon" className="h-8 w-8" variant="primary" title={playing ? "Pause" : "Play"} disabled={!sourceUrl || !action} onClick={togglePlayback}>{playing ? <Pause size={15}/> : <Play size={15}/>}</Button><Button size="icon" className="h-8 w-8" title="Forward 5 seconds (→)" disabled={!sourceUrl} onClick={() => seekBy(5)}><ChevronRight size={15}/></Button></div>
          <span className="font-mono text-[11px] text-white">{formatTime(currentTime)} <span className="text-slate-600">/ {formatTime(end)}</span></span>
          <Button size="icon" className="h-8 w-8" title={fullscreen ? "Exit fullscreen" : "Fullscreen video and moments"} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen video and moments"} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={15}/> : <Expand size={15}/>}</Button>
        </div>
      </div>
    </Panel>
  </div>;
}
