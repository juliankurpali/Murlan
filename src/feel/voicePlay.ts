import { createAudioPlayer, createAudioPlaylist, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { SeatId } from '../domain';
import type { VoiceFrame } from '../online/voiceFrame';
import { floatWavDataUri } from './pcm';
import { decodeVoicePayload } from './voiceCodec';
import { createJitterLine, JitterLine, VoiceSink } from './voiceJitter';
import { webAudioSink } from './webAudio';

type SeatLine = {
  line: JitterLine;
  sampleRate: number;
};

const lines = new Map<SeatId, SeatLine>();

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
    existing.sampleRate = sampleRate;
    return existing;
  }
  const sink = Platform.OS === 'web' ? webAudioSink() : null;
  const created: SeatLine = {
    line: createJitterLine(sink ?? playlistSink() ?? playerSink()),
    sampleRate,
  };
  lines.set(seat, created);
  return created;
}

export function setVoicePlaybackMode(_mode: string) {
  /* capture already levels the mic; playback no longer runs a second booster */
}

export function playSeatVoice(frame: VoiceFrame) {
  if (frame.seat > 3) {
    return;
  }
  void decodeVoicePayload(frame)
    .then((samples) => {
      if (samples.length === 0) {
        return;
      }
      const rate = frame.rate || 16_000;
      lineFor(frame.seat as SeatId, rate).line.push(samples, rate);
    })
    .catch(() => undefined);
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
