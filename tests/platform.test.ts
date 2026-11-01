import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashIdentity, sameSecret } from '../src/platform/identity';
import { applyUserIntent, forceEndGame, parkPlayer, payloadFor, restorePlayer, startMatch } from '../src/platform/match';
import { isGeneratedUsername, isUsername, suggestUsername } from '../src/platform/ids';
import { PlatformStore } from '../src/platform/store';

function tempStore(): PlatformStore {
  return new PlatformStore(join(mkdtempSync(join(tmpdir(), 'murlan-')), 'platform.json'));
}

describe('platform identity and matches', () => {
  it('reuses a guest for the same identity secret and ignores stolen hashes', () => {
    const store = tempStore();
    const secret = 'device-key-1234';
    const first = store.guest(secret);
    const again = store.guest(secret);
    expect(again.player.id).toBe(first.player.id);
    expect(isUsername(first.player.username)).toBe(true);
    expect(store.auth(first.token)?.id).toBe(first.player.id);

    const stored = [...store.players.values()].find((player) => player.id === first.player.id);
    expect(stored?.identityHash).toBe(hashIdentity(secret));
    expect(stored?.identityHash).not.toBe(secret);

    const stolenIdentity = store.guest(stored!.identityHash);
    expect(stolenIdentity.player.id).not.toBe(first.player.id);

    const sessionHash = [...store.sessions.keys()][0];
    expect(store.auth(sessionHash)).toBeNull();
    expect(sameSecret('admin-token-secret', 'admin-token-secret')).toBe(true);
    expect(sameSecret('admin-token-secret', 'other-token-secret')).toBe(false);
  });

  it('sends and accepts a friend request', () => {
    const store = tempStore();
    const a = store.guest('aaaaaaaa');
    const b = store.guest('bbbbbbbb');
    const from = store.auth(a.token)!;
    const guest = store.auth(b.token)!;
    const game = store.createGame(from);
    store.joinGame(guest, game.code);
    store.requestFriend(from, guest.username);
    const pending = store.pendingFor(guest.id);
    expect(pending).toHaveLength(1);
    expect(store.inbox(guest.id).some((row) => row.kind === 'friend-request' && row.fromId === from.id)).toBe(true);
    store.respondFriend(guest, pending[0]!.id, true);
    expect(store.friendsOf(from.id).map((row) => row.id)).toContain(guest.id);
  });

  it('does not let you add a friend unless you share a table', () => {
    const store = tempStore();
    const from = store.auth(store.guest('aaaaaaaa').token)!;
    const other = store.auth(store.guest('bbbbbbbb').token)!;
    expect(() => store.requestFriend(from, other.username)).toThrow('not-same-room');
  });

  it('keeps a match alive after the creator disconnects and hides opponent cards', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hosthost').token)!;
    const guest = store.auth(store.guest('guestgst').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    const view = payloadFor(game, host.id);
    expect(view).toBeTruthy();
    expect(view!.view.ownHand.length).toBeGreaterThan(0);
    expect(view!.view.cardCounts.reduce((sum, count) => sum + count, 0)).toBe(54);
    const otherHand = game.match!.hands[(view!.seat + 1) % 4];
    expect(JSON.stringify(view!.view)).not.toContain(otherHand[0]!.id);
    game.seats[0]!.connection = 'disconnected';
    expect(game.status).toBe('playing');
    restorePlayer(game, host.id);
    expect(game.seats[0]!.connection).toBe('connected');
    expect(game.seats[0]!.userId).toBe(host.id);
  });

  it('rejects a play from a player who is not seated', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hosthost2').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    expect(() => applyUserIntent(game, 'missing', { kind: 'pass' })).toThrow('not-in-room');
  });

  it('suggests a stable username seed', () => {
    expect(suggestUsername('abc')).toBe(suggestUsername('abc'));
    expect(isGeneratedUsername(suggestUsername('abc'))).toBe(true);
    expect(isGeneratedUsername('SwiftEagle42')).toBe(true);
    expect(isGeneratedUsername('Julian')).toBe(false);
    expect(isGeneratedUsername('Player')).toBe(true);
  });

  it('lets any seated player pick an empty or bot seat in the lobby', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostseat1').token)!;
    const guest = store.auth(store.guest('guestseat').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code, { team: 0 });
    expect(game.seats[2]?.userId).toBe(guest.id);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    expect(game.seats.filter((seat) => seat.isBot).map((seat) => seat.botName)).toEqual([
      'Leka (AI)',
      'Drita (AI)',
    ]);
    store.claimSeat(host, game, 1);
    expect(game.seats[1]?.userId).toBe(host.id);
    expect(game.seats[0]?.isBot).toBe(true);
    store.claimSeat(guest, game, 3);
    expect(game.seats[3]?.userId).toBe(guest.id);
    expect(game.seats[2]?.isBot).toBe(true);
  });

  it('asks a seated player to switch when their seat is taken', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostswap1').token)!;
    const guest = store.auth(store.guest('guestswap1').token)!;
    const extra = store.auth(store.guest('extraswap1').token)!;
    const late = store.auth(store.guest('lateswap1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.joinGame(extra, game.code);
    store.joinGame(late, game.code);
    expect(game.seats.every((seat) => seat.userId && !seat.isBot)).toBe(true);
    const asked = store.claimSeat(late, game, 0);
    expect(asked.pending).toBe(true);
    expect(game.seats[0]?.userId).toBe(host.id);
    expect(game.seats[3]?.userId).toBe(late.id);
    expect(store.inbox(host.id).some((item) => item.kind === 'seat-switch')).toBe(true);
    store.respondSeatSwitch(host, game, late.id, true);
    expect(game.seats[0]?.userId).toBe(late.id);
    expect(game.seats[3]?.userId).toBe(host.id);
  });

  it('keeps seats when a switch is declined', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostdeny1').token)!;
    const guest = store.auth(store.guest('guestdeny1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.claimSeat(guest, game, 0);
    expect(game.seats[0]?.userId).toBe(host.id);
    store.respondSeatSwitch(host, game, guest.id, false);
    expect(game.seats[0]?.userId).toBe(host.id);
    expect(game.seats[1]?.userId).toBe(guest.id);
    expect(store.inbox(guest.id).some((item) => item.kind === 'seat-switch-denied')).toBe(true);
  });

  it('swaps immediately when both players ask each other', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostboth1').token)!;
    const guest = store.auth(store.guest('guestboth1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.claimSeat(guest, game, 0);
    const result = store.claimSeat(host, game, 1);
    expect(result.pending).toBe(false);
    expect(game.seats[0]?.userId).toBe(guest.id);
    expect(game.seats[1]?.userId).toBe(host.id);
  });

  it('sits an invited friend on the requested team', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostinvt1').token)!;
    const friend = store.auth(store.guest('friendnv1').token)!;
    const game = store.createGame(host);
    store.invite(host, game, friend.username, 0);
    store.joinGame(friend, game.code);
    expect(game.seats[2]?.userId).toBe(friend.id);
  });

  it('waits for every human before dealing the next hand', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostnext1').token)!;
    const guest = store.auth(store.guest('guestnxt1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = { ...game.match!, phase: 'handComplete', finishOrder: [0, 1, 2, 3] };
    const before = game.match.handIndex;
    applyUserIntent(game, host.id, { kind: 'nextHand' });
    expect(game.match.phase).toBe('handComplete');
    expect(game.match.handIndex).toBe(before);
    expect(game.nextHandReady).toContain(0);
    applyUserIntent(game, guest.id, { kind: 'nextHand' });
    expect(game.match.handIndex).toBe(before + 1);
    expect(game.nextHandReady).toEqual([]);
  });

  it('deals the next hand as soon as the only human is ready', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostsolo1').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = { ...game.match!, phase: 'handComplete', finishOrder: [0, 1, 2, 3] };
    const before = game.match.handIndex;
    applyUserIntent(game, host.id, { kind: 'nextHand' });
    expect(game.match.handIndex).toBe(before + 1);
  });

  it('waits for every human before starting a rematch', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostagain1').token)!;
    const guest = store.auth(store.guest('guestagn1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = { ...game.match!, phase: 'matchComplete', winner: 'team0' };
    applyUserIntent(game, host.id, { kind: 'playAgain' });
    expect(game.match.phase).toBe('matchComplete');
    expect(game.playAgainReady).toContain(0);
    expect(game.series.matches).toBe(1);
    expect(game.series.teamWins).toEqual([1, 0]);
    applyUserIntent(game, guest.id, { kind: 'playAgain' });
    expect(game.match.phase).toBe('playing');
    expect(game.match.scores).toEqual([0, 0, 0, 0]);
    expect(game.status).toBe('playing');
    expect(game.playAgainReady).toEqual([]);
    expect(game.chaos).toBeNull();
  });

  it('starts a rematch as soon as the only human is ready', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostsolo2').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = { ...game.match!, phase: 'matchComplete', winner: 'team1' };
    applyUserIntent(game, host.id, { kind: 'playAgain' });
    expect(game.match.phase).toBe('playing');
    expect(game.series.matches).toBe(1);
    expect(game.series.teamWins).toEqual([0, 1]);
    expect(game.series.seatWins).toEqual([0, 1, 0, 1]);
  });

  it('starts a rematch only after all four humans say play again', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostfour1').token)!;
    const a = store.auth(store.guest('fourplr-a').token)!;
    const b = store.auth(store.guest('fourplr-b').token)!;
    const c = store.auth(store.guest('fourplr-c').token)!;
    const game = store.createGame(host);
    store.joinGame(a, game.code);
    store.joinGame(b, game.code);
    store.joinGame(c, game.code);
    startMatch(game);
    game.match = { ...game.match!, phase: 'matchComplete', winner: 'team0' };
    applyUserIntent(game, host.id, { kind: 'playAgain' });
    applyUserIntent(game, a.id, { kind: 'playAgain' });
    applyUserIntent(game, b.id, { kind: 'playAgain' });
    expect(game.match.phase).toBe('matchComplete');
    applyUserIntent(game, c.id, { kind: 'playAgain' });
    expect(game.match.phase).toBe('playing');
    expect(game.series.matches).toBe(1);
  });

  it('keeps the table open and records career stats once after a match', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hoststat1').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = {
      ...game.match!,
      phase: 'matchComplete',
      winner: 'team0',
      scores: [21, 8, 21, 8],
    };
    store.recordResult(game);
    expect(game.status).toBe('playing');
    expect(game.match.phase).toBe('matchComplete');
    expect(host.gamesPlayed).toBe(1);
    expect(host.wins).toBe(1);
    store.recordResult(game);
    expect(host.gamesPlayed).toBe(1);
    expect(payloadFor(game, host.id)?.series?.teamWins).toEqual([1, 0]);
  });

  it('reassigns chaos abilities on rematch without closing the table', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostchao1').token)!;
    const game = store.createGame(host);
    game.mode = 'chaos';
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    expect(game.chaos).toBeTruthy();
    game.match = { ...game.match!, phase: 'matchComplete', winner: 'team0' };
    applyUserIntent(game, host.id, { kind: 'playAgain' });
    expect(game.status).toBe('playing');
    expect(game.match.phase).toBe('playing');
    expect(game.chaos).toBeTruthy();
    expect(game.mode).toBe('chaos');
  });

  it('keeps a match going while another human is still connected', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hoststay1').token)!;
    const guest = store.auth(store.guest('gueststay').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, host.id, false);
    expect(game.status).toBe('playing');
    expect(game.match?.phase).not.toBe('matchComplete');
  });

  it('ends the match when every human is disconnected', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostgone1').token)!;
    const guest = store.auth(store.guest('guestgone').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, host.id, false);
    expect(game.status).toBe('playing');
    parkPlayer(game, guest.id, false);
    expect(game.status).toBe('complete');
    expect(game.match?.phase).toBe('matchComplete');
    expect(game.match?.winner).toBeNull();
  });

  it('ends the match when the last human leaves', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostleft1').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, host.id, true);
    expect(game.status).toBe('complete');
  });

  it('closes the match after every real player leaves from the menu', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostalllv').token)!;
    const guest = store.auth(store.guest('guestalllv').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    expect(parkPlayer(game, host.id, true)).toBe(false);
    expect(game.status).toBe('playing');
    expect(game.seats[0]?.isBot).toBe(true);
    expect(parkPlayer(game, guest.id, true)).toBe(true);
    expect(game.status).toBe('complete');
    expect(game.match?.phase).toBe('matchComplete');
    restorePlayer(game, host.id);
    restorePlayer(game, guest.id);
    expect(game.status).toBe('complete');
    expect(game.seats[0]?.isBot).toBe(true);
    expect(game.seats[1]?.isBot).toBe(true);
  });

  it('lets the remaining human start the next hand after the other goes to menu', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostmenu1').token)!;
    const guest = store.auth(store.guest('guestmenu').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    game.match = { ...game.match!, phase: 'handComplete', finishOrder: [0, 1, 2, 3] };
    const before = game.match.handIndex;
    parkPlayer(game, guest.id, false);
    applyUserIntent(game, host.id, { kind: 'nextHand' });
    expect(game.status).toBe('playing');
    expect(game.match.handIndex).toBe(before + 1);
  });

  it('lets a player return after going to the menu if someone is still at the table', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostback1').token)!;
    const guest = store.auth(store.guest('guestback').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, host.id, false);
    expect(game.seats[0]?.connection).toBe('disconnected');
    restorePlayer(game, host.id);
    expect(game.status).toBe('playing');
    expect(game.seats[0]?.connection).toBe('connected');
    expect(game.seats[0]?.isBot).toBe(false);
  });

  it('does not let two players take the same username', () => {
    const store = tempStore();
    const first = store.auth(store.guest('phoneaaaa').token)!;
    const second = store.auth(store.guest('phonebbbb').token)!;
    store.rename(first, 'Julian');
    expect(() => store.rename(second, 'julian')).toThrow('username-taken');
    expect(second.username.toLowerCase()).not.toBe('julian');
    store.rename(first, 'Julian');
    expect(first.username).toBe('Julian');
  });

  it('rejects a username that is too short or starts with a number', () => {
    const store = tempStore();
    const player = store.auth(store.guest('phoneinvalid').token)!;
    expect(() => store.rename(player, 'ab')).toThrow('bad-username');
    expect(() => store.rename(player, '1julian')).toThrow('bad-username');
  });

  it('replaces a leaver with a bot and restores them on resume', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostbotlv').token)!;
    const guest = store.auth(store.guest('guestbotlv').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, guest.id, true);
    expect(game.status).toBe('playing');
    expect(game.seats[1]?.isBot).toBe(true);
    expect(game.seats[1]?.userId).toBe(guest.id);
    expect(game.seats[1]?.botName).toBeTruthy();
    restorePlayer(game, guest.id);
    expect(game.seats[1]?.isBot).toBe(false);
    expect(game.seats[1]?.connection).toBe('connected');
    expect(game.seats[1]?.userId).toBe(guest.id);
  });

  it('lets a player create another room while they are a bot at an old table', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostnewrm').token)!;
    const guest = store.auth(store.guest('guestnewrm').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    parkPlayer(game, host.id, true);
    const next = store.createGame(host);
    expect(next.id).not.toBe(game.id);
    expect(next.status).toBe('lobby');
    expect(game.seats[0]?.isBot).toBe(true);
    expect(game.seats[0]?.userId).toBe(host.id);
    expect(next.seats[0]?.userId).toBe(host.id);
  });

  it('holds uninvited joins until someone at the table admits them', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostadmit1').token)!;
    const guest = store.auth(store.guest('guestadmit').token)!;
    const game = store.createGame(host);
    const pending = store.requestJoin(guest, game.code);
    expect(pending.pending).toBe(true);
    expect(game.seats.some((seat) => seat.userId === guest.id)).toBe(false);
    expect(store.inbox(host.id).some((item) => item.kind === 'join-request')).toBe(true);
    store.respondJoin(host, game.id, guest.id, true);
    expect(game.seats.some((seat) => seat.userId === guest.id)).toBe(true);
    expect(store.inbox(guest.id).some((item) => item.kind === 'join-accepted')).toBe(true);
  });

  it('lets an invited player sit without a second approval', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostinvok1').token)!;
    const friend = store.auth(store.guest('friendok1').token)!;
    const game = store.createGame(host);
    store.invite(host, game, friend.username, 1);
    const outcome = store.requestJoin(friend, game.code);
    expect(outcome.pending).toBe(false);
    expect(game.seats[1]?.userId).toBe(friend.id);
  });

  it('lets people join a room but not a game that already started', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostnoroom').token)!;
    const guest = store.auth(store.guest('guestnoroom').token)!;
    const late = store.auth(store.guest('latenoroom').token)!;
    const game = store.createGame(host);
    expect(store.requestJoin(guest, game.code).pending).toBe(true);
    store.respondJoin(host, game.id, guest.id, true);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    expect(() => store.requestJoin(late, game.code)).toThrow('room-started');
    expect(() => store.invite(host, game, late.username)).toThrow('room-started');
    store.closeOpenJoins(game);
    expect(game.seats.some((seat) => seat.userId === late.id)).toBe(false);
    parkPlayer(game, guest.id, true);
    const back = store.requestJoin(guest, game.code);
    expect(back.pending).toBe(false);
    expect(game.seats.some((seat) => seat.userId === guest.id && !seat.isBot)).toBe(true);
  });

  it('drops waiting join requests when the match starts', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostclose1').token)!;
    const guest = store.auth(store.guest('guestclose1').token)!;
    const game = store.createGame(host);
    store.requestJoin(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    store.closeOpenJoins(game);
    expect(store.joinRequests.some((row) => row.fromId === guest.id && row.status === 'pending')).toBe(false);
    expect(store.inbox(guest.id).some((item) => item.kind === 'join-denied')).toBe(true);
  });

  it('lets only the host start after guests press ready', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostready1').token)!;
    const guest = store.auth(store.guest('guestready1').token)!;
    const game = store.createGame(host);
    store.joinGame(guest, game.code);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    expect(() => store.assertCanStart(guest, game)).toThrow('not-host');
    expect(() => store.assertCanStart(host, game)).toThrow('players-not-ready');
    expect(() => store.invite(guest, game, host.username)).toThrow('not-host');
    store.setLobbyReady(guest, game, true);
    store.assertCanStart(host, game);
    expect(game.seats[1]?.lobbyReady).toBe(true);
    store.setLobbyReady(guest, game, false);
    expect(game.seats[1]?.lobbyReady).toBe(false);
    expect(() => store.assertCanStart(host, game)).toThrow('players-not-ready');
    store.setLobbyReady(guest, game, true);
    expect(() => store.setLobbyReady(host, game, false)).toThrow('not-host');
    game.seats[0]!.lobbyReady = false;
    store.assertCanStart(host, game);
  });

  it('marks only your own notices read so handled invites do not pop again', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostread1').token)!;
    const guest = store.auth(store.guest('guestread1').token)!;
    const game = store.createGame(host);
    store.invite(host, game, guest.username);
    const notice = store.inbox(guest.id).find((item) => item.kind === 'invite')!;
    expect(notice.read).toBe(false);
    store.markRead(host.id, [notice.id]);
    expect(store.inbox(guest.id).find((item) => item.id === notice.id)?.read).toBe(false);
    store.markRead(guest.id, [notice.id]);
    expect(store.inbox(guest.id).find((item) => item.id === notice.id)?.read).toBe(true);
  });

  it('hides profiles from strangers and friends lists from everyone else', () => {
    const store = tempStore();
    const owner = store.auth(store.guest('profileowner1').token)!;
    const stranger = store.auth(store.guest('profilestranger1').token)!;
    const tablemate = store.auth(store.guest('profiletable1').token)!;
    expect(store.profile(owner.id, stranger.id)).toBeNull();
    const own = store.profile(owner.id, owner.id);
    expect(own?.player.id).toBe(owner.id);
    const game = store.createGame(owner);
    store.joinGame(tablemate, game.code);
    const seen = store.profile(owner.id, tablemate.id);
    expect(seen?.player.id).toBe(owner.id);
    expect(seen?.friends).toEqual([]);
    expect(seen?.player.playingGameId).toBeNull();
    expect(JSON.stringify(seen)).not.toContain(owner.identityHash);
  });

  it('uses long unguessable ids', () => {
    const store = tempStore();
    const a = store.auth(store.guest('idcheck00001').token)!;
    const b = store.auth(store.guest('idcheck00002').token)!;
    expect(a.id).toMatch(/^usr_[0-9a-z]{20}$/);
    expect(a.id).not.toBe(b.id);
  });

  it('tells a denied joiner they were not let in', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostdeny1').token)!;
    const guest = store.auth(store.guest('guestdeny1').token)!;
    const game = store.createGame(host);
    store.requestJoin(guest, game.code);
    store.respondJoin(host, game.id, guest.id, false);
    expect(game.seats.some((seat) => seat.userId === guest.id)).toBe(false);
    expect(store.inbox(guest.id).some((item) => item.kind === 'join-denied')).toBe(true);
  });

  it('lists every live table for admin and hides finished games', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostadmin1').token)!;
    const other = store.auth(store.guest('otheradmin').token)!;
    const stranger = store.auth(store.guest('stranger99').token)!;
    const live = store.createGame(host);
    store.requestJoin(other, live.code);
    const finished = store.createGame(other);
    finished.status = 'complete';
    const listed = store.adminGames();
    expect(listed.map((row) => row.id)).toEqual([live.id]);
    expect(listed[0]!.pendingJoins.map((row) => row.fromId)).toContain(other.id);
    expect(store.activeFor(stranger.id).some((row) => row.id === live.id)).toBe(false);
    const snap = store.adminSnapshot();
    expect(snap.lobbies).toBe(1);
    expect(snap.playing).toBe(0);
    expect(snap.waitingJoins).toBe(1);
    expect(snap.games[0]!.pendingJoins).toContain(other.username);
    expect(JSON.stringify(snap)).not.toContain(host.id);
  });

  it('shows admin table progress without hidden cards', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostsnap01').token)!;
    const guest = store.auth(store.guest('guestsnap1').token)!;
    const game = store.createGame(host);
    store.requestJoin(guest, game.code);
    store.respondJoin(host, game.id, guest.id, true);
    store.setLobbyReady(guest, game, true);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    const hidden = game.match!.hands[1]![0]!.id;
    const snap = store.adminSnapshot();
    expect(snap.playing).toBe(1);
    expect(snap.games[0]!.humans).toBe(2);
    expect(snap.games[0]!.bots).toBe(2);
    expect(snap.games[0]!.handIndex).toBe(1);
    expect(JSON.stringify(snap)).not.toContain(`"${hidden}"`);
  });

  it('lets admin end a live table without recording a winner', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostend001').token)!;
    const guest = store.auth(store.guest('guestend01').token)!;
    const game = store.createGame(host);
    store.requestJoin(guest, game.code);
    store.respondJoin(host, game.id, guest.id, true);
    store.setLobbyReady(guest, game, true);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    store.chat(game, host, 'keep this at the table');
    expect(game.chat).toHaveLength(1);
    expect(forceEndGame(game)).toBe(true);
    expect(game.status).toBe('complete');
    expect(game.chat).toEqual([]);
    expect(game.match?.winner).toBeNull();
    expect(store.adminSnapshot().games).toEqual([]);
    expect(host.wins + guest.wins).toBe(0);
    expect(forceEndGame(game)).toBe(false);
    store.notifyAdminEnded(game);
    expect(store.inbox(host.id).some((row) => row.kind === 'game-ended' && row.gameId === game.id)).toBe(true);
    expect(store.inbox(guest.id).some((row) => row.kind === 'game-ended' && row.body.includes(game.code))).toBe(true);
    expect(store.inbox(host.id).filter((row) => row.kind === 'game-ended')).toHaveLength(1);
  });

  it('only lists live tables a player already sat at', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hostseat01').token)!;
    const guest = store.auth(store.guest('guestseat1').token)!;
    const outsider = store.auth(store.guest('outsiders1').token)!;
    const game = store.createGame(host);
    store.requestJoin(guest, game.code);
    store.invite(host, game, outsider.username);
    expect(store.activeFor(host.id).map((row) => row.id)).toEqual([game.id]);
    expect(store.activeFor(guest.id)).toEqual([]);
    expect(store.activeFor(outsider.id)).toEqual([]);
    store.respondJoin(host, game.id, guest.id, true);
    expect(store.activeFor(guest.id).map((row) => row.id)).toEqual([game.id]);
  });
});
