"use client";

import { useEffect, useRef, useState } from "react";
import { FileVideo, Loader2, Pencil, Trash2, Upload } from "lucide-react";
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

export function ActionClipPlayer({ action, className = "", onEdit, onDelete, deleting = false }: { action: ClipAction | null; className?: string; onEdit?: () => void; onDelete?: () => void; deleting?: boolean }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const request = ++requestRef.current;
    setSourceUrl(null);
    setNotice(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (!action) return () => { active = false; };
    setLoading(true);
    (action.match.video?.storageStatus === "READY" ? getRemoteVideoUrl(action.match.id).then((remote) => remote.url).catch(() => null) : Promise.resolve(null)).then(async (remoteUrl) => {
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
  }, [action]);

  useEffect(() => () => {
    requestRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  async function selectVideo(file?: File) {
    if (!file || !action) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setSourceUrl(objectUrlRef.current);
    setNotice(null);
    await rememberMatchVideo(action.match.id, file).catch(() => setNotice("The video opened, but you may need to select it again in a future session."));
  }

  const actionName = action ? actionTypeByKey.get(action.actionKey)?.name || action.actionName : "";
  return <Panel className={`overflow-hidden ${className}`}>
    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void selectVideo(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
    <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3"><div className="min-w-0"><Label>Selected clip</Label>{action ? <><p className="mt-1 truncate text-sm font-semibold text-white">{action.player.name} · {actionName}</p><p className="mt-1 truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.startTimeSeconds)}–{formatTime(action.endTimeSeconds)}</p></> : null}</div>{action && (onEdit || onDelete) ? <div className="flex shrink-0 items-center gap-1">{onEdit ? <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[.05] px-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[.1] hover:text-cyan-200"><Pencil size={12}/>Edit</button> : null}{onDelete ? <button type="button" disabled={deleting} aria-label="Delete this analysed clip" title="Delete this analysed clip" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-md border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50">{deleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}</button> : null}</div> : null}</div>
    <div className="relative aspect-video bg-black">{sourceUrl && action ? <video key={`${sourceUrl}-${action.id}`} src={sourceUrl} crossOrigin="anonymous" controls playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); event.currentTarget.currentTime = Math.min(action.startTimeSeconds, end); void event.currentTarget.play(); }} onPlay={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); if (event.currentTarget.currentTime < action.startTimeSeconds || event.currentTarget.currentTime >= end) event.currentTarget.currentTime = Math.min(action.startTimeSeconds, end); }} onTimeUpdate={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); if (event.currentTarget.currentTime >= end) { event.currentTarget.pause(); event.currentTarget.currentTime = end; } }}/> : <div className="flex h-full flex-col items-center justify-center p-5 text-center"><FileVideo size={32} className="text-cyan-300"/><p className="mt-3 text-xs text-slate-400">{action ? loading ? "Restoring video…" : notice || "Upload this match’s video in its analysis page." : "Select an action to view its clip."}</p>{action && !loading ? <Button size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><Upload size={14}/>Use local fallback</Button> : null}</div>}</div>
  </Panel>;
}
