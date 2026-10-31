export const VOICE_HEADER_BYTES = 10;
export const VOICE_CODEC_PCM = 1;
export const VOICE_CODEC_OPUS = 2;
export const VOICE_SEAT_UNSET = 255;
export const VOICE_MAX_PAYLOAD = 16_000;

export type VoiceCodec = typeof VOICE_CODEC_PCM | typeof VOICE_CODEC_OPUS;

export type VoiceFrame = {
  codec: VoiceCodec;
  seat: number;
  rate: number;
  payload: Uint8Array;
};

function magicOk(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x56 && bytes[2] === 0x53 && bytes[3] === 0x31;
}

export function isVoiceFrame(bytes: Uint8Array): boolean {
  return bytes.length >= VOICE_HEADER_BYTES && magicOk(bytes);
}

export function encodeVoiceFrame(frame: VoiceFrame): Uint8Array {
  const payload = frame.payload;
  if (payload.byteLength > VOICE_MAX_PAYLOAD) {
    return new Uint8Array(0);
  }
  const out = new Uint8Array(VOICE_HEADER_BYTES + payload.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x4d565331, false);
  view.setUint8(4, frame.codec);
  view.setUint8(5, frame.seat & 0xff);
  view.setUint16(6, frame.rate, true);
  view.setUint16(8, payload.byteLength, true);
  out.set(payload, VOICE_HEADER_BYTES);
  return out;
}

export function decodeVoiceFrame(bytes: Uint8Array): VoiceFrame | null {
  if (!isVoiceFrame(bytes)) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const codec = view.getUint8(4);
  if (codec !== VOICE_CODEC_PCM && codec !== VOICE_CODEC_OPUS) {
    return null;
  }
  const seat = view.getUint8(5);
  const rate = view.getUint16(6, true);
  const length = view.getUint16(8, true);
  if (rate < 8_000 || rate > 48_000 || length > VOICE_MAX_PAYLOAD) {
    return null;
  }
  if (VOICE_HEADER_BYTES + length > bytes.byteLength) {
    return null;
  }
  return {
    codec,
    seat,
    rate,
    payload: bytes.subarray(VOICE_HEADER_BYTES, VOICE_HEADER_BYTES + length),
  };
}

export function stampVoiceSeat(bytes: Uint8Array, seat: number): Uint8Array {
  if (!isVoiceFrame(bytes)) {
    return bytes;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  copy[5] = seat & 0xff;
  return copy;
}
