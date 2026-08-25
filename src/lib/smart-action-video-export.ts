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
  ): Promise<SmartActionExportResult> {
    await this.validate();

    onStatus?.("Checking whether the clip can be copied without re-encoding...");
    try {
      const direct = await this.tryDirectExport(action, matchName, onStatus);
      if (direct) return direct;
    } catch (error) {
      console.info("Direct action export was not possible. Trying WebCodecs.", error);
    }

    onStatus?.("Encoding the exact action clip with WebCodecs...");
    try {
      return await this.exportWithWebCodecs(action, matchName, onStatus);
    } catch (error) {
      console.info("WebCodecs action export was not possible. Trying compatibility mode.", error);
    }

    onStatus?.("Using browser compatibility mode...");
    const legacy = await exportActionClipCompatibility(this.fallbackUrl, action, matchName, onStatus);
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
  ): Promise<SmartActionExportResult | null> {
    const videoTrack = await this.getVideoTrack();
    if (!videoTrack) return null;

    const audioTrack = await this.getAudioTrack();
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
      audio: { codec: "aac", bitrate: 160_000 },
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
