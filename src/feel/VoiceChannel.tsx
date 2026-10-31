import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AudioModule, useAudioStream } from 'expo-audio';
import { pauseFeelPlayback, setVoiceLive } from './index';
import { createWebMic, WebMicBuffer } from './webAudio';
import { fadeEdges, firstChannel, pcmRms, toFloat32 } from './pcm';
import { createVoiceSender, ensureVoiceCodec } from './voiceCodec';
import { remoteVoiceActive } from './voicePlay';
import { createDecimator, createHighpass, createVoiceGate, createVoiceProcessor } from './voiceProcess';
import { VOICE_SAMPLE_RATE, VoiceMode, voiceCaptureTune, voiceGateTune, voiceHighpassHz } from './voiceMode';

export type MicCaptureStatus = 'live' | 'muted' | 'denied' | 'unavailable' | 'interrupted';

type Props = {
  enabled: boolean;
  mode: VoiceMode;
  onPacket?: (frame: Uint8Array) => void;
  onSpeaking?: (on: boolean) => void;
  onStatus?: (status: MicCaptureStatus) => void;
};

// Hardware-friendly rate. Recreating the native stream at 16 kHz remounts AVAudioEngine
// and crashes iOS when a tap is already on the shared input node.
const CAPTURE_RATE = 48_000;

let captureGate: Promise<void> = Promise.resolve();

function runExclusive(task: () => Promise<void>): Promise<void> {
  const next = captureGate.then(task, task);
  captureGate = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createCaptureChain(mode: VoiceMode, inRate: number) {
  const decimator = createDecimator(inRate, VOICE_SAMPLE_RATE[mode]);
  return {
    inRate,
    outRate: decimator.outRate,
    highpass: createHighpass(voiceHighpassHz(mode), inRate),
    decimator,
    gate: createVoiceGate(voiceGateTune(mode)),
    processor: createVoiceProcessor(voiceCaptureTune(mode), decimator.outRate),
    preroll: null as Float32Array | null,
  };
}

export function VoiceChannel({ enabled, mode, onPacket, onSpeaking, onStatus }: Props) {
  const speaking = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onPacketRef = useRef(onPacket);
  onPacketRef.current = onPacket;
  const onSpeakingRef = useRef(onSpeaking);
  onSpeakingRef.current = onSpeaking;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const chain = useRef(createCaptureChain(mode, CAPTURE_RATE));
  const sender = useRef(createVoiceSender());
  const onBuffer = (buffer: WebMicBuffer) => {
    if (!enabledRef.current) {
      return;
    }
    const inRate = buffer.sampleRate || CAPTURE_RATE;
    if (chain.current.inRate !== inRate) {
      chain.current = createCaptureChain(modeRef.current, inRate);
      sender.current.reset();
    }
    const c = chain.current;
    const mono = firstChannel(toFloat32(buffer.data), buffer.channels || 1);
    const down = c.decimator.process(c.highpass.process(mono));
    const now = Date.now();
    const gate = c.gate.update(pcmRms(down), now, remoteVoiceActive(now));
    const lifted = c.processor.process(down, gate.open);
    if (gate.open !== speaking.current) {
      speaking.current = gate.open;
      onSpeakingRef.current?.(gate.open);
    }
    const emit = (bytes: Uint8Array) => {
      if (bytes.byteLength > 0) {
        onPacketRef.current?.(bytes);
      }
    };
    const send = (samples: Float32Array) => {
      void sender.current.push(samples, c.outRate, emit);
    };
    if (gate.opened && c.preroll) {
      send(fadeEdges(c.preroll, c.outRate, true, false));
    }
    if (gate.open) {
      send(lifted);
    } else if (gate.closed) {
      send(fadeEdges(lifted, c.outRate, false, true));
      void sender.current.flush(c.outRate, emit);
    }
    c.preroll = gate.open ? null : lifted;
  };
  const onBufferRef = useRef(onBuffer);
  onBufferRef.current = onBuffer;
  const { stream: nativeStream } = useAudioStream({
    channels: 1,
    encoding: 'float32',
    sampleRate: CAPTURE_RATE,
    onBuffer: (buffer) => onBufferRef.current(buffer),
  });
  const [webMic] = useState(() => (Platform.OS === 'web' ? createWebMic((buffer) => onBufferRef.current(buffer)) : null));
  const stream = webMic ?? nativeStream;
  const streamRef = useRef(stream);
  streamRef.current = stream;

  useEffect(() => {
    chain.current = createCaptureChain(mode, chain.current.inRate);
    sender.current.reset();
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    const hushSpeaking = () => {
      if (speaking.current) {
        speaking.current = false;
        onSpeakingRef.current?.(false);
      }
    };

    const stop = async () => {
      try {
        if (streamRef.current?.isStreaming) {
          await streamRef.current.stop();
        }
      } catch {
        /* native stream may not be running */
      }
      await setVoiceLive(false, modeRef.current);
      hushSpeaking();
    };

    const start = async () => {
      const permission = await AudioModule.getRecordingPermissionsAsync();
      if (!permission.granted) {
        onStatusRef.current?.('denied');
        return;
      }
      if (cancelled || !enabledRef.current) {
        return;
      }
      pauseFeelPlayback();
      await wait(250);
      if (cancelled || !enabledRef.current || !streamRef.current || streamRef.current.isStreaming) {
        if (!streamRef.current) {
          onStatusRef.current?.('unavailable');
        }
        return;
      }
      try {
        chain.current = createCaptureChain(modeRef.current, CAPTURE_RATE);
        sender.current.reset();
        await ensureVoiceCodec();
        await streamRef.current.start();
        if (cancelled || !enabledRef.current) {
          await stop();
          return;
        }
        await setVoiceLive(true, modeRef.current);
        onStatusRef.current?.('live');
      } catch {
        onStatusRef.current?.('unavailable');
        await setVoiceLive(false, modeRef.current);
      }
    };

    if (!enabled) {
      void runExclusive(async () => {
        if (cancelled) {
          return;
        }
        await stop();
        onStatusRef.current?.('muted');
      });
      return () => {
        cancelled = true;
      };
    }

    void runExclusive(start);

    const onApp = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        void runExclusive(async () => {
          await stop();
          if (!cancelled) {
            onStatusRef.current?.('interrupted');
          }
        });
        return;
      }
      if (next === 'active' && enabledRef.current) {
        void runExclusive(start);
      }
    };
    const sub = AppState.addEventListener('change', onApp);

    return () => {
      cancelled = true;
      sub.remove();
      void runExclusive(stop);
    };
  }, [enabled]);

  return null;
}
