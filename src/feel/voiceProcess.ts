import { pcmPeak, pcmRms, toFloat32 } from './pcm';

export type VoiceProcessTune = {
  targetRms: number;
  noiseFloor: number;
  minGain: number;
  maxGain: number;
  agcUp: number;
  agcDown: number;
  floorDecay: number;
  compThreshold: number;
  compRatio: number;
  compKneeDb: number;
  limitCeiling: number;
};

export type VoiceProcessor = {
  process: (data: ArrayBuffer | Float32Array, voiced?: boolean) => Float32Array;
  gain: () => number;
  lastRms: () => number;
  lastPeak: () => number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function db(value: number) {
  return 20 * Math.log10(Math.max(value, 1e-8));
}

function fromDb(value: number) {
  return 10 ** (value / 20);
}

function coeff(seconds: number, sampleRate: number) {
  return 1 - Math.exp(-1 / Math.max(seconds * sampleRate, 1));
}

function compressorGain(level: number, threshold: number, ratio: number, kneeDb: number) {
  const levelDb = db(level);
  const threshDb = db(threshold);
  const over = levelDb - threshDb;
  let gainDb = 0;
  if (kneeDb > 0 && over > -kneeDb / 2 && over < kneeDb / 2) {
    const bent = over + kneeDb / 2;
    gainDb = -((1 - 1 / ratio) * bent * bent) / (2 * kneeDb);
  } else if (over >= kneeDb / 2) {
    gainDb = over * (1 / ratio - 1);
  }
  return fromDb(gainDb);
}

export function createVoiceProcessor(tune: VoiceProcessTune, sampleRate = 48_000): VoiceProcessor {
  let agc = 1;
  let rmsEnv = 0;
  let compEnv = 0;
  let limitEnv = 0;
  let lastRms = 0;
  let lastPeak = 0;
  const compAttack = coeff(0.008, sampleRate);
  const compRelease = coeff(0.12, sampleRate);
  const limitAttack = coeff(0.0008, sampleRate);
  const limitRelease = coeff(0.05, sampleRate);

  return {
    gain: () => agc,
    lastRms: () => lastRms,
    lastPeak: () => lastPeak,
    process(data, voiced = true) {
      const source = toFloat32(data);
      lastRms = pcmRms(source);
      lastPeak = pcmPeak(source);
      const dt = Math.max(source.length / sampleRate, 0.002);
      if (voiced) {
        const rmsAttack = 1 - Math.exp(-dt / 0.03);
        const rmsRelease = 1 - Math.exp(-dt / 0.18);
        rmsEnv += (lastRms - rmsEnv) * (lastRms > rmsEnv ? rmsAttack : rmsRelease);

        let desired = agc;
        if (rmsEnv >= tune.noiseFloor) {
          desired = clamp(tune.targetRms / Math.max(rmsEnv, 1e-6), tune.minGain, tune.maxGain);
        } else {
          desired = agc + (1 - agc) * tune.floorDecay;
          desired = clamp(desired, Math.min(agc, 1), Math.max(1, agc));
        }
        const tau = Math.max(desired < agc ? tune.agcDown : tune.agcUp, 0.02);
        const follow = 1 - Math.exp(-dt / tau);
        agc += (desired - agc) * follow;
      }

      const out = new Float32Array(source.length);
      for (let i = 0; i < source.length; i += 1) {
        let sample = (source[i] ?? 0) * agc;
        const abs = Math.abs(sample);
        compEnv += (abs - compEnv) * (abs > compEnv ? compAttack : compRelease);
        sample *= compressorGain(compEnv, tune.compThreshold, tune.compRatio, tune.compKneeDb);
        const shaped = Math.abs(sample);
        limitEnv += (shaped - limitEnv) * (shaped > limitEnv ? limitAttack : limitRelease);
        if (limitEnv > tune.limitCeiling) {
          sample *= tune.limitCeiling / limitEnv;
        }
        out[i] = clamp(sample, -0.97, 0.97);
      }
      return out;
    },
  };
}

export type Filter = { process: (data: Float32Array) => Float32Array };

export function createHighpass(cutoffHz: number, sampleRate: number): Filter {
  const w = (2 * Math.PI * cutoffHz) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return {
    process(data) {
      const out = new Float32Array(data.length);
      for (let i = 0; i < data.length; i += 1) {
        const x = data[i] ?? 0;
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        out[i] = y;
      }
      return out;
    },
  };
}

export type Decimator = Filter & { factor: number; outRate: number };

// Integer-factor downsampler with a windowed-sinc anti-alias filter. State carries across
// buffers so 100 ms capture blocks join without clicks.
export function createDecimator(inRate: number, targetRate: number): Decimator {
  const factor = Math.max(1, Math.round(inRate / Math.max(targetRate, 1)));
  const outRate = inRate / factor;
  if (factor === 1) {
    return { factor, outRate, process: (data) => data };
  }
  const taps = factor * 10 + 1;
  const cutoff = 0.45 / factor;
  const mid = (taps - 1) / 2;
  const kernel = new Float32Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i += 1) {
    const n = i - mid;
    const sinc = n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
    const window = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    kernel[i] = sinc * window;
    sum += kernel[i]!;
  }
  for (let i = 0; i < taps; i += 1) {
    kernel[i] = kernel[i]! / sum;
  }
  let history = new Float32Array(taps - 1);
  let phase = 0;
  return {
    factor,
    outRate,
    process(data) {
      const joined = new Float32Array(history.length + data.length);
      joined.set(history);
      joined.set(data, history.length);
      const count = Math.max(0, Math.ceil((data.length - phase) / factor));
      const out = new Float32Array(count);
      for (let k = 0; k < count; k += 1) {
        const end = history.length + phase + k * factor;
        let acc = 0;
        for (let t = 0; t < taps; t += 1) {
          acc += kernel[t]! * (joined[end - t] ?? 0);
        }
        out[k] = acc;
      }
      phase = phase + count * factor - data.length;
      history = joined.slice(joined.length - (taps - 1));
      return out;
    },
  };
}

export type VoiceGateTune = {
  openRatio: number;
  minOpen: number;
  holdMs: number;
  echoBias: number;
};

export type VoiceGate = {
  update: (rms: number, nowMs: number, echo?: boolean) => { open: boolean; opened: boolean; closed: boolean };
  floor: () => number;
  isOpen: () => boolean;
};

// Speech gate over a tracked room noise floor. Steady hum or fan noise raises the floor and
// stays out; anyone talking near the phone jumps well above it. While other seats are
// playing through the speaker, the threshold rises so their echo is not sent back.
export function createVoiceGate(tune: VoiceGateTune, windowMs = 2500): VoiceGate {
  const recent: { at: number; rms: number }[] = [];
  let seeded = false;
  let noise = tune.minOpen / tune.openRatio;
  let open = false;
  let lastHot = -Infinity;
  return {
    floor: () => noise,
    isOpen: () => open,
    update(rms, nowMs, echo = false) {
      if (!seeded) {
        seeded = true;
        recent.push({ at: nowMs, rms: noise });
      }
      recent.push({ at: nowMs, rms });
      while (recent.length > 1 && nowMs - recent[0]!.at > windowMs) {
        recent.shift();
      }
      let low = Infinity;
      for (const row of recent) {
        low = Math.min(low, row.rms);
      }
      noise = clamp(low, 0.0004, 0.06);
      const threshold = Math.max(tune.minOpen, noise * tune.openRatio) * (echo ? tune.echoBias : 1);
      const was = open;
      if (rms >= threshold || (open && rms >= threshold * 0.55)) {
        lastHot = nowMs;
        open = true;
      } else if (open && nowMs - lastHot > tune.holdMs) {
        open = false;
      }
      return { open, opened: open && !was, closed: was && !open };
    },
  };
}
