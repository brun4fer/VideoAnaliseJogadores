"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, FileVideo, Loader2, Pause, Pencil, Play, Save, Tags, Trash2, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { actionsForPlayer, actionTypeByKey, type ActionType } from "@/lib/action-types";
import type { ActionRecord, MatchDetail, SubActionRecord } from "@/lib/domain";
import { attackDirectionLabel } from "@/lib/field-normalization";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { matchPeriodLabel } from "@/lib/match-periods";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { formatTime, roundTime } from "@/lib/time";
import { Pitch, type Coordinate } from "@/components/pitch";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";

export function SubactionWorkspace({ matchId }: { matchId: string }) {
  const search = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterPlayerId, setFilterPlayerId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(search.get("action"));
  const [selectedType, setSelectedType] = useState<ActionType | null>(null);
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<MatchDetail>(`/api/matches/${matchId}`).then(async (data) => {
      setMatch(data);
      const requested = search.get("action");
      setSelectedId(data.playerActions.some((item) => item.id === requested) ? requested : data.playerActions[0]?.id || null);
      if (data.video?.storageStatus === "READY") {
        const remote = await getRemoteVideoUrl(matchId).catch(() => null);
        if (remote) { setSourceUrl(remote.url); return; }
      }
      const file = await getRememberedMatchVideo(matchId).catch(() => null);
      if (file) setSourceUrl(URL.createObjectURL(file));
    }).catch((error) => setNotice(error.message)).finally(() => setLoading(false));
  }, [matchId, search]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const players = match?.squad.map((item) => item.player) || [];
  const occurrences = useMemo(() => (match?.playerActions || []).filter((item) => filterPlayerId === "all" || item.playerId === filterPlayerId), [filterPlayerId, match?.playerActions]);
  const selectedIndex = occurrences.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? occurrences[selectedIndex] : occurrences[0] || null;
  const types = selected ? actionsForPlayer(selected.player.isGoalkeeper) : [];
  const groups = [...new Set(types.map((type) => type.group))];
  const markers = (selected?.subActions || []).filter((item) => item.fieldX != null && item.fieldY != null).map((item) => ({ id: item.id, x: item.fieldX!, y: item.fieldY!, color: actionTypeByKey.get(item.actionKey)?.color, label: item.actionName, details: [`Time: ${formatTime(item.eventTimeSeconds)}`] }));

  useEffect(() => {
    if (!selected) return;
    setCurrentTime(selected.eventTimeSeconds);
    setSelectedType(null); setCoordinate(null); setEditingId(null);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = selected.startTimeSeconds; }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectOccurrence(action: ActionRecord) {
    setSelectedId(action.id);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = action.startTimeSeconds; }
  }

  function togglePlayback() {
    const video = videoRef.current; if (!video || !selected) return;
    if (!video.paused) return video.pause();
    if (video.currentTime < selected.startTimeSeconds || video.currentTime >= selected.endTimeSeconds) video.currentTime = selected.startTimeSeconds;
    void video.play();
  }

  function editSubaction(subaction: SubActionRecord) {
    setEditingId(subaction.id); setSelectedType(actionTypeByKey.get(subaction.actionKey) || null);
    setCoordinate(subaction.fieldX != null && subaction.fieldY != null ? { x: subaction.fieldX, y: subaction.fieldY } : null);
    setCurrentTime(subaction.eventTimeSeconds);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = subaction.eventTimeSeconds; }
  }

  function resetEditor() { setEditingId(null); setSelectedType(null); setCoordinate(null); }

  async function saveSubaction() {
    if (!match || !selected || !selectedType) return setNotice("Select the action to identify.");
    setSaving(true); setNotice(null);
    try {
      const eventTimeSeconds = roundTime(Math.max(selected.startTimeSeconds, Math.min(selected.endTimeSeconds, currentTime)));
      const saved = await apiFetch<SubActionRecord>(editingId ? `/api/subactions/${editingId}` : `/api/actions/${selected.id}/subactions`, { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ actionKey: selectedType.key, eventTimeSeconds, fieldX: coordinate?.x ?? null, fieldY: coordinate?.y ?? null }) });
      setMatch({ ...match, playerActions: match.playerActions.map((action) => action.id === selected.id ? { ...action, subActions: editingId ? action.subActions.map((item) => item.id === saved.id ? saved : item) : [...action.subActions, saved].sort((a, b) => a.eventTimeSeconds - b.eventTimeSeconds) } : action) });
      resetEditor(); setNotice(`${saved.actionName} ${editingId ? "updated" : "saved"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the subaction."); }
    finally { setSaving(false); }
  }

  async function removeSubaction(subaction: SubActionRecord) {
    if (!match || !selected || !confirm(`Delete ${subaction.actionName}?`)) return;
    await apiFetch(`/api/subactions/${subaction.id}`, { method: "DELETE" });
    setMatch({ ...match, playerActions: match.playerActions.map((action) => action.id === selected.id ? { ...action, subActions: action.subActions.filter((item) => item.id !== subaction.id) } : action) });
    if (editingId === subaction.id) resetEditor();
  }

  async function chooseVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    await rememberMatchVideo(matchId, file).catch(() => setNotice("The video opened, but may need to be selected again later."));
  }

  if (loading) return <Panel className="p-8 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Preparing subactions…</Panel>;
  if (!match) return <Panel className="p-6 text-red-200">{notice || "Could not open the match."}</Panel>;

  return <div className="space-y-2 sm:space-y-3">
    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => void chooseVideo(event.target.files?.[0])}/>
    <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[.045] px-3 py-2"><div><Link href={`/analysis/${matchId}`} className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><ArrowLeft size={11}/>Back to player tagging</Link><h1 className="text-lg font-bold text-white">Identify subactions</h1><p className="text-xs text-slate-500">{match.club.name} vs {match.opponentClub.name} · {match.playerActions.length} occurrences</p></div><Button size="sm" onClick={() => fileRef.current?.click()}><Upload size={14}/>{sourceUrl ? "Change video" : "Select video"}</Button></header>
    {notice ? <div className="flex items-center justify-between rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={13}/></button></div> : null}
    <Panel className="flex flex-wrap items-end justify-between gap-2 p-2"><label className="min-w-48 flex-1"><Label>Filter by player</Label><Select className="mt-1 h-8 text-xs" value={filterPlayerId} onChange={(event) => { const id = event.target.value; setFilterPlayerId(id); setSelectedId((match.playerActions.find((item) => id === "all" || item.playerId === id))?.id || null); }}><option value="all">All players ({match.playerActions.length})</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name} ({match.playerActions.filter((item) => item.playerId === player.id).length})</option>)}</Select></label><Badge>{selectedIndex >= 0 ? `${selectedIndex + 1} / ${occurrences.length}` : `0 / ${occurrences.length}`}</Badge></Panel>
    <div className="grid items-start gap-2 lg:grid-cols-[15rem_minmax(0,1fr)_21rem]">
      <Panel className="max-h-[76vh] overflow-y-auto lg:sticky lg:top-20"><div className="sticky top-0 z-10 border-b border-white/10 bg-pitch-900 px-3 py-2"><Label>Player occurrences</Label></div>{occurrences.length ? occurrences.map((action, index) => <button key={action.id} onClick={() => selectOccurrence(action)} className={`flex w-full items-center gap-2 border-b border-white/[.06] p-2 text-left transition hover:bg-white/[.06] ${selected?.id === action.id ? "bg-cyan-300/10" : ""}`}><span className="font-mono text-[9px] text-slate-600">{index + 1}</span><span className={`h-2 w-2 rounded-full ${action.subActions.length ? "bg-emerald-400" : "bg-amber-300"}`}/><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-white">{action.player.name}</span><span className="block font-mono text-[9px] text-slate-500">{formatTime(action.startTimeSeconds)}–{formatTime(action.endTimeSeconds)}</span></span><Badge className="px-1.5 py-0.5 text-[9px]">{action.subActions.length}</Badge></button>) : <p className="p-4 text-xs text-slate-500">No occurrences for this player.</p>}</Panel>
      <div className="min-w-0 space-y-2"><Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl && selected ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => { event.currentTarget.playbackRate = rate; event.currentTarget.currentTime = selected.startTimeSeconds; }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); if (event.currentTarget.currentTime >= selected.endTimeSeconds) { event.currentTarget.pause(); event.currentTarget.currentTime = selected.endTimeSeconds; } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}/> : <button className="flex h-full w-full flex-col items-center justify-center" onClick={() => fileRef.current?.click()}><FileVideo size={38} className="text-cyan-300"/><p className="mt-2 text-xs text-slate-400">{selected ? "Upload the match video in the analysis page first" : "Select a player occurrence"}</p></button>}</div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-2"><div className="flex gap-1"><Button size="icon" className="h-8 w-8" disabled={selectedIndex <= 0} onClick={() => selectOccurrence(occurrences[selectedIndex - 1])}><ChevronLeft size={15}/></Button><Button size="icon" className="h-8 w-8" variant="primary" disabled={!sourceUrl || !selected} onClick={togglePlayback}>{playing ? <Pause size={15}/> : <Play size={15}/>}</Button><Button size="icon" className="h-8 w-8" disabled={selectedIndex < 0 || selectedIndex >= occurrences.length - 1} onClick={() => selectOccurrence(occurrences[selectedIndex + 1])}><ChevronRight size={15}/></Button><div className="flex overflow-hidden rounded-md border border-white/10">{[1, 2, 4].map((value) => <button key={value} type="button" onClick={() => { setRate(value); if (videoRef.current) videoRef.current.playbackRate = value; }} className={`h-8 px-2 text-[10px] ${rate === value ? "bg-cyan-300 text-slate-950" : "bg-white/[.04] text-slate-300"}`}>{value}×</button>)}</div></div><span className="font-mono text-xs text-white">{formatTime(currentTime)}{selected ? <span className="text-slate-600"> / {formatTime(selected.endTimeSeconds)}</span> : null}</span></div></Panel>
        <Panel className="p-2"><div className="flex items-center justify-between"><div><Label>Raw occurrence location</Label><p className="text-[10px] text-slate-500">Mark it exactly as seen in the video. Maps normalize it later.</p></div><Badge>{markers.length}</Badge></div><Pitch className="mt-2" points={markers}/></Panel>
      </div>
      <Panel className="p-3 lg:sticky lg:top-20"><div className="flex items-center justify-between"><div><Label>Identify subaction</Label><p className="text-[10px] text-slate-500">{selected ? `${selected.player.name} · ${formatTime(currentTime)}` : "Select an occurrence"}</p></div><Crosshair size={16} className="text-cyan-300"/></div>{selected ? <><div className={`mt-2 rounded-md border p-2 ${selected.period === null ? "border-amber-300/20 bg-amber-300/10" : "border-white/10 bg-black/10"}`}><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">Match half</span><Badge>{matchPeriodLabel(selected.period)}</Badge></div><p className="mt-1 text-[9px] text-slate-500">Attack: {attackDirectionLabel(match.firstHalfAttacksRight, selected.period)}</p>{selected.period === null ? <p className="mt-1 text-[9px] text-amber-100">Set the start and end of this half in player tagging. The occurrence will then be assigned automatically.</p> : null}</div><div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">{groups.map((group) => <div key={group}><Label className="text-[9px]">{group}</Label><div className="mt-1 grid grid-cols-2 gap-1">{types.filter((type) => type.group === group).map((type) => <button key={type.key} type="button" onClick={() => { setSelectedType(type); setEditingId(null); setCoordinate(null); videoRef.current?.pause(); }} className={`min-h-8 rounded border px-1.5 py-1 text-left text-[9px] font-semibold ${selectedType?.key === type.key ? "text-white" : "border-white/10 bg-white/[.04] text-slate-400"}`} style={selectedType?.key === type.key ? { borderColor: type.color, backgroundColor: `${type.color}28` } : undefined}>{type.name}</button>)}</div></div>)}</div>{selectedType ? <div className="mt-3 space-y-2 border-t border-white/10 pt-3">{editingId ? <div className="flex items-center justify-between rounded bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100"><span>Editing saved subaction</span><button onClick={resetEditor}><X size={11}/></button></div> : null}<div><div className="flex items-center justify-between"><Label>Location</Label>{coordinate ? <button className="text-[9px] text-slate-500 hover:text-white" onClick={() => setCoordinate(null)}>Clear</button> : null}</div><Pitch className="mt-1" value={coordinate} onChange={setCoordinate}/></div><Button className="h-8 w-full text-xs" variant="primary" disabled={saving} onClick={() => void saveSubaction()}>{saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} {editingId ? "Update" : "Save"} {selectedType.name}</Button></div> : <p className="mt-3 rounded-md border border-dashed border-white/10 p-3 text-center text-[10px] text-slate-500">Choose an action above.</p>}<div className="mt-3 border-t border-white/10 pt-2"><div className="flex items-center justify-between"><Label>Saved subactions</Label><Badge>{selected.subActions.length}</Badge></div>{selected.subActions.length ? selected.subActions.map((item) => <div key={item.id} className="mt-1.5 flex items-center gap-1.5 rounded-md bg-white/[.035] p-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: actionTypeByKey.get(item.actionKey)?.color }}/><button className="min-w-0 flex-1 truncate text-left text-[10px] text-slate-300" onClick={() => { if (videoRef.current) { videoRef.current.currentTime = item.eventTimeSeconds; videoRef.current.pause(); } setCurrentTime(item.eventTimeSeconds); }}>{item.actionName} · {formatTime(item.eventTimeSeconds)}</button><button aria-label="Edit subaction" onClick={() => editSubaction(item)} className="p-1 text-slate-500 hover:text-cyan-300"><Pencil size={11}/></button><button aria-label="Delete subaction" onClick={() => void removeSubaction(item)} className="p-1 text-slate-600 hover:text-red-300"><Trash2 size={11}/></button></div>) : <p className="mt-2 text-[10px] text-slate-500">This occurrence is still unclassified.</p>}</div></> : <div className="mt-3 rounded-md border border-dashed border-white/10 p-4 text-center text-xs text-slate-500"><Tags className="mx-auto mb-2"/>Select an occurrence.</div>}</Panel>
    </div>
  </div>;
}
