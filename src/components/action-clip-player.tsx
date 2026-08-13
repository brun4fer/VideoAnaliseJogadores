"use client";

import { useEffect, useRef, useState } from "react";
import { FileVideo, Upload } from "lucide-react";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { actionTypeByKey } from "@/lib/action-types";
import { formatTime } from "@/lib/time";
import { Button, Label, Panel } from "@/components/ui";

export type ClipAction = {
  id: string; actionKey: string; actionName: string; startTimeSeconds: number; endTimeSeconds: number; eventTimeSeconds: number;
  player: { name: string };
  match: { id: string; roundName: string | null; club: { name: string }; opponentClub: { name: string }; video: { fileName: string } | null };
};

export function ActionClipPlayer({ action, className = "" }: { action: ClipAction | null; className?: string }) {
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
    getRememberedMatchVideo(action.match.id).then((file) => {
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
    <div className="border-b border-white/10 p-3"><Label>Selected clip</Label>{action ? <><p className="mt-1 truncate text-sm font-semibold text-white">{action.player.name} · {actionName}</p><p className="mt-1 truncate text-xs text-slate-500">{action.match.club.name} vs {action.match.opponentClub.name} · {formatTime(action.startTimeSeconds)}–{formatTime(action.endTimeSeconds)}</p></> : null}</div>
    <div className="relative aspect-video bg-black">{sourceUrl && action ? <video key={`${sourceUrl}-${action.id}`} src={sourceUrl} controls playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); event.currentTarget.currentTime = Math.min(action.startTimeSeconds, end); void event.currentTarget.play(); }} onPlay={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); if (event.currentTarget.currentTime < action.startTimeSeconds || event.currentTarget.currentTime >= end) event.currentTarget.currentTime = Math.min(action.startTimeSeconds, end); }} onTimeUpdate={(event) => { const end = Math.min(event.currentTarget.duration, action.endTimeSeconds); if (event.currentTarget.currentTime >= end) { event.currentTarget.pause(); event.currentTarget.currentTime = end; } }}/> : <div className="flex h-full flex-col items-center justify-center p-5 text-center"><FileVideo size={32} className="text-cyan-300"/><p className="mt-3 text-xs text-slate-400">{action ? loading ? "Restoring video…" : notice || "Select this match’s video." : "Select an action to view its clip."}</p>{action && !loading ? <Button size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><Upload size={14}/>Select video</Button> : null}</div>}</div>
  </Panel>;
}
