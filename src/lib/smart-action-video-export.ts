import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
  type EncodedPacket,
  type InputAudioTrack,
  type InputVideoTrack,
} from "mediabunny";

import {
  exportActionClipCompatibility,
  safe,
  type ExportableAction,
} from "@/lib/action-video-export";
import { formatTime } from "@/lib/time";
import type { MatchDetail } from "@/lib/domain";
import { formatMatchClock, matchClockSeconds, scoreAtTime } from "@/lib/scoreboard";

export type SmartActionExportMode = "direct" | "webcodecs" | "compatibility";

export type SmartActionExportResult = {
  blob: Blob;
  fileName: string;
  mode: SmartActionExportMode;
};

const DIRECT_CUT_TOLERANCE_SECONDS = 0.04;

export class SmartActionVideoExportSession {
  private readonly input: Input;
  private readonly fallbackUrl: string;
  private readonly ownsFallbackUrl: boolean;
  private videoTrackPromise: Promise<InputVideoTrack | null> | null = null;
  private audioTrackPromise: Promise<InputAudioTrack | null> | null = null;

  constructor(source: File | string) {
    this.fallbackUrl = typeof source === "string" ? source : URL.createObjectURL(source);
    this.ownsFallbackUrl = typeof source !== "string";
    this.input = new Input({
      formats: ALL_FORMATS,
      source: typeof source === "string"
        ? new UrlSource(source, { maxCacheSize: 64 * 1024 * 1024, parallelism: 2 })
        : new BlobSource(source),
    });
  }

  async exportActionClip(
    action: ExportableAction,
    matchName: string,
    onStatus?: (status: string) => void,
    options: { includeAudio?: boolean; scoreboardMatch?: MatchDetail | null } = {},
  ): Promise<SmartActionExportResult> {
    await this.validate();

    if (options.scoreboardMatch?.scoreboardEnabled) {
      onStatus?.("Rendering the scoreboard and match clock...");
      const legacy = await exportActionClipCompatibility(this.fallbackUrl, action, matchName, onStatus, { includeAudio: options.includeAudio !== false, drawOverlay: (context, width, height, time) => drawScoreboardOverlay(context, width, height, options.scoreboardMatch!, time) });
      return { ...legacy, mode: "compatibility" };
    }

    onStatus?.("Checking whether the clip can be copied without re-encoding...");
    try {
      const direct = await this.tryDirectExport(action, matchName, onStatus, options.includeAudio !== false);
      if (direct) return direct;
    } catch (error) {
      console.info("Direct action export was not possible. Trying WebCodecs.", error);
    }

    onStatus?.("Encoding the exact action clip with WebCodecs...");
    try {
      return await this.exportWithWebCodecs(action, matchName, onStatus, options.includeAudio !== false);
    } catch (error) {
      console.info("WebCodecs action export was not possible. Trying compatibility mode.", error);
    }

    onStatus?.("Using browser compatibility mode...");
    const legacy = await exportActionClipCompatibility(this.fallbackUrl, action, matchName, onStatus, { includeAudio: options.includeAudio !== false });
    return { ...legacy, mode: "compatibility" };
  }

  dispose() {
    this.input.dispose();
    if (this.ownsFallbackUrl) URL.revokeObjectURL(this.fallbackUrl);
  }

  private async validate() {
    if (!(await this.input.canRead())) {
      throw new Error("The selected video format is not supported by the fast exporter.");
    }
    if (!(await this.getVideoTrack())) {
      throw new Error("The selected file does not contain a video track.");
    }
  }

  private getVideoTrack() {
    this.videoTrackPromise ??= this.input.getPrimaryVideoTrack();
    return this.videoTrackPromise;
  }

  private getAudioTrack() {
    this.audioTrackPromise ??= this.input.getPrimaryAudioTrack();
    return this.audioTrackPromise;
  }

  private async tryDirectExport(
    action: ExportableAction,
    matchName: string,
    onStatus?: (status: string) => void,
    includeAudio = true,
  ): Promise<SmartActionExportResult | null> {
    const videoTrack = await this.getVideoTrack();
    if (!videoTrack) return null;

    const audioTrack = includeAudio ? await this.getAudioTrack() : null;
    const format = new Mp4OutputFormat({ fastStart: "in-memory" });
    const videoCodec = await videoTrack.getCodec();
    const audioCodec = await audioTrack?.getCodec();
    if (!videoCodec || !format.getSupportedVideoCodecs().includes(videoCodec)) return null;
    if (audioTrack && (!audioCodec || !format.getSupportedAudioCodecs().includes(audioCodec))) return null;

    const start = Math.max(0, action.startTimeSeconds);
    const end = Math.max(start + 0.1, action.endTimeSeconds);
    const videoSink = new EncodedPacketSink(videoTrack);
    const startKeyPacket = await videoSink.getKeyPacket(start, { verifyKeyPackets: true });
    if (!startKeyPacket || start - startKeyPacket.timestamp > DIRECT_CUT_TOLERANCE_SECONDS) return null;

    const endKeyBefore = await videoSink.getKeyPacket(end, { verifyKeyPackets: true });
    if (!endKeyBefore) return null;
    const endKeyAfter = await videoSink.getNextKeyPacket(endKeyBefore, { verifyKeyPackets: true });
    const endKeyPacket = Math.abs(endKeyBefore.timestamp - end) <= DIRECT_CUT_TOLERANCE_SECONDS
      ? endKeyBefore
      : endKeyAfter && Math.abs(endKeyAfter.timestamp - end) <= DIRECT_CUT_TOLERANCE_SECONDS
        ? endKeyAfter
        : null;
    if (!endKeyPacket || endKeyPacket.timestamp <= startKeyPacket.timestamp) return null;

    const directStart = startKeyPacket.timestamp;
    const directEnd = endKeyPacket.timestamp;
    const target = new BufferTarget();
    const output = new Output({ format, target });
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    output.addVideoTrack(videoSource, {
      rotation: await videoTrack.getRotation(),
      languageCode: await videoTrack.getLanguageCode(),
      name: (await videoTrack.getName()) ?? undefined,
      disposition: await videoTrack.getDisposition(),
    });

    let audioSource: EncodedAudioPacketSource | null = null;
    let audioSink: EncodedPacketSink | null = null;
    if (audioTrack && audioCodec) {
      audioSource = new EncodedAudioPacketSource(audioCodec);
      audioSink = new EncodedPacketSink(audioTrack);
      output.addAudioTrack(audioSource, {
        languageCode: await audioTrack.getLanguageCode(),
        name: (await audioTrack.getName()) ?? undefined,
        disposition: await audioTrack.getDisposition(),
      });
    }

    await output.start();
    onStatus?.("Copying the original video data without quality loss...");
    try {
      const videoConfig = await videoTrack.getDecoderConfig();
      const audioConfig = await audioTrack?.getDecoderConfig();
      await Promise.all([
        copyVideoPackets({
          sink: videoSink,
          source: videoSource,
          startPacket: startKeyPacket,
          endPacket: endKeyPacket,
          start: directStart,
          metadata: videoConfig ? { decoderConfig: videoConfig } : undefined,
          onProgress: (time) => onStatus?.(`Direct cut: ${Math.min(100, Math.round(100 * time / (directEnd - directStart)))}%`),
        }),
        audioSource && audioSink
          ? copyAudioPackets({
              sink: audioSink,
              source: audioSource,
              start: directStart,
              end: directEnd,
              metadata: audioConfig ? { decoderConfig: audioConfig } : undefined,
            })
          : Promise.resolve(),
      ]);
      await output.finalize();
    } catch (error) {
      await output.cancel().catch(() => undefined);
      throw error;
    }

    if (!target.buffer?.byteLength) throw new Error("The direct cut finished without video data.");
    return {
      blob: new Blob([target.buffer], { type: "video/mp4" }),
      fileName: buildActionClipFileName(matchName, action),
      mode: "direct",
    };
  }

  private async exportWithWebCodecs(
    action: ExportableAction,
    matchName: string,
    onStatus?: (status: string) => void,
    includeAudio = true,
  ): Promise<SmartActionExportResult> {
    if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
      throw new Error("WebCodecs is not available in this browser.");
    }

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const start = Math.max(0, action.startTimeSeconds);
    const end = Math.max(start + 0.1, action.endTimeSeconds);
    const conversion = await Conversion.init({
      input: this.input,
      output,
      tracks: "primary",
      trim: { start, end },
      video: {
        codec: "avc",
        bitrate: 9_000_000,
        keyFrameInterval: 2,
        hardwareAcceleration: "no-preference",
      },
      audio: includeAudio ? { codec: "aac", bitrate: 160_000 } : { discard: true },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      const reasons = [...new Set(conversion.discardedTracks.map((item) => item.reason))].join(", ");
      throw new Error(`WebCodecs cannot export this video${reasons ? ` (${reasons})` : ""}.`);
    }

    conversion.onProgress = (progress) => {
      onStatus?.(`Exact cut with WebCodecs: ${Math.min(100, Math.round(progress * 100))}%`);
    };
    await conversion.execute();
    if (!target.buffer?.byteLength) throw new Error("WebCodecs finished without video data.");

    return {
      blob: new Blob([target.buffer], { type: "video/mp4" }),
      fileName: buildActionClipFileName(matchName, action),
      mode: "webcodecs",
    };
  }
}

type VideoPacketCopyInput = {
  sink: EncodedPacketSink;
  source: EncodedVideoPacketSource;
  startPacket: EncodedPacket;
  endPacket: EncodedPacket;
  start: number;
  metadata?: EncodedVideoChunkMetadata;
  onProgress?: (time: number) => void;
};

async function copyVideoPackets({ sink, source, startPacket, endPacket, start, metadata, onProgress }: VideoPacketCopyInput) {
  let first = true;
  try {
    for await (const packet of sink.packets(startPacket, endPacket)) {
      const shifted = packet.clone({ timestamp: Math.max(0, packet.timestamp - start) });
      await source.add(shifted, first ? metadata : undefined);
      first = false;
      onProgress?.(packet.timestamp + packet.duration - start);
    }
  } finally {
    source.close();
  }
}

type AudioPacketCopyInput = {
  sink: EncodedPacketSink;
  source: EncodedAudioPacketSource;
  start: number;
  end: number;
  metadata?: EncodedAudioChunkMetadata;
};

async function copyAudioPackets({ sink, source, start, end, metadata }: AudioPacketCopyInput) {
  const startPacket = await sink.getPacket(start);
  if (!startPacket) {
    source.close();
    return;
  }

  let first = true;
  try {
    for await (const packet of sink.packets(startPacket)) {
      if (packet.timestamp >= end) break;
      const duration = Math.max(0, Math.min(packet.duration, end - packet.timestamp));
      const shifted = packet.clone({ timestamp: Math.max(0, packet.timestamp - start), duration });
      await source.add(shifted, first ? metadata : undefined);
      first = false;
    }
  } finally {
    source.close();
  }
}

function buildActionClipFileName(matchName: string, action: ExportableAction) {
  return `${safe(matchName)}-${safe(action.player.name)}-${safe(action.actionName)}-${formatTime(action.startTimeSeconds).replace(/:/g, "-")}.mp4`;
}

function drawScoreboardOverlay(context: CanvasRenderingContext2D, width: number, height: number, match: MatchDetail, time: number) {
  const score = scoreAtTime(match.scoreEvents || [], time); const defaults = match.homeAway === "HOME" ? { home: match.club.name, away: match.opponentClub.name } : { home: match.opponentClub.name, away: match.club.name };
  const home = teamCode(match.homeClubShortName || match.homeClubName || defaults.home); const away = teamCode(match.awayClubShortName || match.awayClubName || defaults.away); const clock = formatMatchClock(matchClockSeconds(match, time));
  const scale = Math.max(.7, width / 1280); const x = width - 330 * scale; const y = 28 * scale; const h = 42 * scale;
  context.save(); context.font = `700 ${16 * scale}px sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
  context.fillStyle = "#ffffff"; context.fillRect(x, y, 70 * scale, h); context.fillStyle = "#111827"; context.fillText(clock, x + 35 * scale, y + h / 2);
  context.fillStyle = match.homeTeamColor; context.fillRect(x + 70 * scale, y, 75 * scale, h); context.fillStyle = readableText(match.homeTeamColor); context.fillText(home, x + 107.5 * scale, y + h / 2);
  context.fillStyle = "#f1f5f9"; context.fillRect(x + 145 * scale, y, 90 * scale, h); context.fillStyle = "#111827"; context.fillText(`${score.homeScore} - ${score.awayScore}`, x + 190 * scale, y + h / 2);
  context.fillStyle = match.awayTeamColor; context.fillRect(x + 235 * scale, y, 75 * scale, h); context.fillStyle = readableText(match.awayTeamColor); context.fillText(away, x + 272.5 * scale, y + h / 2);
  const drawCards = (count: number, startX: number) => { context.fillStyle = "#dc2626"; for (let index = 0; index < count; index++) context.fillRect(startX + index * 7 * scale, y - 5 * scale, 5 * scale, 15 * scale); };
  drawCards(score.homeRedCards, x + 75 * scale); drawCards(score.awayRedCards, x + 240 * scale); context.restore();
}
function teamCode(value: string) { const normalized = value.trim().toUpperCase(); if (normalized.length <= 4) return normalized; const initials = normalized.split(/\s+/).map((part) => part[0]).join(""); return (initials.length > 1 ? initials : normalized).slice(0, 4); }
function readableText(color: string) { const value = color.replace("#", ""); const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)); return r * .299 + g * .587 + b * .114 > 160 ? "#111827" : "#ffffff"; }
