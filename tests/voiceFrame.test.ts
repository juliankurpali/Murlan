import { floatToPcm16Bytes, pcm16BytesToFloat } from '../src/feel/pcm';
import {
  decodeVoiceFrame,
  encodeVoiceFrame,
  isVoiceFrame,
  stampVoiceSeat,
  VOICE_CODEC_OPUS,
  VOICE_CODEC_PCM,
  VOICE_SEAT_UNSET,
} from '../src/online/voiceFrame';

describe('binary voice frames', () => {
  it('round-trips PCM payload and stamps the seat', () => {
    const source = new Float32Array([0, 0.5, -0.5, 0.97]);
    const packed = encodeVoiceFrame({
      codec: VOICE_CODEC_PCM,
      seat: VOICE_SEAT_UNSET,
      rate: 24_000,
      payload: floatToPcm16Bytes(source),
    });
    expect(isVoiceFrame(packed)).toBe(true);
    const unread = decodeVoiceFrame(packed);
    expect(unread?.seat).toBe(VOICE_SEAT_UNSET);
    const stamped = decodeVoiceFrame(stampVoiceSeat(packed, 2));
    expect(stamped?.codec).toBe(VOICE_CODEC_PCM);
    expect(stamped?.seat).toBe(2);
    expect(stamped?.rate).toBe(24_000);
    const back = pcm16BytesToFloat(stamped!.payload);
    expect(back.length).toBe(source.length);
    expect(back[1]).toBeCloseTo(0.5, 3);
    expect(back[2]).toBeCloseTo(-0.5, 3);
  });

  it('rejects truncated or oversized frames', () => {
    const packed = encodeVoiceFrame({
      codec: VOICE_CODEC_OPUS,
      seat: 0,
      rate: 16_000,
      payload: new Uint8Array([1, 2, 3, 4]),
    });
    expect(decodeVoiceFrame(packed.subarray(0, 8))).toBeNull();
    expect(decodeVoiceFrame(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
  });
});
