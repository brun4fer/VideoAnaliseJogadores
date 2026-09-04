"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, FileVideo, Loader2, Pause, Pencil, Play, Save, Tags, Trash2, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { actionResultColor, actionsForPlayer, actionTypeByKey, type ActionType } from "@/lib/action-types";
import type { ActionRecord, MatchDetail, SubActionRecord } from "@/lib/domain";
import { attackDirectionLabel } from "@/lib/field-normalization";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { matchPeriodLabel } from "@/lib/match-periods";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { formatTime, roundTime } from "@/lib/time";
import { Pitch, type Coordinate } from "@/components/pitch";
import { Badge, Button, Input, Label, Panel, Select } from "@/components/ui";

export function SubactionWorkspace({ matchId }: { matchId: string }) {
  const search = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const playlistActiveRef = useRef(false);
  const advancingRef = useRef(false);
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
  const [editingOccurrence, setEditingOccurrence] = useState<ActionRecord | null>(null);
  const [occurrenceSaving, setOccurrenceSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<MatchDetail>(`/api/matches/${matchId}`).then(async (data) => {
      playlistActiveRef.current = !search.get("edit");
      setMatch(data);
      const requested = search.get("action");
      setSelectedId(data.playerActions.some((item) => item.id === requested) ? requested : data.playerActions[0]?.id || null);
      if (data.video?.storageStatus === "READY") {
        const remote = await getRemoteVideoUrl(matchId).catch(() => null);
        if (remote) {
          setSourceUrl(remote.url);
          return;
        }
      }
      const file = await getRememberedMatchVideo(matchId).catch(() => null);
      if (file) setSourceUrl(URL.createObjectURL(file));
    }).catch((error) => setNotice(error.message)).finally(() => setLoading(false));
  }, [matchId, search]);

  useEffect(() => () => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const players = match?.squad.map((item) => item.player) || [];
  const occurrences = useMemo(
    () => (match?.playerActions || []).filter((item) => filterPlayerId === "all" || item.playerId === filterPlayerId),
    [filterPlayerId, match?.playerActions],
  );
  const selectedIndex = occurrences.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? occurrences[selectedIndex] : occurrences[0] || null;
  const types = selected ? actionsForPlayer(selected.player.isGoalkeeper) : [];
  const markers = (selected?.subActions || [])
    .filter((item) => item.fieldX != null && item.fieldY != null)
    .map((item) => ({
      id: item.id,
      x: item.fieldX!,
      y: item.fieldY!,
      color: actionTypeByKey.get(item.actionKey)?.color,
      label: item.actionName,
      details: [`Time: ${formatTime(item.eventTimeSeconds)}`],
    }));

  useEffect(() => {
    if (!selected) return;
    advancingRef.current = false;
    setCurrentTime(selected.eventTimeSeconds);
    setSelectedType(null);
    setCoordinate(null);
    setEditingId(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = selected.startTimeSeconds;
      if (playlistActiveRef.current) void videoRef.current.play();
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const editId = search.get("edit");
    if (!selected || !editId) return;
    playlistActiveRef.current = false;
    const subaction = selected.subActions.find((item) => item.id === editId);
    if (!subaction) return;
    setEditingId(subaction.id);
    setSelectedType(actionTypeByKey.get(subaction.actionKey) || null);
    setCoordinate(subaction.fieldX != null && subaction.fieldY != null ? { x: subaction.fieldX, y: subaction.fieldY } : null);
    setCurrentTime(subaction.eventTimeSeconds);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = subaction.eventTimeSeconds;
    }
  }, [search, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectOccurrence(action: ActionRecord) {
    playlistActiveRef.current = true;
    advancingRef.current = false;
    if (action.id === selected?.id && videoRef.current) {
      videoRef.current.currentTime = action.startTimeSeconds;
      void videoRef.current.play();
      return;
    }
    setSelectedId(action.id);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !selected) return;
    if (!video.paused) {
      playlistActiveRef.current = false;
      return video.pause();
    }
    playlistActiveRef.current = true;
    if (video.currentTime < selected.startTimeSeconds || video.currentTime >= selected.endTimeSeconds) {
      video.currentTime = selected.startTimeSeconds;
    }
    void video.play();
  }

  function editSubaction(subaction: SubActionRecord) {
    playlistActiveRef.current = false;
    setEditingId(subaction.id);
    setSelectedType(actionTypeByKey.get(subaction.actionKey) || null);
    setCoordinate(subaction.fieldX != null && subaction.fieldY != null ? { x: subaction.fieldX, y: subaction.fieldY } : null);
    setCurrentTime(subaction.eventTimeSeconds);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = subaction.eventTimeSeconds;
    }
  }

  function resetEditor(keepCoordinate = false) {
    setEditingId(null);
    setSelectedType(null);
    if (!keepCoordinate) setCoordinate(null);
  }

  async function saveSubaction() {
    if (!match || !selected || !selectedType) return setNotice("Select the action to identify.");
    setSaving(true);
    setNotice(null);
    try {
      const eventTimeSeconds = roundTime(Math.max(selected.startTimeSeconds, Math.min(selected.endTimeSeconds, currentTime)));
      const saved = await apiFetch<SubActionRecord>(editingId ? `/api/subactions/${editingId}` : `/api/actions/${selected.id}/subactions`, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          actionKey: selectedType.key,
          eventTimeSeconds,
          fieldX: coordinate?.x ?? null,
          fieldY: coordinate?.y ?? null,
        }),
      });
      setMatch({
        ...match,
        playerActions: match.playerActions.map((action) => action.id === selected.id ? {
          ...action,
          subActions: editingId
            ? action.subActions.map((item) => item.id === saved.id ? saved : item)
            : [...action.subActions, saved].sort((a, b) => a.eventTimeSeconds - b.eventTimeSeconds),
        } : action),
      });
      if (saved.fieldX != null && saved.fieldY != null) setCoordinate({ x: saved.fieldX, y: saved.fieldY });
      resetEditor(true);
      setNotice(`${saved.actionName} ${editingId ? "updated" : "saved"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the subaction.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSubaction(subaction: SubActionRecord) {
    if (!match || !selected || !confirm(`Delete ${subaction.actionName}?`)) return;
    try {
      await apiFetch(`/api/subactions/${subaction.id}`, { method: "DELETE" });
      setMatch({
        ...match,
        playerActions: match.playerActions.map((action) => action.id === selected.id
          ? { ...action, subActions: action.subActions.filter((item) => item.id !== subaction.id) }
          : action),
      });
      if (editingId === subaction.id) resetEditor();
      setNotice(`${subaction.actionName} deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete the subaction.");
    }
  }

  async function saveOccurrence(values: { playerId: string; eventTimeSeconds: number; startTimeSeconds: number; endTimeSeconds: number }) {
    if (!match || !editingOccurrence) return;
    setOccurrenceSaving(true);
    setNotice(null);
    try {
      const saved = await apiFetch<ActionRecord>(`/api/actions/${editingOccurrence.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setMatch({
        ...match,
        playerActions: match.playerActions.map((action) => action.id === saved.id ? saved : action),
      });
      if (filterPlayerId !== "all" && filterPlayerId !== saved.playerId) setFilterPlayerId(saved.playerId);
      playlistActiveRef.current = false;
      resetEditor();
      setSelectedId(saved.id);
      setCurrentTime(saved.eventTimeSeconds);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = saved.eventTimeSeconds;
      }
      setEditingOccurrence(null);
      setNotice("Player occurrence updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the player occurrence.");
    } finally {
      setOccurrenceSaving(false);
    }
  }

  async function removeOccurrence(action: ActionRecord) {
    if (!match || !confirm(`Delete ${action.player.name}'s occurrence and all its saved subactions?`)) return;
    const index = occurrences.findIndex((item) => item.id === action.id);
    const remaining = occurrences.filter((item) => item.id !== action.id);
    const next = remaining.length ? remaining[Math.min(Math.max(index, 0), remaining.length - 1)] : null;
    try {
      await apiFetch(`/api/actions/${action.id}`, { method: "DELETE" });
      playlistActiveRef.current = false;
      videoRef.current?.pause();
      setMatch({ ...match, playerActions: match.playerActions.filter((item) => item.id !== action.id) });
      setSelectedId(next?.id || null);
      setEditingOccurrence(null);
      resetEditor();
      setNotice("Player occurrence deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete the player occurrence.");
    }
  }

  async function chooseVideo(file?: File) {
    if (!file) return;
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    await rememberMatchVideo(matchId, file).catch(() => setNotice("The video opened, but may need to be selected again later."));
  }

  if (loading) {
    return <Panel className="p-8 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Preparing subactions…</Panel>;
  }
  if (!match) return <Panel className="p-6 text-red-200">{notice || "Could not open the match."}</Panel>;

  return <div className="flex min-h-0 flex-col gap-2 lg:h-[calc(100dvh-5rem)] lg:overflow-hidden">
    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => void chooseVideo(event.target.files?.[0])}/>

    {notice ? <div className="fixed bottom-4 right-4 z-[80] flex max-w-sm items-center gap-3 rounded-lg border border-cyan-300/20 bg-slate-950/95 px-3 py-2 text-xs text-cyan-100 shadow-2xl">
      <span>{notice}</span><button type="button" aria-label="Close message" onClick={() => setNotice(null)}><X size={13}/></button>
    </div> : null}

    <Panel className="flex shrink-0 flex-wrap items-center gap-2 px-2 py-1.5">
      <Link href={`/analysis/${matchId}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[.04] px-2.5 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[.08] hover:text-white">
        <ArrowLeft size={12}/>Player tagging
      </Link>
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Player</span>
        <Select className="h-8 min-w-0 flex-1 py-0 text-xs" value={filterPlayerId} onChange={(event) => {
          const id = event.target.value;
          const first = match.playerActions.find((item) => id === "all" || item.playerId === id) || null;
          playlistActiveRef.current = Boolean(first);
          setFilterPlayerId(id);
          if (first?.id === selected?.id && videoRef.current) {
            videoRef.current.currentTime = first.startTimeSeconds;
            void videoRef.current.play();
          } else {
            setSelectedId(first?.id || null);
          }
        }}>
          <option value="all">All players ({match.playerActions.length})</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.name} ({match.playerActions.filter((item) => item.playerId === player.id).length})</option>)}
        </Select>
      </label>
      <Badge>{selectedIndex >= 0 ? `${selectedIndex + 1} / ${occurrences.length}` : `0 / ${occurrences.length}`}</Badge>
      <Button size="sm" className="h-8" onClick={() => fileRef.current?.click()}><Upload size={13}/>{sourceUrl ? "Change video" : "Select video"}</Button>
    </Panel>

    <div className="grid min-h-0 flex-1 items-stretch gap-2 lg:grid-cols-[12rem_minmax(0,1fr)_20rem] xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-2.5 py-2">
          <Label>Player occurrences</Label><Badge>{occurrences.length}</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {occurrences.length ? occurrences.map((action, index) => <button key={action.id} onClick={() => selectOccurrence(action)} className={`flex w-full items-center gap-1.5 border-b border-white/[.06] px-2 py-1.5 text-left transition hover:bg-white/[.06] ${selected?.id === action.id ? "bg-cyan-300/10" : ""}`}>
            <span className="w-4 shrink-0 text-right font-mono text-[8px] text-slate-600">{index + 1}</span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: actionResultColor(action.subActions[0]?.outcome || actionTypeByKey.get(action.subActions[0]?.actionKey || "")?.outcome) }}/>
            <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-white">{action.player.name}</span><span className="block font-mono text-[8px] text-slate-500">{formatTime(action.startTimeSeconds)}–{formatTime(action.endTimeSeconds)}</span></span>
            <Badge className="px-1 py-0 text-[8px]">{action.subActions.length}</Badge>
          </button>) : <p className="p-4 text-xs text-slate-500">No occurrences for this player.</p>}
        </div>
      </Panel>

      <Panel className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 bg-black">
          {sourceUrl && selected ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = rate;
            event.currentTarget.currentTime = selected.startTimeSeconds;
            if (playlistActiveRef.current) void event.currentTarget.play();
          }} onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
            if (event.currentTarget.currentTime >= selected.endTimeSeconds && !advancingRef.current) {
              advancingRef.current = true;
              event.currentTarget.pause();
              event.currentTarget.currentTime = selected.endTimeSeconds;
              if (playlistActiveRef.current && selectedIndex >= 0 && selectedIndex < occurrences.length - 1) {
                setSelectedId(occurrences[selectedIndex + 1].id);
              } else {
                playlistActiveRef.current = false;
              }
            }
          }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}/> : <button className="flex h-full min-h-72 w-full flex-col items-center justify-center" onClick={() => fileRef.current?.click()}>
            <FileVideo size={38} className="text-cyan-300"/>
            <p className="mt-2 text-xs text-slate-400">{selected ? "Select the match video" : "Select a player occurrence"}</p>
          </button>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 p-2">
          <div className="flex gap-1">
            <Button size="icon" className="h-8 w-8" disabled={selectedIndex <= 0} onClick={() => selectOccurrence(occurrences[selectedIndex - 1])}><ChevronLeft size={15}/></Button>
            <Button size="icon" className="h-8 w-8" variant="primary" disabled={!sourceUrl || !selected} onClick={togglePlayback}>{playing ? <Pause size={15}/> : <Play size={15}/>}</Button>
            <Button size="icon" className="h-8 w-8" disabled={selectedIndex < 0 || selectedIndex >= occurrences.length - 1} onClick={() => selectOccurrence(occurrences[selectedIndex + 1])}><ChevronRight size={15}/></Button>
            <div className="flex overflow-hidden rounded-md border border-white/10">{[1, 2, 4].map((value) => <button key={value} type="button" onClick={() => {
              setRate(value);
              if (videoRef.current) videoRef.current.playbackRate = value;
            }} className={`h-8 px-2 text-[10px] ${rate === value ? "bg-cyan-300 text-slate-950" : "bg-white/[.04] text-slate-300"}`}>{value}×</button>)}</div>
          </div>
          <span className="font-mono text-xs text-white">{formatTime(currentTime)}{selected ? <span className="text-slate-600"> / {formatTime(selected.endTimeSeconds)}</span> : null}</span>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden p-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0"><Label>Identify subaction</Label><p className="truncate text-[9px] text-slate-500">{selected ? `${selected.player.name} · ${formatTime(currentTime)}` : "Select an occurrence"}</p></div>
          <div className="flex shrink-0 items-center gap-0.5">
            {selected ? <>
              <button type="button" aria-label="Edit player occurrence" title="Edit player occurrence" onClick={() => {
                playlistActiveRef.current = false;
                videoRef.current?.pause();
                setEditingOccurrence(selected);
              }} className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-cyan-300/10 hover:text-cyan-200"><Pencil size={12}/></button>
              <button type="button" aria-label="Delete player occurrence" title="Delete player occurrence" onClick={() => void removeOccurrence(selected)} className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-red-400/10 hover:text-red-200"><Trash2 size={12}/></button>
            </> : null}
            <Crosshair size={15} className="ml-1 shrink-0 text-cyan-300"/>
          </div>
        </div>

        {selected ? <>
          <div className={`mt-1 flex shrink-0 items-center justify-between gap-2 rounded border px-2 py-1 ${selected.period === null ? "border-amber-300/20 bg-amber-300/10" : "border-white/10 bg-black/10"}`}>
            <span className="truncate text-[8px] text-slate-500">Attack: {attackDirectionLabel(match.firstHalfAttacksRight, selected.period)}</span>
            <Badge className="shrink-0 px-1.5 py-0.5 text-[8px]">{matchPeriodLabel(selected.period)}</Badge>
          </div>
          {selected.period === null ? <p className="mt-1 shrink-0 text-[8px] leading-tight text-amber-100">Set the half limits in player tagging so this occurrence is assigned automatically.</p> : null}

          <div className="mt-1 flex shrink-0 items-center justify-between"><Label className="text-[9px]">Action</Label>{editingId ? <button type="button" onClick={() => resetEditor()} className="inline-flex items-center gap-1 text-[8px] text-cyan-200"><X size={9}/>Cancel edit</button> : null}</div>
          <div className="mt-1 grid shrink-0 grid-cols-2 gap-1 xl:grid-cols-3">
            {types.map((type) => <button key={type.key} type="button" title={`${type.group}: ${type.name}`} onClick={() => {
              playlistActiveRef.current = false;
              setSelectedType(type);
              setEditingId(null);
              videoRef.current?.pause();
            }} className={`h-6 truncate rounded border px-1 text-left text-[8px] font-semibold transition hover:brightness-125 ${selectedType?.key === type.key ? "text-white" : ""}`} style={{ borderColor: `${actionResultColor(type.outcome)}${selectedType?.key === type.key ? "ff" : "66"}`, backgroundColor: `${actionResultColor(type.outcome)}${selectedType?.key === type.key ? "28" : "0d"}`, color: selectedType?.key === type.key ? "#ffffff" : actionResultColor(type.outcome) }}>{type.name}</button>)}
          </div>

          <div className="mt-1 flex shrink-0 items-center justify-between"><Label className="text-[9px]">Location</Label>{coordinate ? <button type="button" className="text-[8px] text-slate-500 hover:text-white" onClick={() => setCoordinate(null)}>Clear point</button> : <span className="text-[8px] text-slate-600">Click on the field</span>}</div>
          <Pitch compact className="mt-1 shrink-0" points={markers} value={coordinate} onChange={setCoordinate} onPointSelect={(id) => {
            const item = selected.subActions.find((subaction) => subaction.id === id);
            if (item) editSubaction(item);
          }}/>

          <Button className="mt-1.5 h-8 w-full shrink-0 text-[10px]" variant="primary" disabled={!selectedType || saving} onClick={() => void saveSubaction()}>
            {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} {selectedType ? `${editingId ? "Update" : "Save"} ${selectedType.name}` : "Select an action"}
          </Button>

          <div className="mt-1.5 flex min-h-0 flex-1 flex-col border-t border-white/10 pt-1.5">
            <div className="flex shrink-0 items-center justify-between"><Label className="text-[9px]">Saved subactions</Label><Badge className="px-1.5 py-0.5 text-[8px]">{selected.subActions.length}</Badge></div>
            <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
              {selected.subActions.length ? selected.subActions.map((item) => <div key={item.id} className="mb-1 flex items-center gap-1 rounded bg-white/[.035] px-1.5 py-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: actionResultColor(item.outcome || actionTypeByKey.get(item.actionKey)?.outcome) }}/>
                <button className="min-w-0 flex-1 truncate text-left text-[9px] text-slate-300" onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = item.eventTimeSeconds;
                    videoRef.current.pause();
                  }
                  setCurrentTime(item.eventTimeSeconds);
                }}>{item.actionName} · {formatTime(item.eventTimeSeconds)}</button>
                <button type="button" aria-label={`Edit ${item.actionName}`} title="Edit subaction" onClick={() => editSubaction(item)} className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[8px] font-semibold text-slate-400 hover:bg-cyan-300/10 hover:text-cyan-200"><Pencil size={10}/>Edit</button>
                <button type="button" aria-label={`Delete ${item.actionName}`} title="Delete subaction" onClick={() => void removeSubaction(item)} className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[8px] font-semibold text-slate-500 hover:bg-red-400/10 hover:text-red-200"><Trash2 size={10}/>Delete</button>
              </div>) : <p className="py-1 text-[9px] text-slate-500">This occurrence is still unclassified.</p>}
            </div>
          </div>
        </> : <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border border-dashed border-white/10 text-center text-xs text-slate-500"><Tags className="mb-2"/>Select an occurrence.</div>}
      </Panel>
    </div>

    {editingOccurrence ? <OccurrenceEditDialog
      key={editingOccurrence.id}
      action={editingOccurrence}
      players={players}
      currentTime={currentTime}
      duration={match.video?.durationSeconds ? match.video.durationSeconds : undefined}
      saving={occurrenceSaving}
      onClose={() => setEditingOccurrence(null)}
      onSave={saveOccurrence}
    /> : null}
  </div>;
}

function OccurrenceEditDialog({ action, players, currentTime, duration, saving, onClose, onSave }: {
  action: ActionRecord;
  players: MatchDetail["squad"][number]["player"][];
  currentTime: number;
  duration?: number;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { playerId: string; eventTimeSeconds: number; startTimeSeconds: number; endTimeSeconds: number }) => Promise<void>;
}) {
  const [playerId, setPlayerId] = useState(action.playerId);
  const [eventTime, setEventTime] = useState(String(action.eventTimeSeconds));
  const [startTime, setStartTime] = useState(String(action.startTimeSeconds));
  const [endTime, setEndTime] = useState(String(action.endTimeSeconds));
  const videoTime = String(roundTime(currentTime));

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-occurrence-title">
    <Panel className="w-full max-w-lg overflow-hidden border-cyan-300/20 bg-slate-950 shadow-2xl">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
        <div>
          <Label>Edit player action</Label>
          <h2 id="edit-occurrence-title" className="mt-1 text-lg font-bold text-white">Edit player occurrence</h2>
          <p className="mt-1 text-xs text-slate-400">Correct the player and clip times. Saved subactions will be kept.</p>
        </div>
        <button type="button" aria-label="Close editor" onClick={onClose} disabled={saving} className="rounded p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={16}/></button>
      </div>

      <form className="space-y-4 p-5" onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          playerId,
          eventTimeSeconds: Number(eventTime),
          startTimeSeconds: Number(startTime),
          endTimeSeconds: Number(endTime),
        });
      }}>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Player</span>
          <Select value={playerId} onChange={(event) => setPlayerId(event.target.value)} disabled={saving}>
            {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </Select>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <OccurrenceTimeField label="Clip start" value={startTime} onChange={setStartTime} disabled={saving} duration={duration}/>
          <OccurrenceTimeField label="Action time" value={eventTime} onChange={setEventTime} disabled={saving} duration={duration}/>
          <OccurrenceTimeField label="Clip end" value={endTime} onChange={setEndTime} disabled={saving} duration={duration}/>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[.03] p-3">
          <p className="text-[10px] text-slate-400">Current video position: <span className="font-mono text-cyan-200">{formatTime(currentTime)}</span></p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => setStartTime(videoTime)}>Use as start</Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => setEventTime(videoTime)}>Use as action</Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => setEndTime(videoTime)}>Use as end</Button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">The action time must be inside the clip. The clip must also continue to include every saved subaction.</p>
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <Button type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || !playerId}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}Save changes
          </Button>
        </div>
      </form>
    </Panel>
  </div>;
}

function OccurrenceTimeField({ label, value, onChange, disabled, duration }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  duration?: number;
}) {
  return <label className="block">
    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{label}</span>
    <Input type="number" min={0} max={duration} step={0.1} required value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="font-mono"/>
  </label>;
}
