import { formatTime } from "@/lib/time";

export type ExportableAction = { startTimeSeconds: number; endTimeSeconds: number; actionName: string; player: { name: string } };

export async function exportActionClip(sourceFile: Blob | string, action: ExportableAction, matchName: string, onStatus?: (status: string) => void) {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser does not support video export.");
  const mimeType = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("This browser cannot create video clips. Use a recent version of Chrome or Edge.");
  const objectUrl = typeof sourceFile === "string" ? null : URL.createObjectURL(sourceFile); const url = typeof sourceFile === "string" ? sourceFile : objectUrl!; const video = document.createElement("video"); video.preload = "auto"; video.playsInline = true; if (!objectUrl) video.crossOrigin = "anonymous"; video.src = url;
  let stream: MediaStream | null = null; let frame = 0; let audioContext: AudioContext | null = null;
  try {
    await waitFor(video, "loadedmetadata"); const start = Math.max(0, Math.min(action.startTimeSeconds, video.duration)); const end = Math.max(start + .1, Math.min(action.endTimeSeconds, video.duration));
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare the video export.");
    stream = canvas.captureStream(30);
    try { audioContext = new AudioContext(); const source = audioContext.createMediaElementSource(video); const destination = audioContext.createMediaStreamDestination(); source.connect(destination); destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track)); await audioContext.resume(); } catch { video.muted = true; }
    const chunks: Blob[] = []; const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 9_000_000, audioBitsPerSecond: 160_000 });
    const result = new Promise<Blob>((resolve, reject) => { recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; recorder.onerror = () => reject(new Error("Could not record the clip.")); recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType || mimeType }); if (blob.size) resolve(blob); else reject(new Error("The exported clip is empty.")); }; });
    video.currentTime = start; await Promise.race([waitFor(video, "seeked"), wait(300)]); recorder.start(250); await video.play();
    const draw = () => { context.drawImage(video, 0, 0, canvas.width, canvas.height); onStatus?.(`Exporting ${formatTime(video.currentTime - start)} / ${formatTime(end - start)}`); if (video.ended || video.currentTime >= end) { video.pause(); recorder.stop(); return; } frame = requestAnimationFrame(draw); }; draw();
    const blob = await result; const extension = blob.type.includes("mp4") ? "mp4" : "webm"; return { blob, fileName: `${safe(matchName)}-${safe(action.player.name)}-${safe(action.actionName)}-${formatTime(start).replace(/:/g, "-")}.${extension}` };
  } finally { if (frame) cancelAnimationFrame(frame); video.pause(); video.removeAttribute("src"); video.load(); stream?.getTracks().forEach((track) => track.stop()); if (audioContext) await audioContext.close().catch(() => undefined); if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

export function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000); }
export function safe(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "clip"; }
function wait(milliseconds: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds)); }
function waitFor(element: HTMLMediaElement, name: keyof HTMLMediaElementEventMap) { if (name === "loadedmetadata" && element.readyState >= 1) return Promise.resolve(); return new Promise<void>((resolve, reject) => { const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Timed out while reading the video.")); }, 15_000); const cleanup = () => { window.clearTimeout(timeout); element.removeEventListener(name, success); element.removeEventListener("error", failure); }; const success = () => { cleanup(); resolve(); }; const failure = () => { cleanup(); reject(new Error("Could not read the selected video.")); }; element.addEventListener(name, success, { once: true }); element.addEventListener("error", failure, { once: true }); }); }
