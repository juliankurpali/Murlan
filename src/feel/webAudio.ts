import { Platform } from 'react-native';
import { CAPTURE_WORKLET_NAME, CAPTURE_WORKLET_SOURCE } from './captureWorklet';
import type { VoiceSink } from './voiceJitter';

type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

export function webAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  const Ctor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  context ??= new Ctor();
  return context;
}

// Safari keeps an AudioContext suspended until it is resumed inside a tap.
export function installWebAudioUnlock() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const unlock = () => {
    const ctx = webAudioContext();
    if (ctx && ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined);
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

export type WebMicBuffer = { data: ArrayBuffer | Float32Array; sampleRate: number; channels: number };

export type WebMic = {
  readonly isStreaming: boolean;
  start: () => Promise<void>;
  stop: () => void;
};

let workletReady: Promise<boolean> | null = null;

async function loadCaptureWorklet(ctx: AudioContext): Promise<boolean> {
  if (!ctx.audioWorklet) {
    return false;
  }
  workletReady ??= (async () => {
    const blob = new Blob([CAPTURE_WORKLET_SOURCE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await ctx.audioWorklet.addModule(url);
      return true;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  return workletReady;
}

export function createWebMic(onBuffer: (buffer: WebMicBuffer) => void): WebMic {
  let media: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let tap: AudioNode | null = null;
  let silent: GainNode | null = null;
  let streaming = false;

  const stop = () => {
    tap?.disconnect();
    source?.disconnect();
    silent?.disconnect();
    media?.getTracks().forEach((track) => track.stop());
    tap = null;
    source = null;
    silent = null;
    media = null;
    streaming = false;
  };

  return {
    get isStreaming() {
      return streaming;
    },
    stop,
    async start() {
      const ctx = webAudioContext();
      if (!ctx || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('unavailable');
      }
      media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      if (ctx.state !== 'running') {
        await ctx.resume().catch(() => undefined);
      }
      source = ctx.createMediaStreamSource(media);
      silent = ctx.createGain();
      silent.gain.value = 0;
      const workletOk = await loadCaptureWorklet(ctx);
      if (workletOk) {
        const node = new AudioWorkletNode(ctx, CAPTURE_WORKLET_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
        });
        node.port.onmessage = (event) => {
          const samples = event.data as Float32Array;
          onBuffer({ data: samples, sampleRate: ctx.sampleRate, channels: 1 });
        };
        tap = node;
      } else {
        const node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (event) => {
          const copy = new Float32Array(event.inputBuffer.getChannelData(0));
          onBuffer({ data: copy.buffer, sampleRate: ctx.sampleRate, channels: 1 });
        };
        tap = node;
      }
      source.connect(tap);
      tap.connect(silent);
      silent.connect(ctx.destination);
      streaming = true;
    },
  };
}

// Schedules chunks back to back on the audio clock, so playback is gapless and is not
// blocked by Safari's per-<audio> autoplay rules once the context has been unlocked.
export function webAudioSink(): VoiceSink | null {
  const ctx = webAudioContext();
  if (!ctx) {
    return null;
  }
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const live = new Set<AudioBufferSourceNode>();
  let at = 0;
  return {
    enqueue(samples, sampleRate) {
      try {
        const buffer = ctx.createBuffer(1, samples.length, sampleRate);
        buffer.getChannelData(0).set(samples);
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(out);
        const start = Math.max(ctx.currentTime + 0.02, at);
        node.start(start);
        at = start + buffer.duration;
        live.add(node);
        node.onended = () => live.delete(node);
      } catch {
        /* unsupported sample rate or closed context */
      }
    },
    reset() {
      for (const node of live) {
        try {
          node.stop();
        } catch {
          /* already ended */
        }
      }
      live.clear();
      at = 0;
    },
  };
}
