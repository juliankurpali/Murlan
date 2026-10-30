import { base64PcmToFloat, floatToBase64Pcm, pcmLevel, pcmPeak, pcmRms } from '../src/feel/pcm';
import { voiceCaptureTune, voicePlaybackTune } from '../src/feel/voiceMode';
import { createVoiceProcessor } from '../src/feel/voiceProcess';

function tone(level: number, length = 480) {
  return new Float32Array(length).fill(level);
}

function run(processor: ReturnType<typeof createVoiceProcessor>, level: number, frames: number) {
  let out = processor.process(tone(level));
  for (let i = 1; i < frames; i += 1) {
    out = processor.process(tone(level));
  }
  return out;
}

describe('table voice processing', () => {
  it('measures RMS and peak independently', () => {
    const samples = new Float32Array([0.1, -0.5, 0.2]);
    expect(pcmPeak(samples)).toBeCloseTo(0.5);
    expect(pcmRms(samples)).toBeGreaterThan(0.2);
    expect(pcmRms(samples)).toBeLessThan(0.5);
  });

  it('normalizes quiet speech toward the table target without a sudden jump', () => {
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    const first = processor.process(tone(0.02));
    const later = run(processor, 0.02, 24);
    expect(pcmRms(first) / 0.02).toBeLessThan(2.2);
    expect(pcmRms(later)).toBeGreaterThan(pcmRms(first));
    expect(pcmRms(later)).toBeGreaterThan(0.05);
    expect(processor.gain()).toBeLessThanOrEqual(voiceCaptureTune('natural').maxGain);
  });

  it('does not endlessly amplify room noise below the floor', () => {
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    const hiss = run(processor, 0.002, 40);
    expect(processor.gain()).toBeLessThan(1.35);
    expect(pcmRms(hiss) / 0.002).toBeLessThan(1.8);
  });

  it('compresses and limits a shout so playback does not clip', () => {
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    const out = run(processor, 0.92, 8);
    expect(pcmLevel(out)).toBeLessThanOrEqual(0.98);
    expect(pcmRms(out)).toBeLessThan(0.55);
    expect(processor.gain()).toBeLessThan(1);
  });

  it('keeps a separate envelope for each microphone', () => {
    const close = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    const far = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    run(close, 0.7, 10);
    run(far, 0.025, 10);
    expect(far.gain()).toBeGreaterThan(close.gain());
  });

  it('applies a gentler playback pass so a quiet seat can catch up', () => {
    const capture = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    const playback = createVoiceProcessor(voicePlaybackTune('natural'), 48_000);
    const sent = run(capture, 0.03, 8);
    const heard = run(playback, pcmRms(sent), 8);
    expect(pcmRms(heard)).toBeGreaterThan(pcmRms(sent) * 0.9);
    expect(pcmLevel(heard)).toBeLessThanOrEqual(0.98);
  });

  it('does not slam gain back to 1 on a 100 ms capture buffer', () => {
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    run(processor, 0.03, 20);
    const held = processor.gain();
    processor.process(tone(0.002, 4800));
    expect(held).toBeGreaterThan(2);
    expect(processor.gain()).toBeGreaterThan(held * 0.55);
  });

  it('round-trips PCM used on the socket without changing sample count', () => {
    const source = tone(0.2, 64);
    const decoded = base64PcmToFloat(floatToBase64Pcm(source));
    expect(decoded.length).toBe(64);
    expect(pcmRms(decoded)).toBeGreaterThan(0.15);
  });
});
