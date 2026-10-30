export function toFloat32(data: ArrayBuffer | Float32Array): Float32Array {
  return data instanceof Float32Array ? data : new Float32Array(data);
}

export function pcmRms(data: ArrayBuffer | Float32Array): number {
  const source = toFloat32(data);
  if (source.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < source.length; i += 1) {
    const sample = source[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / source.length);
}

export function pcmPeak(data: ArrayBuffer | Float32Array): number {
  return pcmLevel(data);
}

export function floatToBase64Pcm(data: ArrayBuffer | Float32Array): string {
  const source = data instanceof Float32Array ? data : new Float32Array(data);
  const pcm = new Int16Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    const sample = clamp(source[i] ?? 0, -1, 1);
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return bytesToBase64(new Uint8Array(pcm.buffer));
}

export function pcmLevel(data: ArrayBuffer | Float32Array): number {
  const source = toFloat32(data);
  let peak = 0;
  for (let i = 0; i < source.length; i += 1) {
    peak = Math.max(peak, Math.abs(source[i] ?? 0));
  }
  return peak;
}

export function base64PcmToFloat(base64: string): Float32Array {
  const bytes = base64ToBytes(base64);
  const aligned = new Uint8Array(bytes.byteLength);
  aligned.set(bytes);
  const samples = new Int16Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 2));
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return out;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function pcmWavDataUri(base64Pcm: string, sampleRate = 16000): string {
  const pcm = base64ToBytes(base64Pcm);
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return `data:audio/wav;base64,${bytesToBase64(wav)}`;
}

export function floatWavDataUri(samples: Float32Array, sampleRate: number): string {
  const wav = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(wav.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, Math.round(sampleRate), true);
  view.setUint32(28, Math.round(sampleRate) * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = clamp(samples[i] ?? 0, -1, 1);
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return `data:audio/wav;base64,${bytesToBase64(wav)}`;
}

export function firstChannel(data: Float32Array, channels: number): Float32Array {
  if (channels <= 1) {
    return data;
  }
  const out = new Float32Array(Math.floor(data.length / channels));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = data[i * channels] ?? 0;
  }
  return out;
}

export function concatFloat(parts: Float32Array[]): Float32Array {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function fadeEdges(samples: Float32Array, sampleRate: number, fadeIn: boolean, fadeOut: boolean) {
  const ramp = Math.min(Math.round(sampleRate * 0.006), Math.floor(samples.length / 2));
  for (let i = 0; i < ramp; i += 1) {
    const k = i / ramp;
    if (fadeIn) {
      samples[i] = (samples[i] ?? 0) * k;
    }
    if (fadeOut) {
      const j = samples.length - 1 - i;
      samples[j] = (samples[j] ?? 0) * k;
    }
  }
  return samples;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
