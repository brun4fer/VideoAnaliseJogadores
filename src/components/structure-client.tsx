"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, Check, ImagePlus, Loader2, Plus, RefreshCw, Shield, Trash2, Trophy, UserRound, UsersRound } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Button, Input, Label, Panel, Select } from "@/components/ui";
import { playerPositionLabel } from "@/lib/player-positions";
import { uploadStoredImage } from "@/lib/remote-image-store";
import type { ImageResource } from "@/lib/image-storage";
import { ManagementPasswordPanel } from "@/components/management-password-panel";
import { MediaLibraryLinkPanel } from "@/components/media-library-link-panel";
import { FootballConnectionPanel } from "@/components/football-connection-panel";
import { areaPasswordsEnabled } from "@/lib/access-areas";

type Player = { id: string; name: string; shirtNumber: number | null; photoUrl: string | null; position: string | null; isGoalkeeper: boolean };
type Club = { id: string; name: string; shortName: string | null; badgeUrl: string | null; footballSyncedAt: string | null; players?: Player[]; competitions?: Array<{ id: string; name: string }> };
type Competition = { id: string; name: string; footballSyncedAt: string | null; clubs: Club[] };
type Season = { id: string; name: string; footballSyncedAt: string | null; competitions: Competition[] };
type Data = { clientClub: Club | null; clientClubs: Club[]; seasons: Season[]; opponents: Club[] };

const positions = ["Goalkeeper", "Right-Back", "Left-Back", "Centre-Back", "Right Wing-Back", "Left Wing-Back", "Defensive Midfielder", "Central Midfielder", "Attacking Midfielder", "Right Winger", "Left Winger", "Forward", "Striker"];
const imageAccept = "image/jpeg,image/png,image/webp,image/avif,image/gif";

export function StructureClient() {
  const [data, setData] = useState<Data>({ clientClub: null, clientClubs: [], seasons: [], opponents: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Data>("/api/structure");
      setData(result);
      setSeasonId((value) => result.seasons.some((item) => item.id === value) ? value : result.seasons[0]?.id || "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The data could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const competitions = useMemo(() => data.seasons.find((season) => season.id === seasonId)?.competitions || [], [data.seasons, seasonId]);
  useEffect(() => {
    if (!competitions.some((item) => item.id === competitionId)) setCompetitionId(competitions[0]?.id || "");
  }, [competitions, competitionId]);
  const selectedCompetition = competitions.find((item) => item.id === competitionId) || null;

  async function submit(event: FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const image = formData.get("image");
    formData.delete("image");
    const body = Object.fromEntries(formData);
    try {
      const saved = await apiFetch<{ id: string }>("/api/structure", {
        method: "POST",
        body: JSON.stringify({ ...body, kind, seasonId, competitionId, isGoalkeeper: body.isGoalkeeper === "on" }),
      });
      if (image instanceof File && image.size && (kind === "clientClub" || kind === "opponent" || kind === "player")) {
        const resource: ImageResource = kind === "player" ? "players" : "clubs";
        await uploadStoredImage(resource, saved.id, image, ({ progress }) => setNotice(`Uploading image… ${Math.round(progress * 100)}%`));
      }
      if (kind !== "clientClub") formElement.reset();
      else {
        const input = formElement.elements.namedItem("image");
        if (input instanceof HTMLInputElement) input.value = "";
        formElement.dispatchEvent(new Event("reset"));
      }
      await load();
      if (kind === "clientClub") setCreatingTeam(false);
      setNotice("Saved successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The data could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceImage(resource: ImageResource, id: string, file?: File) {
    if (!file) return;
    setBusy(true);
    setNotice("Preparing image upload…");
    try {
      await uploadStoredImage(resource, id, file, ({ progress }) => setNotice(`Uploading image… ${Math.round(progress * 100)}%`));
      await load();
      setNotice("Image stored securely in Cloudflare R2.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function switchTeam(clubId: string) {
    setBusy(true); setNotice(null);
    try {
      await apiFetch("/api/structure", { method: "POST", body: JSON.stringify({ kind: "activeClientClub", clubId }) });
      setCreatingTeam(false); await load(); setNotice("Active team changed. New matches will use this team.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The active team could not be changed."); }
    finally { setBusy(false); }
  }

  async function synchronize(kind: "season" | "competition" | "team", id: string, label: string) {
    const key = `${kind}:${id}`;
    setSyncing(key); setNotice(null);
    try {
      await apiFetch("/api/football-sync", { method: "POST", body: JSON.stringify({ kind, id }) });
      await load();
      setNotice(`${label} synchronized with FootballOurPlayers.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not synchronize with FootballOurPlayers.");
    } finally {
      setSyncing(null);
    }
  }

  async function remove(resource: string, id: string, label: string) {
    if (!confirm(`Delete ${label}? Dependent data may also be deleted.`)) return;
    try {
      await apiFetch(`/api/structure/${resource}/${id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The item could not be deleted.");
    }
  }

  return <div className="space-y-5">
    <div><Label>Private setup</Label><h1 className="mt-2 text-3xl font-bold text-white">Team, competitions and opponents</h1><p className="mt-2 text-sm text-slate-400">The client team is always analysed and is the only team that can have players. Every other team is an opponent.</p></div>
    {notice ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
    {areaPasswordsEnabled ? <ManagementPasswordPanel/> : null}
    <MediaLibraryLinkPanel/>
    <FootballConnectionPanel/>
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><ClubBadge club={creatingTeam ? null : data.clientClub}/><div><Label>Analysed team</Label><h2 className="mt-1 text-xl font-bold text-white">{creatingTeam ? "Create another team" : data.clientClub?.name || "Set up the team that will be analysed"}</h2></div></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{data.clientClub && !creatingTeam ? <Button type="button" size="sm" disabled={Boolean(syncing)} onClick={() => void synchronize("team", data.clientClub!.id, data.clientClub!.name)}>{syncing === `team:${data.clientClub.id}` ? <Loader2 size={14} className="animate-spin"/> : data.clientClub.footballSyncedAt ? <Check size={14}/> : <RefreshCw size={14}/>}Sync team</Button> : null}<Select aria-label="Active analysed team" value={creatingTeam ? "" : data.clientClub?.id || ""} disabled={busy || creatingTeam || !data.clientClubs.length} onChange={(event) => void switchTeam(event.target.value)} className="min-w-52"><option value="">Select team</option>{data.clientClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</Select><Button type="button" onClick={() => setCreatingTeam((value) => !value)}>{creatingTeam ? "Cancel" : <><Plus size={14}/>New team</>}</Button></div></div>
      <form key={creatingTeam ? "new-client" : data.clientClub?.id || "first-client"} className="mt-5 grid gap-3 md:grid-cols-[1fr_.45fr_1fr_auto] md:items-start" onSubmit={(event) => void submit(event, "clientClub")}>
        {!creatingTeam && data.clientClub ? <input type="hidden" name="clubId" value={data.clientClub.id}/> : null}
        <Field label="Name"><Input name="name" defaultValue={creatingTeam ? "" : data.clientClub?.name} required placeholder="Team name"/></Field>
        <Field label="Short name"><Input name="shortName" defaultValue={creatingTeam ? "" : data.clientClub?.shortName || ""} placeholder="Abbreviation"/></Field>
        <ImageField label={!creatingTeam && data.clientClub?.badgeUrl ? "Replace badge" : "Badge"}/>
        <Button variant="primary" className="w-full md:mt-5 md:w-auto" disabled={busy}>{creatingTeam || !data.clientClub ? "Create team" : "Save team"}</Button>
      </form>
      {data.clientClub ? <p className="mt-3 text-xs text-slate-500">The active team supplies the squad for new matches. Existing matches keep their original team and players.</p> : null}
    </Panel>
    <div className="grid gap-4 xl:grid-cols-4">
      <Panel className="p-4"><Heading icon={Trophy} title="1. Season"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "season")}><Field label="Name"><Input name="name" placeholder="2026/27" required/></Field><Button variant="primary" className="w-full" disabled={busy}><Plus size={15}/>Add season</Button></form><div className="mt-5 space-y-2">{data.seasons.map((season) => <Row key={season.id} active={season.id === seasonId} label={season.name} syncedAt={season.footballSyncedAt} syncing={syncing === `season:${season.id}`} syncDisabled={Boolean(syncing)} onSync={() => void synchronize("season", season.id, season.name)} onClick={() => setSeasonId(season.id)} onDelete={() => void remove("season", season.id, season.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={Shield} title="2. Competition"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "competition")}><Field label="Name"><Input name="name" placeholder="League" required/></Field><Button variant="primary" className="w-full" disabled={busy || !seasonId}><Plus size={15}/>Add competition</Button></form><div className="mt-5 space-y-2">{competitions.map((competition) => <Row key={competition.id} active={competition.id === competitionId} label={competition.name} syncedAt={competition.footballSyncedAt} syncing={syncing === `competition:${competition.id}`} syncDisabled={Boolean(syncing)} onSync={() => void synchronize("competition", competition.id, competition.name)} onClick={() => setCompetitionId(competition.id)} onDelete={() => void remove("competition", competition.id, competition.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={Building2} title="3. Opponent"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "opponent")}><Field label="Name"><Input name="name" placeholder="Opponent team" required/></Field><Field label="Short name"><Input name="shortName" placeholder="Abbreviation"/></Field><ImageField label="Badge"/><Button variant="primary" className="w-full" disabled={busy || !competitionId}><Plus size={15}/>Add to competition</Button></form><div className="mt-5 space-y-2">{selectedCompetition?.clubs.map((club) => <Row key={club.id} label={club.name} active={false} imageUrl={club.badgeUrl} onImage={(file) => void replaceImage("clubs", club.id, file)} onDelete={() => void remove("opponent", club.id, club.name)}/>)}</div></Panel>
      <Panel className="p-4"><Heading icon={UsersRound} title="4. Player"/><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event, "player")}><Field label="Name"><Input name="name" placeholder="Full name" required/></Field><div className="grid grid-cols-2 gap-2"><Field label="Number"><Input name="shirtNumber" type="number" min="1" max="99"/></Field><Field label="Position"><Select name="position"><option value="">Select</option>{positions.map((position) => <option key={position}>{position}</option>)}</Select></Field></div><ImageField label="Photo"/><label className="flex items-center gap-2 text-sm text-slate-300"><input name="isGoalkeeper" type="checkbox" className="accent-cyan-300"/> Goalkeeper</label><Button variant="primary" className="w-full" disabled={busy || !data.clientClub}><Plus size={15}/>Add player</Button></form></Panel>
    </div>
    <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Active team squad</Label><h2 className="mt-1 text-xl font-bold text-white">{data.clientClub?.name || "Set up the team first"}</h2></div><UserRound className="text-cyan-300"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{data.clientClub?.players?.map((player) => <div key={player.id} className="flex min-h-20 items-center gap-3 rounded-lg border border-white/10 bg-black/15 p-2.5"><PlayerPhoto player={player}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{player.shirtNumber ? `${player.shirtNumber} · ` : ""}{player.name}</p><p className="truncate text-xs text-slate-500">{playerPositionLabel(player.position)}</p></div><ImageUploadButton label={`Replace photo for ${player.name}`} disabled={busy} onSelect={(file) => void replaceImage("players", player.id, file)}/><button type="button" aria-label="Delete player" onClick={() => void remove("player", player.id, player.name)} className="text-slate-600 hover:text-red-300"><Trash2 size={14}/></button></div>)}</div></Panel>
  </div>;
}

function Heading({ icon: Icon, title }: { icon: typeof Trophy; title: string }) { return <div className="flex items-center gap-2"><Icon size={17} className="text-cyan-300"/><h2 className="font-bold text-white">{title}</h2></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function ImageField({ label }: { label: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const form = inputRef.current?.form;
    const clear = () => setFileName("");
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  return <div className="min-w-0">
    <Label htmlFor={id}>{label}</Label>
    <div className="mt-1 flex h-10 min-w-0 overflow-hidden rounded-md border border-white/10 bg-black/20 transition focus-within:border-cyan-300/60 focus-within:ring-2 focus-within:ring-cyan-300/10">
      <input ref={inputRef} id={id} name="image" type="file" accept={imageAccept} className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}/>
      <label htmlFor={id} className="inline-flex shrink-0 cursor-pointer items-center gap-2 border-r border-white/10 bg-white/[.07] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[.12] hover:text-white"><ImagePlus size={14}/>Choose image</label>
      <span className={`min-w-0 flex-1 truncate px-3 py-2.5 text-xs ${fileName ? "text-slate-200" : "text-slate-500"}`} title={fileName || "No image selected"}>{fileName || "No image selected"}</span>
    </div>
    <p className="mt-1 text-[10px] text-slate-500">JPG, PNG, WebP, AVIF or GIF · max. 10 MB</p>
  </div>;
}

function ImageUploadButton({ label, disabled, onSelect }: { label: string; disabled?: boolean; onSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return <>
    <input ref={inputRef} type="file" accept={imageAccept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelect(file); event.currentTarget.value = ""; }}/>
    <button type="button" disabled={disabled} aria-label={label} title={label} onClick={() => inputRef.current?.click()} className="p-1 text-slate-500 hover:text-cyan-200 disabled:opacity-40"><ImagePlus size={14}/></button>
  </>;
}

function Row({ label, active, imageUrl, syncedAt, syncing, syncDisabled, onClick, onImage, onSync, onDelete }: { label: string; active: boolean; imageUrl?: string | null; syncedAt?: string | null; syncing?: boolean; syncDisabled?: boolean; onClick?: () => void; onImage?: (file: File) => void; onSync?: () => void; onDelete: () => void }) {
  return <div className={`flex items-center rounded-md border ${active ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-black/10"}`}>
    {imageUrl ? <span className="ml-2 h-6 w-6 shrink-0 rounded bg-white/10 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${imageUrl})` }}/> : null}
    <button type="button" onClick={onClick} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-white">{label}</button>
    {onSync ? <button type="button" disabled={syncDisabled} aria-label={`Synchronize ${label}`} title={syncedAt ? `Synchronized ${new Date(syncedAt).toLocaleString()}. Click to synchronize again.` : `Synchronize ${label} with FootballOurPlayers`} onClick={onSync} className={`mr-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition disabled:opacity-40 ${syncedAt ? "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15" : "bg-cyan-300/10 text-cyan-300 hover:bg-cyan-300/15"}`}>{syncing ? <Loader2 size={12} className="animate-spin"/> : syncedAt ? <Check size={12}/> : <RefreshCw size={12}/>}<span>{syncedAt ? "Synced" : "Sync"}</span></button> : null}
    {onImage ? <ImageUploadButton label={`Replace image for ${label}`} onSelect={onImage}/> : null}
    <button type="button" aria-label={`Delete ${label}`} onClick={onDelete} className="p-2 text-slate-600 hover:text-red-300"><Trash2 size={13}/></button>
  </div>;
}

function ClubBadge({ club }: { club: Club | null }) { return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 bg-contain bg-center bg-no-repeat text-cyan-200" style={club?.badgeUrl ? { backgroundImage: `url(${club.badgeUrl})` } : undefined}>{!club?.badgeUrl ? <Shield/> : null}</span>; }
function PlayerPhoto({ player }: { player: Player }) { return <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cyan-300/10 bg-cover bg-center text-cyan-200" style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}>{!player.photoUrl ? <UserRound size={24}/> : null}</span>; }
