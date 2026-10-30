import {
  abandonSeat,
  actingHostId,
  completeRestore,
  createResumeToken,
  findSeatByPlayerKey,
  HEARTBEAT_TIMEOUT_MS,
  isPlayerKey,
  LiveSeat,
  missedHeartbeat,
  rememberIntent,
  RECONNECT_GRACE_MS,
  resumeTarget,
  shouldAbandon,
  unexpectedDisconnect,
} from '../src/online/lifecycle';
import { pcmLevel, pcmRms } from '../src/feel/pcm';
import { audioModeForVoice, voiceCaptureTune, voiceGateTune } from '../src/feel/voiceMode';
import { createVoiceProcessor } from '../src/feel/voiceProcess';

function seat(partial: Partial<LiveSeat> = {}): LiveSeat {
  return {
    name: 'P1',
    ready: true,
    isBot: false,
    muted: true,
    speaking: false,
    voiceAvailable: true,
    playerId: 'c1',
    playerKey: 'playerkey1',
    resumeToken: 'token-1',
    connection: 'connected',
    lastPing: 1_000,
    disconnectedAt: null,
    seenIntents: [],
    ...partial,
  };
}

describe('connection lifecycle', () => {
  it('keeps the seat, hand identity, and token after an unexpected drop', () => {
    const parked = unexpectedDisconnect(seat(), 5_000);
    expect(parked.connection).toBe('disconnected');
    expect(parked.playerKey).toBe('playerkey1');
    expect(parked.resumeToken).toBe('token-1');
    expect(parked.playerId).toBeNull();
    expect(parked.isBot).toBe(false);
  });

  it('does not abandon on a single missed heartbeat', () => {
    const live = seat({ lastPing: 0 });
    expect(missedHeartbeat(live, HEARTBEAT_TIMEOUT_MS - 1)).toBe(false);
    expect(missedHeartbeat(live, HEARTBEAT_TIMEOUT_MS)).toBe(true);
    expect(shouldAbandon(unexpectedDisconnect(live, 0), RECONNECT_GRACE_MS - 1)).toBe(false);
  });

  it('restores the original seat and rejects a duplicate or expired token', () => {
    const parked = unexpectedDisconnect(seat(), 10);
    const seats = [parked, null, null, null];
    expect(resumeTarget(seats, 'playerkey1', 'token-1').index).toBe(0);
    expect(resumeTarget(seats, 'playerkey1', 'wrong').error).toBe('session-expired');
    const restored = completeRestore(parked, 'c2', 20);
    expect(restored.connection).toBe('connected');
    expect(restored.playerId).toBe('c2');
    expect(findSeatByPlayerKey([restored, null, null, null], 'playerkey1')).toBe(0);
  });

  it('abandons after the grace period without leaving a second human seat', () => {
    const parked = unexpectedDisconnect(seat(), 0);
    expect(shouldAbandon(parked, RECONNECT_GRACE_MS)).toBe(true);
    const gone = abandonSeat(parked);
    expect(gone.isBot).toBe(true);
    expect(gone.playerKey).toBeNull();
    expect(gone.resumeToken).toBeNull();
    expect(resumeTarget([gone, null, null, null], 'playerkey1', 'token-1').error).toBe('session-expired');
  });

  it('ignores duplicate intent ids and accepts a fresh id', () => {
    const first = rememberIntent([], 'act-1');
    const again = rememberIntent(first.seen, 'act-1');
    const next = rememberIntent(again.seen, 'act-2');
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(next.duplicate).toBe(false);
    expect(rememberIntent([], undefined).duplicate).toBe(false);
  });

  it('promotes a connected human to acting host', () => {
    const seats = [
      seat({ playerId: 'host', connection: 'disconnected' }),
      seat({ playerId: 'guest', playerKey: 'playerkey2', resumeToken: 't2' }),
      null,
      null,
    ];
    expect(actingHostId(seats, 'host')).toBe('guest');
  });

  it('accepts durable player keys and issues resume tokens', () => {
    expect(isPlayerKey('playerkey1')).toBe(true);
    expect(isPlayerKey('short')).toBe(false);
    expect(createResumeToken().length).toBeGreaterThan(8);
  });
});

describe('table voice modes', () => {
  it('keeps natural mode more open to far-away voices than clear voice', () => {
    const natural = voiceGateTune('natural');
    const clear = voiceGateTune('clear');
    expect(natural.minOpen).toBeLessThan(clear.minOpen);
    expect(natural.openRatio).toBeLessThan(clear.openRatio);
    expect(natural.holdMs).toBeGreaterThan(clear.holdMs);
  });

  it('keeps table voice on the speaker and mixed, not as a phone call', () => {
    for (const mode of ['natural', 'clear'] as const) {
      const live = audioModeForVoice(mode, true);
      expect(live.interruptionMode).toBe('mixWithOthers');
      expect(live.shouldRouteThroughEarpiece).toBe(false);
      expect(live.shouldPlayInBackground).toBe(false);
      expect(live.allowsBackgroundRecording).toBe(false);
    }
  });

  it('lifts quiet table speech without clipping a loud buffer', () => {
    const quiet = new Float32Array(480).fill(0.02);
    const loud = new Float32Array(480).fill(0.85);
    const processor = createVoiceProcessor(voiceCaptureTune('natural'), 48_000);
    let lifted = processor.process(quiet);
    for (let i = 0; i < 11; i += 1) {
      lifted = processor.process(quiet);
    }
    expect(pcmRms(lifted)).toBeGreaterThan(pcmRms(quiet));
    expect(pcmLevel(processor.process(loud))).toBeLessThanOrEqual(0.98);
  });
});
