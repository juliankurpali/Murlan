import { VoiceGateTune } from './voiceProcess';

export type VoiceMode = 'natural' | 'clear';

export const VOICE_SAMPLE_RATE = {
  natural: 24_000,
  clear: 16_000,
} as const;

export function voiceHighpassHz(mode: VoiceMode): number {
  return mode === 'natural' ? 80 : 140;
}

export function voiceGateTune(mode: VoiceMode): VoiceGateTune {
  return mode === 'natural'
    ? { openRatio: 2.4, minOpen: 0.0035, holdMs: 650, echoBias: 2.6 }
    : { openRatio: 3.6, minOpen: 0.007, holdMs: 380, echoBias: 3.2 };
}

export function voiceCaptureTune(mode: VoiceMode) {
  return mode === 'natural'
    ? {
        targetRms: 0.12,
        noiseFloor: 0.004,
        minGain: 0.4,
        maxGain: 7,
        agcUp: 0.25,
        agcDown: 0.25,
        floorDecay: 0.03,
        compThreshold: 0.24,
        compRatio: 3.2,
        compKneeDb: 6,
        limitCeiling: 0.89,
      }
    : {
        targetRms: 0.11,
        noiseFloor: 0.008,
        minGain: 0.45,
        maxGain: 5,
        agcUp: 0.25,
        agcDown: 0.25,
        floorDecay: 0.04,
        compThreshold: 0.2,
        compRatio: 4,
        compKneeDb: 4,
        limitCeiling: 0.86,
      };
}

export function voicePlaybackTune(mode: VoiceMode) {
  const capture = voiceCaptureTune(mode);
  return {
    ...capture,
    targetRms: 0.13,
    maxGain: 2.5,
    minGain: 0.6,
    agcUp: 0.6,
    agcDown: 0.4,
    noiseFloor: 0.01,
    compRatio: 2.4,
    limitCeiling: 0.9,
  };
}

export function audioModeForVoice(_mode: VoiceMode, recording: boolean) {
  return {
    playsInSilentMode: true,
    allowsRecording: recording,
    shouldRouteThroughEarpiece: false as const,
    shouldPlayInBackground: false,
    allowsBackgroundRecording: false,
    interruptionMode: 'mixWithOthers' as const,
  };
}

export function audioModeToLeaveCallRouting() {
  return {
    playsInSilentMode: true,
    allowsRecording: false,
    shouldRouteThroughEarpiece: false as const,
    shouldPlayInBackground: false,
    allowsBackgroundRecording: false,
    interruptionMode: 'doNotMix' as const,
  };
}
