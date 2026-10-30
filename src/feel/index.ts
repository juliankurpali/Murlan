import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { audioModeForVoice, audioModeToLeaveCallRouting, VoiceMode } from './voiceMode';
import { stopSeatVoice } from './voicePlay';

export type FeelEvent = 'select' | 'play' | 'pass' | 'deal' | 'win' | 'illegal' | 'turn';

type FeelOptions = {
  sound: boolean;
  music: boolean;
  haptics: boolean;
};

const SOURCES = {
  select: require('../../assets/audio/select.wav'),
  play: require('../../assets/audio/play.wav'),
  pass: require('../../assets/audio/pass.wav'),
  deal: require('../../assets/audio/deal.wav'),
  win: require('../../assets/audio/win.wav'),
  illegal: require('../../assets/audio/illegal.wav'),
  turn: require('../../assets/audio/turn.wav'),
} as const;

const MUSIC = require('../../assets/audio/music.wav');

let options: FeelOptions = { sound: true, music: true, haptics: true };
let ready = false;
let voiceLive = false;
let voiceMode: VoiceMode = 'natural';
const sfx = new Map<FeelEvent, AudioPlayer>();
let music: AudioPlayer | null = null;

export async function setVoiceLive(on: boolean, mode: VoiceMode = voiceMode) {
  voiceLive = on;
  voiceMode = mode;
  try {
    if (on) {
      // AudioStream.start() sets category .record + mode .measurement, which iOS
      // treats as a phone call. Bounce through playback/.default first so the
      // following playAndRecord session keeps speaker + mixWithOthers.
      await setAudioModeAsync(audioModeToLeaveCallRouting());
    }
    await setAudioModeAsync(audioModeForVoice(mode, on));
  } catch {
    /* native audio session may be unavailable */
  }
}

async function ensureReady() {
  if (ready) {
    return;
  }
  try {
    await setAudioModeAsync(audioModeForVoice(voiceMode, voiceLive));
    (Object.keys(SOURCES) as FeelEvent[]).forEach((key) => {
      const player = createAudioPlayer(SOURCES[key]);
      player.volume = 0.72;
      sfx.set(key, player);
    });
    music = createAudioPlayer(MUSIC);
    music.loop = true;
    music.volume = 0.22;
    ready = true;
  } catch {
    ready = false;
  }
}

export function configureFeel(next: Partial<FeelOptions>) {
  options = { ...options, ...next };
  if (!options.music) {
    try {
      music?.pause();
    } catch {
      /* native player may not exist yet */
    }
  } else if (ready) {
    void startTableMusic();
  }
}

export async function startTableMusic() {
  await ensureReady();
  if (!options.music || !music) {
    return;
  }
  try {
    if (music.paused) {
      music.play();
    }
  } catch {
    /* ignore */
  }
}

export function stopTableMusic() {
  try {
    music?.pause();
  } catch {
    /* ignore */
  }
}

export function pauseFeelPlayback() {
  stopTableMusic();
  stopSeatVoice();
  for (const player of sfx.values()) {
    try {
      player.pause();
    } catch {
      /* ignore */
    }
  }
}

export async function feel(event: FeelEvent) {
  await ensureReady();
  if (options.haptics) {
    try {
      if (event === 'select') {
        await Haptics.selectionAsync();
      } else if (event === 'play' || event === 'deal') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (event === 'pass') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (event === 'win') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (event === 'illegal') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (event === 'turn') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }
    } catch {
      /* device may ignore haptics */
    }
  }
  if (!options.sound) {
    return;
  }
  const player = sfx.get(event);
  if (!player) {
    return;
  }
  try {
    await player.seekTo(0);
    player.play();
  } catch {
    /* ignore */
  }
}
