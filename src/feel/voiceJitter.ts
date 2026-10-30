import { concatFloat, fadeEdges } from './pcm';

export type VoiceSink = {
  enqueue: (samples: Float32Array, sampleRate: number) => void;
  reset: () => void;
};

export const JITTER = {
  prebufferMs: 180,
  chunkMs: 200,
  starveMs: 70,
  tailMs: 160,
  maxBacklogMs: 1200,
  idleMs: 900,
} as const;

export type JitterLine = {
  push: (samples: Float32Array, sampleRate: number) => void;
  playingUntil: () => number;
  reset: () => void;
};

// Collects 100 ms network frames into ~200 ms chunks queued back to back, so a late
// packet does not leave a hole and two packets never play over each other.
export function createJitterLine(sink: VoiceSink): JitterLine {
  let pending: Float32Array[] = [];
  let pendingSamples = 0;
  let rate = 0;
  let queuedUntil = 0;
  let started = false;
  let tailTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const pendingMs = () => (rate ? (pendingSamples * 1000) / rate : 0);

  const clearTimers = () => {
    if (tailTimer) {
      clearTimeout(tailTimer);
      tailTimer = null;
    }
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const reset = () => {
    clearTimers();
    pending = [];
    pendingSamples = 0;
    queuedUntil = 0;
    started = false;
    sink.reset();
  };

  const flush = (final: boolean) => {
    if (pendingSamples === 0 || !rate) {
      return;
    }
    const now = Date.now();
    if (queuedUntil - now > JITTER.maxBacklogMs) {
      sink.reset();
      queuedUntil = now;
    }
    const fresh = queuedUntil <= now;
    const chunk = fadeEdges(concatFloat(pending), rate, fresh, final);
    pending = [];
    pendingSamples = 0;
    sink.enqueue(chunk, rate);
    queuedUntil = Math.max(now, queuedUntil) + (chunk.length * 1000) / rate;
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (pendingSamples === 0 && Date.now() >= queuedUntil) {
        started = false;
        sink.reset();
      }
    }, queuedUntil - now + JITTER.idleMs);
  };

  return {
    playingUntil: () => queuedUntil,
    reset,
    push(samples, sampleRate) {
      if (samples.length === 0) {
        return;
      }
      if (rate && sampleRate !== rate) {
        reset();
      }
      rate = sampleRate;
      if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
      }
      const now = Date.now();
      if (started && queuedUntil + 40 < now) {
        started = false;
      } else if (!started && queuedUntil - now > JITTER.starveMs) {
        started = true;
      }
      pending.push(samples);
      pendingSamples += samples.length;
      if (!started) {
        if (pendingMs() >= JITTER.prebufferMs) {
          started = true;
          flush(false);
        }
      } else if (pendingMs() >= JITTER.chunkMs || queuedUntil - now < JITTER.starveMs) {
        flush(false);
      }
      tailTimer = setTimeout(() => {
        tailTimer = null;
        flush(true);
        started = false;
      }, JITTER.tailMs);
    },
  };
}
