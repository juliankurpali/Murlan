import { Platform } from 'react-native';
import {
  encodeVoiceFrame,
  VOICE_CODEC_OPUS,
  VOICE_CODEC_PCM,
  VOICE_SEAT_UNSET,
  type VoiceCodec,
  type VoiceFrame,
} from '../online/voiceFrame';
import { floatToPcm16Bytes, pcm16BytesToFloat } from './pcm';
import { resampleLinear, snapVoiceRate } from './voiceProcess';

type OpusEncoderHandle = {
  frameSize: number;
  sampleRate: number;
  encodeFloat: (pcm: Float32Array) => Uint8Array;
  free: () => void;
};

type OpusDecoderHandle = {
  sampleRate: number;
  decodeFloat: (packet: Uint8Array) => Float32Array;
  free: () => void;
};

type OpusApi = {
  Application: { Voip: number };
  Signal: { Voice: number };
  createEncoder: (options: {
    sampleRate: 8000 | 12000 | 16000 | 24000 | 48000;
    channels: 1;
    application: number;
    bitrate: number;
    complexity: number;
    fec: boolean;
    signal: number;
    frameSize: number;
  }) => Promise<OpusEncoderHandle>;
  createDecoder: (options: {
    sampleRate: 8000 | 12000 | 16000 | 24000 | 48000;
    channels: 1;
  }) => Promise<OpusDecoderHandle>;
};

let opusApi: OpusApi | null = null;
let opusTried = false;
const encoders = new Map<number, OpusEncoderHandle>();
const decoders = new Map<number, OpusDecoderHandle>();

export async function ensureVoiceCodec(): Promise<VoiceCodec> {
  if (opusApi) {
    return VOICE_CODEC_OPUS;
  }
  if (opusTried || Platform.OS !== 'web') {
    return VOICE_CODEC_PCM;
  }
  opusTried = true;
  try {
    const loaded = (await import('libopus-wasm')) as unknown as OpusApi;
    const probe = await loaded.createEncoder({
      sampleRate: 24_000,
      channels: 1,
      application: loaded.Application.Voip,
      bitrate: 32_000,
      complexity: 5,
      fec: true,
      signal: loaded.Signal.Voice,
      frameSize: 480,
    });
    probe.encodeFloat(new Float32Array(probe.frameSize));
    probe.free();
    opusApi = loaded;
    return VOICE_CODEC_OPUS;
  } catch {
    opusApi = null;
    return VOICE_CODEC_PCM;
  }
}

export function preferredVoiceCodec(): VoiceCodec {
  return opusApi ? VOICE_CODEC_OPUS : VOICE_CODEC_PCM;
}

async function encoderFor(rate: number): Promise<OpusEncoderHandle | null> {
  if ((await ensureVoiceCodec()) !== VOICE_CODEC_OPUS || !opusApi) {
    return null;
  }
  const opusRate = snapVoiceRate(rate);
  const existing = encoders.get(opusRate);
  if (existing) {
    return existing;
  }
  try {
    const encoder = await opusApi.createEncoder({
      sampleRate: opusRate,
      channels: 1,
      application: opusApi.Application.Voip,
      bitrate: 32_000,
      complexity: 5,
      fec: true,
      signal: opusApi.Signal.Voice,
      frameSize: Math.round(opusRate * 0.02),
    });
    encoders.set(opusRate, encoder);
    return encoder;
  } catch {
    return null;
  }
}

async function decoderFor(rate: number): Promise<OpusDecoderHandle | null> {
  if ((await ensureVoiceCodec()) !== VOICE_CODEC_OPUS || !opusApi) {
    return null;
  }
  const opusRate = snapVoiceRate(rate);
  const existing = decoders.get(opusRate);
  if (existing) {
    return existing;
  }
  try {
    const decoder = await opusApi.createDecoder({ sampleRate: opusRate, channels: 1 });
    decoders.set(opusRate, decoder);
    return decoder;
  } catch {
    return null;
  }
}

function copyFloat(samples: Float32Array): Float32Array {
  const out = new Float32Array(samples.length);
  out.set(samples);
  return out;
}

function concatFloat(left: Float32Array, right: Float32Array): Float32Array {
  const out = new Float32Array(left.length + right.length);
  out.set(left);
  out.set(right, left.length);
  return out;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function createVoiceSender() {
  let pending: Float32Array = new Float32Array(0);
  let pendingRate = 0;
  let chain = Promise.resolve();
  let opusOk = true;

  const emitPcm = (samples: Float32Array, rate: number, emit: (bytes: Uint8Array) => void) => {
    const payload = floatToPcm16Bytes(samples);
    if (payload.byteLength === 0) {
      return;
    }
    emit(encodeVoiceFrame({ codec: VOICE_CODEC_PCM, seat: VOICE_SEAT_UNSET, rate, payload }));
  };

  const enqueue = (task: () => Promise<void>) => {
    const next = chain.then(task, task);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const encode = async (samples: Float32Array, rate: number, emit: (bytes: Uint8Array) => void) => {
    if (samples.length === 0) {
      return;
    }
    const target = snapVoiceRate(rate);
    const pcm = copyFloat(resampleLinear(samples, rate, target));
    if (pcm.length === 0) {
      return;
    }
    if (!opusOk) {
      emitPcm(pcm, target, emit);
      return;
    }
    const encoder = await encoderFor(target);
    if (!encoder) {
      pending = new Float32Array(0);
      emitPcm(pcm, target, emit);
      return;
    }
    if (pendingRate !== target) {
      pending = new Float32Array(0);
      pendingRate = target;
    }
    pending = concatFloat(pending, pcm);
    const frameSize = encoder.frameSize;
    while (pending.length >= frameSize) {
      const frame = copyFloat(pending.subarray(0, frameSize));
      pending = copyFloat(pending.subarray(frameSize));
      try {
        const payload = encoder.encodeFloat(frame);
        if (payload.byteLength > 0) {
          emit(
            encodeVoiceFrame({
              codec: VOICE_CODEC_OPUS,
              seat: VOICE_SEAT_UNSET,
              rate: target,
              payload: copyBytes(payload),
            }),
          );
        }
      } catch {
        opusOk = false;
        emitPcm(frame, target, emit);
        if (pending.length > 0) {
          emitPcm(pending, target, emit);
          pending = new Float32Array(0);
        }
        return;
      }
    }
  };

  return {
    reset() {
      pending = new Float32Array(0);
      void enqueue(async () => {
        pending = new Float32Array(0);
      });
    },
    push(samples: Float32Array, rate: number, emit: (bytes: Uint8Array) => void) {
      if (samples.length === 0) {
        return Promise.resolve();
      }
      return enqueue(() => encode(copyFloat(samples), rate, emit));
    },
    flush(rate: number, emit: (bytes: Uint8Array) => void) {
      return enqueue(async () => {
        if (pending.length === 0) {
          return;
        }
        const leftover = copyFloat(pending);
        pending = new Float32Array(0);
        const target = snapVoiceRate(rate);
        if (!opusOk || pendingRate !== target) {
          emitPcm(leftover, target, emit);
          return;
        }
        const encoder = await encoderFor(target);
        if (!encoder) {
          emitPcm(leftover, target, emit);
          return;
        }
        const padded = new Float32Array(encoder.frameSize);
        padded.set(leftover);
        try {
          const payload = encoder.encodeFloat(padded);
          if (payload.byteLength > 0) {
            emit(
              encodeVoiceFrame({
                codec: VOICE_CODEC_OPUS,
                seat: VOICE_SEAT_UNSET,
                rate: target,
                payload: copyBytes(payload),
              }),
            );
          }
        } catch {
          opusOk = false;
          emitPcm(leftover, target, emit);
        }
      });
    },
  };
}

export async function decodeVoicePayload(frame: VoiceFrame): Promise<Float32Array> {
  const payload = copyBytes(frame.payload);
  if (payload.byteLength === 0) {
    return new Float32Array(0);
  }
  if (frame.codec === VOICE_CODEC_PCM) {
    return pcm16BytesToFloat(payload);
  }
  const decoder = await decoderFor(frame.rate);
  if (!decoder) {
    return new Float32Array(0);
  }
  try {
    const decoded = decoder.decodeFloat(payload);
    return decoded instanceof Float32Array ? new Float32Array(decoded) : new Float32Array(0);
  } catch {
    return new Float32Array(0);
  }
}
