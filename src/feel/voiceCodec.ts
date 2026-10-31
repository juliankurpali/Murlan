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

const OPUS_RATES = new Set([8000, 12000, 16000, 24000, 48000]);

let opusApi: OpusApi | null = null;
let opusTried = false;
const encoders = new Map<number, OpusEncoderHandle>();
const decoders = new Map<number, OpusDecoderHandle>();

function asOpusRate(rate: number): 8000 | 12000 | 16000 | 24000 | 48000 | null {
  const rounded = Math.round(rate) as 8000 | 12000 | 16000 | 24000 | 48000;
  return OPUS_RATES.has(rounded) ? rounded : null;
}

export async function ensureVoiceCodec(): Promise<VoiceCodec> {
  if (opusApi) {
    return VOICE_CODEC_OPUS;
  }
  if (opusTried || Platform.OS !== 'web') {
    return VOICE_CODEC_PCM;
  }
  opusTried = true;
  try {
    opusApi = (await import('libopus-wasm')) as unknown as OpusApi;
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
  const opusRate = asOpusRate(rate);
  if (!opusRate) {
    return null;
  }
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
  const opusRate = asOpusRate(rate);
  if (!opusRate) {
    return null;
  }
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

function concatFloat(left: Float32Array, right: Float32Array): Float32Array {
  if (left.length === 0) {
    return right;
  }
  const out = new Float32Array(left.length + right.length);
  out.set(left);
  out.set(right, left.length);
  return out;
}

export function createVoiceSender() {
  let pending = new Float32Array(0);
  let pendingRate = 0;

  const emitPcm = (samples: Float32Array, rate: number, emit: (bytes: Uint8Array) => void) => {
    const payload = floatToPcm16Bytes(samples);
    if (payload.byteLength === 0) {
      return;
    }
    emit(encodeVoiceFrame({ codec: VOICE_CODEC_PCM, seat: VOICE_SEAT_UNSET, rate, payload }));
  };

  return {
    reset() {
      pending = new Float32Array(0);
    },
    async push(samples: Float32Array, rate: number, emit: (bytes: Uint8Array) => void) {
      if (samples.length === 0) {
        return;
      }
      const encoder = await encoderFor(rate);
      if (!encoder) {
        pending = new Float32Array(0);
        emitPcm(samples, rate, emit);
        return;
      }
      if (pendingRate !== rate) {
        pending = new Float32Array(0);
        pendingRate = rate;
      }
      pending = new Float32Array(concatFloat(pending, samples));
      const frameSize = encoder.frameSize;
      while (pending.length >= frameSize) {
        const frame = pending.subarray(0, frameSize);
        const payload = encoder.encodeFloat(frame);
        pending = pending.slice(frameSize);
        if (payload.byteLength > 0) {
          emit(encodeVoiceFrame({ codec: VOICE_CODEC_OPUS, seat: VOICE_SEAT_UNSET, rate, payload }));
        }
      }
    },
    async flush(rate: number, emit: (bytes: Uint8Array) => void) {
      if (pending.length === 0) {
        return;
      }
      const encoder = await encoderFor(rate);
      if (!encoder || pendingRate !== rate) {
        emitPcm(pending, rate, emit);
        pending = new Float32Array(0);
        return;
      }
      const padded = new Float32Array(encoder.frameSize);
      padded.set(pending);
      const payload = encoder.encodeFloat(padded);
      pending = new Float32Array(0);
      if (payload.byteLength > 0) {
        emit(encodeVoiceFrame({ codec: VOICE_CODEC_OPUS, seat: VOICE_SEAT_UNSET, rate, payload }));
      }
    },
  };
}

export async function decodeVoicePayload(frame: VoiceFrame): Promise<Float32Array> {
  if (frame.payload.byteLength === 0) {
    return new Float32Array(0);
  }
  if (frame.codec === VOICE_CODEC_PCM) {
    return pcm16BytesToFloat(frame.payload);
  }
  const decoder = await decoderFor(frame.rate);
  if (!decoder) {
    return new Float32Array(0);
  }
  try {
    return decoder.decodeFloat(frame.payload);
  } catch {
    return new Float32Array(0);
  }
}
