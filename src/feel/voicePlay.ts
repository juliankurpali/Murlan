import { createAudioPlayer, createAudioPlaylist, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { SeatId } from '../domain';
import { base64PcmToFloat, floatWavDataUri } from './pcm';
import { createJitterLine, JitterLine, VoiceSink } from './voiceJitter';
import { VoiceMode, voicePlaybackTune } from './voiceMode';
import { createVoiceProcessor, VoiceProcessor } from './voiceProcess';
import { webAudioSink } from './webAudio';

type SeatLine = {
  line: JitterLine;
  processor: VoiceProcessor;
  sampleRate: number;
};

const lines = new Map<SeatId, SeatLine>();
let playbackMode: VoiceMode = 'natural';

function makeProcessor(sampleRate: number) {
  return createVoiceProcessor(voicePlaybackTune(playbackMode), sampleRate);
}

// AVQueuePlayer-backed playlist: queued chunks play back to back without reloading a player.
function playlistSink(): VoiceSink | null {
  try {
    const list = createAudioPlaylist({ sources: [], loop: 'none', updateInterval: 1000 });
    list.volume = 1;
    return {
      enqueue(samples, sampleRate) {
        list.add({ uri: floatWavDataUri(samples, sampleRate) });
        list.play();
      },
      reset() {
        list.clear();
      },
    };
  } catch {
    return null;
  }
}

function playerSink(): VoiceSink {
  const players: [AudioPlayer, AudioPlayer] = [createAudioPlayer(null), createAudioPlayer(null)];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let next = 0;
  let endsAt = 0;
  return {
    enqueue(samples, sampleRate) {
      const now = Date.now();
      const start = Math.max(now, endsAt);
      endsAt = start + (samples.length * 1000) / sampleRate;
      const uri = floatWavDataUri(samples, sampleRate);
      const timer = setTimeout(() => {
        timers.delete(timer);
        const player = players[next]!;
        next = next === 0 ? 1 : 0;
        player.replace({ uri });
        player.play();
      }, start - now);
      timers.add(timer);
    },
    reset() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      endsAt = 0;
      players[0].pause();
      players[1].pause();
    },
  };
}

function lineFor(seat: SeatId, sampleRate: number): SeatLine {
  const existing = lines.get(seat);
  if (existing) {
    if (existing.sampleRate !== sampleRate) {
      existing.sampleRate = sampleRate;
      existing.processor = makeProcessor(sampleRate);
    }
    return existing;
  }
  const sink = Platform.OS === 'web' ? webAudioSink() : null;
  const created: SeatLine = {
    line: createJitterLine(sink ?? playlistSink() ?? playerSink()),
    processor: makeProcessor(sampleRate),
    sampleRate,
  };
  lines.set(seat, created);
  return created;
}

export function setVoicePlaybackMode(mode: VoiceMode) {
  if (mode === playbackMode) {
    return;
  }
  playbackMode = mode;
  for (const entry of lines.values()) {
    entry.processor = makeProcessor(entry.sampleRate);
  }
}

export function playSeatVoice(seat: SeatId, pcm: string, sampleRate = 16_000) {
  try {
    const rate = sampleRate || 16_000;
    const entry = lineFor(seat, rate);
    entry.line.push(entry.processor.process(base64PcmToFloat(pcm)), rate);
  } catch {
    /* ignore decode or native playback errors */
  }
}

// True while another seat's voice is coming out of the speaker (plus a short room tail),
// so the local mic can hold back that echo.
export function remoteVoiceActive(now = Date.now()): boolean {
  for (const entry of lines.values()) {
    if (entry.line.playingUntil() + 220 > now) {
      return true;
    }
  }
  return false;
}

export function stopSeatVoice(seat?: SeatId) {
  const targets = seat === undefined ? [...lines.keys()] : [seat];
  for (const id of targets) {
    try {
      lines.get(id)?.line.reset();
    } catch {
      /* ignore */
    }
  }
}
