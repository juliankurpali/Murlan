import { pcmRms } from '../src/feel/pcm';
import { createJitterLine, JITTER, VoiceSink } from '../src/feel/voiceJitter';
import { voiceCaptureTune, voiceGateTune } from '../src/feel/voiceMode';
import { createDecimator, createHighpass, createVoiceGate, createVoiceProcessor } from '../src/feel/voiceProcess';

function sine(freq: number, rate: number, length: number, level = 0.5, start = 0) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = level * Math.sin((2 * Math.PI * freq * (start + i)) / rate);
  }
  return out;
}

function frame(level: number, rate = 24_000) {
  return sine(300, rate, rate / 10, level * Math.SQRT2);
}

describe('voice capture pipeline', () => {
  it('downsamples 48 kHz to 24 kHz and keeps speech but drops ultrasonic hiss', () => {
    const down = createDecimator(48_000, 24_000);
    expect(down.factor).toBe(2);
    expect(down.outRate).toBe(24_000);
    const voice = down.process(sine(1_000, 48_000, 4800));
    expect(voice.length).toBe(2400);
    expect(pcmRms(voice.subarray(100))).toBeGreaterThan(0.33);
    const hiss = down.process(sine(20_000, 48_000, 4800, 0.5, 4800));
    expect(pcmRms(hiss.subarray(100))).toBeLessThan(0.02);
  });

  it('joins consecutive buffers without dropping samples', () => {
    const down = createDecimator(48_000, 16_000);
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      total += down.process(sine(500, 48_000, 4800, 0.4, i * 4800)).length;
    }
    expect(total).toBe(16_000);
  });

  it('removes DC offset and handling rumble', () => {
    const hp = createHighpass(80, 48_000);
    const offset = hp.process(new Float32Array(48_000).fill(0.3));
    expect(Math.abs(offset[offset.length - 1] ?? 1)).toBeLessThan(0.001);
    const speech = createHighpass(80, 48_000).process(sine(400, 48_000, 9600));
    expect(pcmRms(speech.subarray(4800))).toBeGreaterThan(0.33);
  });

  it('ignores a steady room hum but opens for someone talking', () => {
    const gate = createVoiceGate(voiceGateTune('natural'));
    let t = 0;
    for (let i = 0; i < 40; i += 1) {
      gate.update(0.006, (t += 100));
    }
    for (let i = 0; i < 30; i += 1) {
      expect(gate.update(0.006, (t += 100)).open).toBe(false);
    }
    expect(gate.update(0.03, (t += 100)).opened).toBe(true);
  });

  it('holds through short pauses between words, then closes', () => {
    const gate = createVoiceGate(voiceGateTune('natural'));
    let t = 0;
    gate.update(0.002, t);
    gate.update(0.05, (t += 100));
    expect(gate.update(0.001, (t += 100)).open).toBe(true);
    expect(gate.update(0.001, (t += 300)).open).toBe(true);
    const later = gate.update(0.001, (t += 600));
    expect(later.open).toBe(false);
    expect(later.closed).toBe(true);
  });

  it('needs a louder voice to open while another seat is playing through the speaker', () => {
    const quiet = 0.012;
    const free = createVoiceGate(voiceGateTune('clear'));
    free.update(0.001, 0);
    expect(free.update(quiet, 100).open).toBe(true);
    const echo = createVoiceGate(voiceGateTune('clear'));
    echo.update(0.001, 0, true);
    expect(echo.update(quiet, 100, true).open).toBe(false);
    expect(echo.update(0.06, 200, true).open).toBe(true);
  });

  it('freezes auto gain between words so silence is not pumped up', () => {
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 24_000);
    for (let i = 0; i < 10; i += 1) {
      processor.process(frame(0.04), true);
    }
    const held = processor.gain();
    for (let i = 0; i < 10; i += 1) {
      processor.process(frame(0.0005), false);
    }
    expect(processor.gain()).toBeCloseTo(held, 5);
  });
});

describe('voice jitter buffer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function sink() {
    const chunks: number[] = [];
    let resets = 0;
    const target: VoiceSink = {
      enqueue: (samples, rate) => chunks.push((samples.length * 1000) / rate),
      reset: () => {
        resets += 1;
      },
    };
    return { target, chunks, resets: () => resets };
  }

  it('prebuffers before playing and then queues larger chunks', () => {
    const out = sink();
    const line = createJitterLine(out.target);
    line.push(frame(0.1), 24_000);
    expect(out.chunks).toHaveLength(0);
    jest.advanceTimersByTime(100);
    line.push(frame(0.1), 24_000);
    expect(out.chunks).toEqual([200]);
    for (let i = 0; i < 4; i += 1) {
      jest.advanceTimersByTime(100);
      line.push(frame(0.1), 24_000);
    }
    expect(out.chunks.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(500);
    expect(out.chunks.every((ms) => ms >= 100)).toBe(true);
  });

  it('plays a single short word after the tail timeout', () => {
    const out = sink();
    const line = createJitterLine(out.target);
    line.push(frame(0.1), 24_000);
    jest.advanceTimersByTime(JITTER.tailMs + 1);
    expect(out.chunks).toEqual([100]);
  });

  it('keeps audio continuous when one packet arrives late', () => {
    const out = sink();
    const line = createJitterLine(out.target);
    line.push(frame(0.1), 24_000);
    jest.advanceTimersByTime(100);
    line.push(frame(0.1), 24_000);
    jest.advanceTimersByTime(150);
    line.push(frame(0.1), 24_000);
    expect(line.playingUntil()).toBeGreaterThan(Date.now());
    expect(out.chunks.reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('drops a stale backlog instead of drifting further behind', () => {
    const out = sink();
    const line = createJitterLine(out.target);
    for (let i = 0; i < 20; i += 1) {
      line.push(frame(0.1), 24_000);
    }
    expect(out.resets()).toBeGreaterThan(0);
    expect(line.playingUntil() - Date.now()).toBeLessThanOrEqual(JITTER.maxBacklogMs + 200);
  });
});
