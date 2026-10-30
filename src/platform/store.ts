import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { sanitizeChat } from '../online/chat';
import { rememberIntent } from '../online/lifecycle';
import { avatarFor, createRoomCode, isUsername, normalizeUsername, randomId, suggestUsername } from './ids';
import { hashIdentity, hashToken, isDigest, randomSessionToken, sameDigest } from './identity';
import {
  AdminGameView,
  AdminPlayerView,
  AdminSeatView,
  AdminSnapshot,
  AuthResult,
  Friendship,
  GameInvite,
  GameSeat,
  GameSummary,
  JoinRequest,
  MatchHistoryRow,
  SeatSwitchRequest,
  PlatformGame,
  PlatformNotice,
  PlatformPlayer,
  PlatformSnapshot,
  PublicPlayer,
} from './types';

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const ONLINE_MS = 25_000;

function connectedHumanIds(game: PlatformGame): string[] {
  return game.seats.flatMap((seat) =>
    seat.userId && seat.connection === 'connected' && !seat.isBot ? [seat.userId] : [],
  );
}

function migratePlayer(
  raw: PlatformPlayer & { deviceId?: string },
): PlatformPlayer | null {
  const identityHash = raw.identityHash || (raw.deviceId ? hashIdentity(raw.deviceId) : '');
  if (!identityHash) {
    return null;
  }
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.displayName ?? raw.username,
    avatar: raw.avatar,
    identityHash,
    createdAt: raw.createdAt,
    lastSeen: raw.lastSeen,
    gamesPlayed: raw.gamesPlayed ?? 0,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    teamWins: raw.teamWins ?? 0,
    individualWins: raw.individualWins ?? 0,
    blocked: raw.blocked ?? [],
  };
}

function emptySeat(): GameSeat {
  return {
    userId: null,
    isBot: false,
    botName: null,
    connection: 'abandoned',
    muted: true,
    speaking: false,
    voiceAvailable: false,
    lobbyReady: false,
  };
}

export class PlatformStore {
  players = new Map<string, PlatformPlayer>();
  sessions = new Map<string, { userId: string; expiresAt: number }>();
  friends: Friendship[] = [];
  games = new Map<string, PlatformGame>();
  invites: GameInvite[] = [];
  joinRequests: JoinRequest[] = [];
  seatSwitches: SeatSwitchRequest[] = [];
  history: MatchHistoryRow[] = [];
  notices: PlatformNotice[] = [];
  hits = new Map<string, number[]>();

  private readonly filePath: string | null;
  private readonly onSave: ((snapshot: PlatformSnapshot) => void) | null;

  constructor(
    target: string | { initial: PlatformSnapshot | null; onSave: (snapshot: PlatformSnapshot) => void },
  ) {
    if (typeof target === 'string') {
      this.filePath = target;
      this.onSave = null;
      this.load();
      return;
    }
    this.filePath = null;
    this.onSave = target.onSave;
    if (target.initial) {
      this.restore(target.initial);
    }
  }

  // Drops finished matches and abandoned lobbies so the saved snapshot stays small.
  prune(now = Date.now()) {
    const DAY = 24 * 60 * 60 * 1000;
    let removed = false;
    for (const [id, game] of this.games) {
      const idle = now - game.updatedAt;
      const humans = game.seats.some((seat) => seat.userId && !seat.isBot);
      if ((game.status === 'complete' && idle > DAY) || (game.status === 'lobby' && (idle > DAY || (!humans && idle > 60 * 60 * 1000)))) {
        this.games.delete(id);
        removed = true;
      }
    }
    if (removed) {
      const live = new Set(this.games.keys());
      this.invites = this.invites.filter((row) => live.has(row.gameId));
      this.joinRequests = this.joinRequests.filter((row) => live.has(row.gameId));
      this.seatSwitches = this.seatSwitches.filter((row) => live.has(row.gameId));
    }
    for (const [token, row] of this.sessions) {
      if (row.expiresAt <= now) {
        this.sessions.delete(token);
        removed = true;
      }
    }
    for (const [key, hits] of this.hits) {
      if ((hits[hits.length - 1] ?? 0) < now - 2 * 60 * 60 * 1000) {
        this.hits.delete(key);
      }
    }
    if (removed) {
      this.save();
    }
  }

  snapshot(): PlatformSnapshot {
    const now = Date.now();
    return {
      players: [...this.players.values()],
      sessions: [...this.sessions.entries()]
        .filter(([, row]) => row.expiresAt > now)
        .map(([token, row]) => ({ token, ...row })),
      friends: this.friends,
      games: [...this.games.values()],
      invites: this.invites,
      joinRequests: this.joinRequests.slice(-200),
      seatSwitches: this.seatSwitches.slice(-200),
      history: this.history.slice(-400),
      notices: this.notices.slice(-400),
    };
  }

  save() {
    if (this.onSave) {
      this.onSave(this.snapshot());
      return;
    }
    if (!this.filePath) {
      return;
    }
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.snapshot()));
  }

  load() {
    if (!this.filePath) {
      return;
    }
    try {
      this.restore(JSON.parse(readFileSync(this.filePath, 'utf8')) as PlatformSnapshot);
    } catch {
      /* first boot */
    }
  }

  restore(parsed: PlatformSnapshot) {
    for (const player of parsed.players ?? []) {
      const migrated = migratePlayer(player);
      if (migrated) {
        this.players.set(migrated.id, migrated);
      }
    }
    for (const session of parsed.sessions ?? []) {
      const key = isDigest(session.token) ? session.token.toLowerCase() : hashToken(session.token);
      this.sessions.set(key, { userId: session.userId, expiresAt: session.expiresAt });
    }
    this.friends = parsed.friends ?? [];
    for (const game of parsed.games ?? []) {
      this.games.set(game.id, {
        ...game,
        nextHandReady: game.nextHandReady ?? [],
        seats: game.seats.map((seat) => ({
          ...seat,
          lobbyReady: seat.lobbyReady ?? Boolean(seat.isBot || seat.userId === game.createdBy),
        })) as PlatformGame['seats'],
      });
    }
    this.invites = (parsed.invites ?? []).map((row) => ({
      ...row,
      preferredTeam: row.preferredTeam === 0 || row.preferredTeam === 1 ? row.preferredTeam : null,
    }));
    this.joinRequests = (parsed.joinRequests ?? []).map((row) => ({
      ...row,
      preferredTeam: row.preferredTeam === 0 || row.preferredTeam === 1 ? row.preferredTeam : null,
    }));
    this.seatSwitches = parsed.seatSwitches ?? [];
    this.history = parsed.history ?? [];
    this.notices = parsed.notices ?? [];
  }

  rateOk(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const next = (this.hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (next.length >= limit) {
      this.hits.set(key, next);
      return false;
    }
    next.push(now);
    this.hits.set(key, next);
    return true;
  }

  playingGame(userId: string): PlatformGame | undefined {
    const seated = [...this.games.values()].filter(
      (game) => game.status !== 'complete' && game.seats.some((seat) => seat.userId === userId),
    );
    const live = seated.find((game) =>
      game.seats.some(
        (seat) => seat.userId === userId && !seat.isBot && seat.connection === 'connected',
      ),
    );
    return live ?? seated.find((game) => game.status === 'lobby') ?? seated[0];
  }

  publicPlayer(player: PlatformPlayer, now = Date.now()): PublicPlayer {
    const played = player.gamesPlayed;
    const current = this.playingGame(player.id);
    const atTable = Boolean(
      current &&
        current.status === 'playing' &&
        current.seats.some((seat) => seat.userId === player.id && !seat.isBot),
    );
    return {
      id: player.id,
      username: player.username,
      displayName: player.displayName,
      avatar: player.avatar,
      online: now - player.lastSeen < ONLINE_MS,
      playing: atTable,
      playingGameId: atTable || current?.status === 'lobby' ? current?.id ?? null : null,
      gamesPlayed: played,
      wins: player.wins,
      losses: player.losses,
      winPct: played === 0 ? 0 : Math.round((player.wins / played) * 100),
      teamWins: player.teamWins,
      individualWins: player.individualWins,
    };
  }

  touch(userId: string) {
    const player = this.players.get(userId);
    if (!player) {
      return;
    }
    const wasOffline = Date.now() - player.lastSeen >= ONLINE_MS;
    player.lastSeen = Date.now();
    if (wasOffline) {
      for (const friend of this.friendsOf(userId)) {
        this.notify(friend.id, 'friend-online', userId, `${player.username} is online.`);
      }
    }
  }

  uniqueUsername(seed: string): string {
    let base = normalizeUsername(suggestUsername(seed)) || 'Player';
    if (!/^[A-Za-z]/.test(base)) {
      base = `M${base}`;
    }
    let candidate = base.slice(0, 16);
    let n = 1;
    while ([...this.players.values()].some((player) => player.username.toLowerCase() === candidate.toLowerCase())) {
      const tail = String(n);
      candidate = `${base.slice(0, 16 - tail.length)}${tail}`;
      n += 1;
    }
    return candidate;
  }

  issueSession(userId: string): string {
    const token = randomSessionToken();
    this.sessions.set(hashToken(token), { userId, expiresAt: Date.now() + SESSION_MS });
    this.save();
    return token;
  }

  auth(token: string | null | undefined): PlatformPlayer | null {
    if (!token) {
      return null;
    }
    const row = this.sessions.get(hashToken(token));
    if (!row || row.expiresAt < Date.now()) {
      return null;
    }
    const player = this.players.get(row.userId);
    if (player) {
      this.touch(player.id);
    }
    return player ?? null;
  }

  guest(secret: string): AuthResult {
    if (secret.length < 8 || secret.length > 256) {
      throw new Error('bad-device');
    }
    const identityHash = hashIdentity(secret);
    const existing = [...this.players.values()].find((player) => sameDigest(player.identityHash, identityHash));
    if (existing) {
      return { token: this.issueSession(existing.id), player: this.publicPlayer(existing) };
    }
    const id = randomId('usr');
    const username = this.uniqueUsername(identityHash);
    const player: PlatformPlayer = {
      id,
      username,
      displayName: username,
      avatar: avatarFor(identityHash),
      identityHash,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      teamWins: 0,
      individualWins: 0,
      blocked: [],
    };
    this.players.set(id, player);
    this.save();
    return { token: this.issueSession(id), player: this.publicPlayer(player) };
  }

  rename(player: PlatformPlayer, username: string) {
    const next = normalizeUsername(username);
    if (!isUsername(next)) {
      throw new Error('bad-username');
    }
    if (next === player.username) {
      return;
    }
    const taken = [...this.players.values()].some(
      (row) => row.id !== player.id && row.username.toLowerCase() === next.toLowerCase(),
    );
    if (taken) {
      throw new Error('username-taken');
    }
    player.username = next;
    player.displayName = next;
    this.save();
  }

  search(_query: string, _viewerId: string): PublicPlayer[] {
    return [];
  }

  shareTable(a: string, b: string): boolean {
    return [...this.games.values()].some(
      (game) =>
        game.status !== 'complete' &&
        game.seats.some((seat) => seat.userId === a) &&
        game.seats.some((seat) => seat.userId === b),
    );
  }

  friendRecord(a: string, b: string): Friendship | undefined {
    return this.friends.find(
      (row) =>
        (row.requesterId === a && row.addresseeId === b) || (row.requesterId === b && row.addresseeId === a),
    );
  }

  requestFriend(from: PlatformPlayer, username: string) {
    const to = [...this.players.values()].find((player) => player.username.toLowerCase() === username.trim().toLowerCase());
    if (!to || to.id === from.id) {
      throw new Error('player-missing');
    }
    if (from.blocked.includes(to.id) || to.blocked.includes(from.id)) {
      throw new Error('blocked');
    }
    const existing = this.friendRecord(from.id, to.id);
    if (existing?.status === 'accepted') {
      return existing;
    }
    if (existing?.status === 'pending' && existing.requesterId === to.id) {
      existing.status = 'accepted';
      this.notify(from.id, 'friend-accept', to.id, `${to.username} is now your friend.`);
      this.save();
      return existing;
    }
    if (existing) {
      return existing;
    }
    if (!this.shareTable(from.id, to.id)) {
      throw new Error('not-same-room');
    }
    if (!this.rateOk(`friend:${from.id}`, 20, 60_000)) {
      throw new Error('rate-limit');
    }
    const row: Friendship = {
      id: randomId('fr'),
      requesterId: from.id,
      addresseeId: to.id,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.friends.push(row);
    this.notify(to.id, 'friend-request', from.id, `${from.username} sent a friend request.`);
    this.save();
    return row;
  }

  respondFriend(user: PlatformPlayer, friendshipId: string, accept: boolean) {
    const row = this.friends.find((item) => item.id === friendshipId);
    if (!row || row.addresseeId !== user.id || row.status !== 'pending') {
      throw new Error('request-missing');
    }
    row.status = accept ? 'accepted' : 'blocked';
    if (!accept) {
      this.friends = this.friends.filter((item) => item.id !== row.id);
    } else {
      this.notify(row.requesterId, 'friend-accept', user.id, `${user.username} accepted your request.`);
    }
    this.save();
  }

  removeFriend(user: PlatformPlayer, otherId: string) {
    this.friends = this.friends.filter((row) => {
      const pair = (row.requesterId === user.id && row.addresseeId === otherId) || (row.requesterId === otherId && row.addresseeId === user.id);
      return !pair;
    });
    this.save();
  }

  block(user: PlatformPlayer, otherId: string) {
    if (!user.blocked.includes(otherId)) {
      user.blocked.push(otherId);
    }
    this.removeFriend(user, otherId);
  }

  friendsOf(userId: string): PublicPlayer[] {
    return this.friends
      .filter((row) => row.status === 'accepted' && (row.requesterId === userId || row.addresseeId === userId))
      .map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId))
      .map((id) => this.players.get(id))
      .filter((player): player is PlatformPlayer => Boolean(player))
      .map((player) => this.publicPlayer(player));
  }

  pendingFor(userId: string): Friendship[] {
    return this.friends
      .filter((row) => row.status === 'pending' && row.addresseeId === userId)
      .map((row) => ({ ...row, fromUsername: this.players.get(row.requesterId)?.username ?? 'Player' }));
  }

  notify(userId: string, kind: PlatformNotice['kind'], fromId: string | null, body: string, gameId: string | null = null) {
    this.notices.unshift({
      id: randomId('nt'),
      userId,
      kind,
      title: kind,
      body,
      fromId,
      gameId,
      at: Date.now(),
      read: false,
    });
    this.notices = this.notices.slice(0, 300);
  }

  inbox(userId: string): PlatformNotice[] {
    return this.notices.filter((row) => row.userId === userId).slice(0, 40);
  }

  markRead(userId: string, ids: string[]) {
    const wanted = new Set(ids.slice(0, 100));
    let changed = false;
    for (const row of this.notices) {
      if (row.userId === userId && !row.read && wanted.has(row.id)) {
        row.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }

  createGame(user: PlatformPlayer, mode: '2v2' | 'individual'): PlatformGame {
    const codes = new Set([...this.games.values()].map((game) => game.code));
    const seats: PlatformGame['seats'] = [
      { userId: user.id, isBot: false, botName: null, connection: 'connected', muted: true, speaking: false, voiceAvailable: true, lobbyReady: true },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ];
    const game: PlatformGame = {
      id: randomId('g'),
      code: createRoomCode(codes),
      mode,
      status: 'lobby',
      createdBy: user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seats,
      match: null,
      chat: [],
      seenIntents: {},
      nextHandReady: [],
    };
    this.games.set(game.id, game);
    this.save();
    return game;
  }

  private canTakeSeat(game: PlatformGame, index: number): boolean {
    const seat = game.seats[index];
    if (!seat) {
      return false;
    }
    if (!seat.userId && !seat.isBot) {
      return true;
    }
    return seat.isBot && game.status === 'lobby';
  }

  private seatOrder(preferSeat?: number, preferTeam?: 0 | 1): number[] {
    const teamOrder = preferTeam === 0 ? [0, 2, 1, 3] : preferTeam === 1 ? [1, 3, 0, 2] : [0, 1, 2, 3];
    if (preferSeat === undefined || preferSeat < 0 || preferSeat > 3) {
      return teamOrder;
    }
    return [preferSeat, ...teamOrder.filter((seat) => seat !== preferSeat)];
  }

  joinGame(user: PlatformPlayer, code: string, options?: { seat?: number; team?: 0 | 1 }): PlatformGame {
    const game = [...this.games.values()].find((row) => row.code === code.trim().toUpperCase());
    if (!game) {
      throw new Error('room-missing');
    }
    if (game.status === 'complete') {
      throw new Error('session-expired');
    }
    const mine = game.seats.findIndex((seat) => seat.userId === user.id);
    if (game.status !== 'lobby' && mine < 0) {
      throw new Error('room-started');
    }
    if (mine >= 0) {
      game.seats[mine].connection = 'connected';
      game.seats[mine].isBot = false;
      if (options?.seat !== undefined && options.seat !== mine && game.status === 'lobby') {
        this.claimSeat(user, game, options.seat);
      }
      this.save();
      return game;
    }
    const invite = this.invites.find((row) => row.gameId === game.id && row.toId === user.id && row.status === 'pending');
    const order = this.seatOrder(options?.seat, options?.team ?? invite?.preferredTeam ?? undefined);
    const index = order.find((seat) => this.canTakeSeat(game, seat)) ?? -1;
    if (index < 0) {
      throw new Error('room-full');
    }
    game.seats[index] = {
      userId: user.id,
      isBot: false,
      botName: null,
      lobbyReady: false,
      connection: 'connected',
      muted: true,
      speaking: false,
      voiceAvailable: true,
    };
    this.invites
      .filter((row) => row.gameId === game.id && row.toId === user.id)
      .forEach((row) => {
        row.status = 'accepted';
      });
    this.joinRequests
      .filter((row) => row.gameId === game.id && row.fromId === user.id && row.status === 'pending')
      .forEach((row) => {
        row.status = 'accepted';
      });
    game.updatedAt = Date.now();
    this.save();
    return game;
  }

  requestJoin(
    user: PlatformPlayer,
    code: string,
    options?: { seat?: number; team?: 0 | 1 },
  ): { game: PlatformGame; pending: boolean } {
    const game = [...this.games.values()].find((row) => row.code === code.trim().toUpperCase());
    if (!game) {
      throw new Error('room-missing');
    }
    if (game.status === 'complete') {
      throw new Error('session-expired');
    }
    const mine = game.seats.findIndex((seat) => seat.userId === user.id);
    if (game.status !== 'lobby' && mine < 0) {
      throw new Error('room-started');
    }
    if (mine >= 0) {
      return { game: this.joinGame(user, game.code, options), pending: false };
    }
    const invited = this.invites.some(
      (row) => row.gameId === game.id && row.toId === user.id && row.status === 'pending',
    );
    if (invited) {
      return { game: this.joinGame(user, game.code, options), pending: false };
    }
    const existing = this.joinRequests.find(
      (row) => row.gameId === game.id && row.fromId === user.id && row.status === 'pending',
    );
    if (existing) {
      if (options?.team === 0 || options?.team === 1) {
        existing.preferredTeam = options.team;
      }
      this.save();
      return { game, pending: true };
    }
    if (connectedHumanIds(game).length === 0) {
      return { game: this.joinGame(user, game.code, options), pending: false };
    }
    this.joinRequests.push({
      id: randomId('jr'),
      gameId: game.id,
      fromId: user.id,
      status: 'pending',
      createdAt: Date.now(),
      preferredTeam: options?.team === 0 || options?.team === 1 ? options.team : null,
    });
    this.notify(
      game.createdBy,
      'join-request',
      user.id,
      `${user.username} wants to join ${game.code}.`,
      game.id,
    );
    this.save();
    return { game, pending: true };
  }

  respondJoin(actor: PlatformPlayer, gameId: string, fromId: string, accept: boolean): PlatformGame {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('room-missing');
    }
    this.assertHost(actor, game);
    const row = this.joinRequests.find(
      (item) => item.gameId === gameId && item.fromId === fromId && item.status === 'pending',
    );
    if (!row) {
      throw new Error('request-missing');
    }
    const from = this.players.get(fromId);
    if (!from) {
      throw new Error('player-missing');
    }
    if (!accept) {
      row.status = 'declined';
      this.notify(fromId, 'join-denied', actor.id, `You were not let into ${game.code}.`, game.id);
      this.save();
      return game;
    }
    this.joinGame(from, game.code, { team: row.preferredTeam ?? undefined });
    row.status = 'accepted';
    this.notify(fromId, 'join-accepted', actor.id, `You can join ${game.code} now.`, game.id);
    this.save();
    return game;
  }

  pendingJoins(game: PlatformGame): { fromId: string; username: string }[] {
    return this.joinRequests
      .filter((row) => row.gameId === game.id && row.status === 'pending')
      .map((row) => ({
        fromId: row.fromId,
        username: this.players.get(row.fromId)?.username ?? 'Player',
      }));
  }

  private swapSeats(game: PlatformGame, a: number, b: number) {
    const left = game.seats[a];
    const right = game.seats[b];
    if (!left || !right) {
      return;
    }
    game.seats[a] = right;
    game.seats[b] = left;
  }

  claimSeat(user: PlatformPlayer, game: PlatformGame, seat: number): { game: PlatformGame; pending: boolean } {
    if (game.status !== 'lobby') {
      throw new Error('room-started');
    }
    if (seat < 0 || seat > 3) {
      throw new Error('bad-seat');
    }
    const mine = game.seats.findIndex((row) => row.userId === user.id);
    if (mine < 0) {
      throw new Error('not-in-room');
    }
    if (mine === seat) {
      return { game, pending: false };
    }
    const target = game.seats[seat];
    if (!target) {
      throw new Error('bad-seat');
    }
    if (target.userId && !target.isBot) {
      return { game, pending: this.requestSeatSwitch(user, game, target.userId) };
    }
    const moving = { ...game.seats[mine]! };
    game.seats[seat] = moving;
    game.seats[mine] = target.isBot ? { ...target } : emptySeat();
    game.updatedAt = Date.now();
    this.save();
    return { game, pending: false };
  }

  requestSeatSwitch(user: PlatformPlayer, game: PlatformGame, toId: string): boolean {
    if (toId === user.id) {
      return false;
    }
    if (!game.seats.some((seat) => seat.userId === toId && !seat.isBot)) {
      throw new Error('player-missing');
    }
    const reverse = this.seatSwitches.find(
      (row) =>
        row.gameId === game.id &&
        row.fromId === toId &&
        row.toId === user.id &&
        row.status === 'pending',
    );
    if (reverse) {
      this.respondSeatSwitch(user, game, toId, true);
      return false;
    }
    const existing = this.seatSwitches.find(
      (row) => row.gameId === game.id && row.fromId === user.id && row.status === 'pending',
    );
    if (existing) {
      if (existing.toId === toId) {
        return true;
      }
      existing.status = 'declined';
    }
    this.seatSwitches.push({
      id: randomId('sw'),
      gameId: game.id,
      fromId: user.id,
      toId,
      status: 'pending',
      createdAt: Date.now(),
    });
    this.notify(toId, 'seat-switch', user.id, `${user.username} wants to switch seats.`, game.id);
    this.save();
    return true;
  }

  respondSeatSwitch(actor: PlatformPlayer, game: PlatformGame, fromId: string, accept: boolean): PlatformGame {
    const row = this.seatSwitches.find(
      (item) =>
        item.gameId === game.id && item.fromId === fromId && item.toId === actor.id && item.status === 'pending',
    );
    if (!row) {
      throw new Error('request-missing');
    }
    if (!accept) {
      row.status = 'declined';
      this.notify(fromId, 'seat-switch-denied', actor.id, `They did not want to switch.`, game.id);
      this.save();
      return game;
    }
    const fromSeat = game.seats.findIndex((seat) => seat.userId === fromId && !seat.isBot);
    const toSeat = game.seats.findIndex((seat) => seat.userId === actor.id && !seat.isBot);
    if (fromSeat < 0 || toSeat < 0) {
      row.status = 'declined';
      this.save();
      throw new Error('request-missing');
    }
    this.swapSeats(game, fromSeat, toSeat);
    row.status = 'accepted';
    game.updatedAt = Date.now();
    this.save();
    return game;
  }

  cancelSeatSwitches(game: PlatformGame, userId?: string) {
    for (const row of this.seatSwitches) {
      if (row.gameId !== game.id || row.status !== 'pending') {
        continue;
      }
      if (userId && row.fromId !== userId && row.toId !== userId) {
        continue;
      }
      row.status = 'declined';
    }
    this.save();
  }

  closeOpenJoins(game: PlatformGame): string[] {
    const fromIds: string[] = [];
    for (const row of this.joinRequests) {
      if (row.gameId !== game.id || row.status !== 'pending') {
        continue;
      }
      row.status = 'declined';
      fromIds.push(row.fromId);
      this.notify(row.fromId, 'join-denied', game.createdBy, `You were not let into ${game.code}.`, game.id);
    }
    this.cancelSeatSwitches(game);
    this.save();
    return fromIds;
  }

  assertHost(user: PlatformPlayer, game: PlatformGame) {
    if (user.id !== game.createdBy) {
      throw new Error('not-host');
    }
  }

  guestsReady(game: PlatformGame): boolean {
    return game.seats.every(
      (seat) => !seat.userId || seat.isBot || seat.userId === game.createdBy || seat.lobbyReady,
    );
  }

  assertCanStart(user: PlatformPlayer, game: PlatformGame) {
    this.assertHost(user, game);
    if (game.status !== 'lobby') {
      throw new Error('room-started');
    }
    if (game.seats.some((seat) => !seat.userId && !seat.isBot)) {
      throw new Error('seats-not-ready');
    }
    if (!this.guestsReady(game)) {
      throw new Error('players-not-ready');
    }
  }

  setLobbyReady(user: PlatformPlayer, game: PlatformGame, ready: boolean) {
    if (game.status !== 'lobby') {
      throw new Error('room-started');
    }
    if (user.id === game.createdBy) {
      throw new Error('not-host');
    }
    const seat = game.seats.find((row) => row.userId === user.id);
    if (!seat || seat.isBot) {
      throw new Error('not-in-room');
    }
    seat.lobbyReady = Boolean(ready);
    game.updatedAt = Date.now();
    this.save();
    return game;
  }

  invite(from: PlatformPlayer, game: PlatformGame, username: string, team?: 0 | 1) {
    this.assertHost(from, game);
    if (game.status !== 'lobby') {
      throw new Error('room-started');
    }
    const to = [...this.players.values()].find((player) => player.username.toLowerCase() === username.trim().toLowerCase());
    if (!to || to.id === from.id) {
      throw new Error('player-missing');
    }
    if (from.blocked.includes(to.id) || to.blocked.includes(from.id)) {
      throw new Error('blocked');
    }
    const pending = this.invites.find(
      (row) => row.gameId === game.id && row.toId === to.id && row.status === 'pending',
    );
    if (pending) {
      pending.preferredTeam = team === 0 || team === 1 ? team : pending.preferredTeam;
      this.save();
      return pending;
    }
    const row: GameInvite = {
      id: randomId('inv'),
      gameId: game.id,
      fromId: from.id,
      toId: to.id,
      status: 'pending',
      createdAt: Date.now(),
      preferredTeam: team === 0 || team === 1 ? team : null,
    };
    this.invites.push(row);
    this.notify(to.id, 'invite', from.id, `${from.username} invited you to ${game.code}.`, game.id);
    this.save();
    return row;
  }

  fillBots(game: PlatformGame, names: string[]) {
    let bot = 0;
    game.seats = game.seats.map((seat) => {
      if (seat.userId || seat.isBot) {
        return seat;
      }
      const name = names[bot] ?? `Bot ${bot + 1}`;
      bot += 1;
      return {
        userId: null,
        isBot: true,
        botName: name,
        connection: 'connected',
        muted: true,
        speaking: false,
        voiceAvailable: false,
        lobbyReady: true,
      };
    }) as PlatformGame['seats'];
    game.updatedAt = Date.now();
    this.save();
  }

  summary(game: PlatformGame, viewerId: string | null): GameSummary {
    return {
      id: game.id,
      code: game.code,
      mode: game.mode,
      status: game.status,
      createdBy: game.createdBy,
      updatedAt: game.updatedAt,
      invited: this.invites.some((invite) => invite.gameId === game.id && invite.toId === viewerId && invite.status === 'pending'),
      joinPending: this.joinRequests.some(
        (row) => row.gameId === game.id && row.fromId === viewerId && row.status === 'pending',
      ),
      seats: game.seats.map((seat) => {
        const player = seat.userId ? this.players.get(seat.userId) : null;
        return {
          name: seat.isBot ? (seat.botName ?? player?.username ?? 'Bot') : (player?.username ?? seat.botName ?? 'Empty'),
          userId: seat.userId,
          isBot: seat.isBot,
          connection: seat.connection,
          isYou: Boolean(viewerId && seat.userId === viewerId),
          muted: seat.muted,
          speaking: seat.speaking,
          voiceAvailable: seat.voiceAvailable,
          ready: Boolean(seat.userId || seat.isBot),
        };
      }),
      pendingJoins:
        viewerId && game.seats.some((seat) => seat.userId === viewerId && !seat.isBot)
          ? this.pendingJoins(game)
          : [],
    };
  }

  activeFor(userId: string): GameSummary[] {
    return [...this.games.values()]
      .filter(
        (game) =>
          game.status !== 'complete' &&
          game.seats.some((seat) => seat.userId === userId && !seat.isBot),
      )
      .map((game) => this.summary(game, userId));
  }

  adminGames(): GameSummary[] {
    return [...this.games.values()]
      .filter((game) => game.status === 'lobby' || game.status === 'playing')
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((game) => ({ ...this.summary(game, null), pendingJoins: this.pendingJoins(game) }));
  }

  adminView(game: PlatformGame): AdminGameView {
    const match = game.match;
    const seats: AdminSeatView[] = game.seats.map((seat, index) => {
      const player = seat.userId ? this.players.get(seat.userId) : null;
      const empty = !seat.userId && !seat.isBot;
      return {
        name: empty
          ? 'Empty'
          : seat.isBot
            ? (seat.botName ?? player?.username ?? 'Bot')
            : (player?.username ?? seat.botName ?? 'Empty'),
        isBot: seat.isBot,
        empty,
        isHost: Boolean(seat.userId && seat.userId === game.createdBy),
        connection: seat.connection,
        muted: seat.muted,
        speaking: seat.speaking,
        voiceAvailable: seat.voiceAvailable,
        lobbyReady: Boolean(seat.lobbyReady || seat.isBot || seat.userId === game.createdBy),
        cards: match ? (match.hands[index]?.length ?? 0) : null,
        score: match ? (match.scores[index] ?? 0) : null,
      };
    });
    const humans = seats.filter((seat) => !seat.isBot && !seat.empty).length;
    const bots = seats.filter((seat) => seat.isBot).length;
    return {
      id: game.id,
      code: game.code,
      mode: game.mode,
      status: game.status === 'playing' ? 'playing' : 'lobby',
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      hostName: this.players.get(game.createdBy)?.username ?? 'Host',
      seats,
      pendingJoins: this.pendingJoins(game).map((row) => row.username),
      phase: match?.phase ?? null,
      handIndex: match ? match.handIndex + 1 : null,
      currentName: match ? (seats[match.currentSeat]?.name ?? null) : null,
      targetScore: match?.targetScore ?? null,
      teamScores:
        match?.mode === '2v2'
          ? { team0: match.scores[0] + match.scores[2], team1: match.scores[1] + match.scores[3] }
          : null,
      trick: match?.trick.combination?.type ?? null,
      chatLines: game.chat.length,
      humans,
      bots,
      connectedHumans: game.seats.filter(
        (seat) => Boolean(seat.userId) && !seat.isBot && seat.connection === 'connected',
      ).length,
    };
  }

  adminSnapshot(): AdminSnapshot {
    const now = Date.now();
    const games = [...this.games.values()]
      .filter((game) => game.status === 'lobby' || game.status === 'playing')
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((game) => this.adminView(game));
    const players: AdminPlayerView[] = [...this.players.values()]
      .sort((left, right) => right.lastSeen - left.lastSeen)
      .slice(0, 40)
      .map((player) => {
        const table = this.playingGame(player.id);
        return {
          username: player.username,
          online: now - player.lastSeen < ONLINE_MS,
          lastSeen: player.lastSeen,
          gamesPlayed: player.gamesPlayed,
          wins: player.wins,
          tableCode: table && table.status !== 'complete' ? table.code : null,
          tableStatus: table && table.status !== 'complete' ? table.status : null,
        };
      });
    return {
      at: now,
      accounts: this.players.size,
      online: [...this.players.values()].filter((player) => now - player.lastSeen < ONLINE_MS).length,
      lobbies: games.filter((game) => game.status === 'lobby').length,
      playing: games.filter((game) => game.status === 'playing').length,
      waitingJoins: games.reduce((sum, game) => sum + game.pendingJoins.length, 0),
      games,
      players,
    };
  }

  remember(game: PlatformGame, userId: string, intentId?: string): boolean {
    const remembered = rememberIntent(game.seenIntents[userId] ?? [], intentId);
    game.seenIntents[userId] = remembered.seen;
    return remembered.duplicate;
  }

  chat(game: PlatformGame, user: PlatformPlayer, text: string) {
    if (!this.rateOk(`chat:${user.id}`, 30, 10_000)) {
      throw new Error('rate-limit');
    }
    const clean = sanitizeChat(text);
    if (!clean) {
      return null;
    }
    const seatIndex = game.seats.findIndex((row) => row.userId === user.id);
    const seat = (seatIndex >= 0 ? seatIndex : 0) as 0 | 1 | 2 | 3;
    const line = { id: randomId('ch'), seat, name: user.username, text: clean, at: Date.now() };
    game.chat = [...game.chat, line].slice(-40);
    this.save();
    return line;
  }

  recordResult(game: PlatformGame) {
    if (game.status === 'complete' || !game.match || game.match.phase !== 'matchComplete') {
      return;
    }
    game.status = 'complete';
    const winner = game.match.winner;
    for (const [index, seat] of game.seats.entries()) {
      if (!seat.userId) {
        continue;
      }
      const player = this.players.get(seat.userId);
      if (!player) {
        continue;
      }
      player.gamesPlayed += 1;
      const won =
        winner === 'team0'
          ? index % 2 === 0
          : winner === 'team1'
            ? index % 2 === 1
            : winner === index;
      if (won) {
        player.wins += 1;
        if (game.mode === '2v2') {
          player.teamWins += 1;
        } else {
          player.individualWins += 1;
        }
      } else {
        player.losses += 1;
      }
      this.history.push({
        id: randomId('mh'),
        gameId: game.id,
        mode: game.mode,
        at: Date.now(),
        userId: player.id,
        won,
        score: game.match.scores[index] ?? 0,
      });
    }
    this.save();
  }

  historyFor(userId: string): MatchHistoryRow[] {
    return this.history.filter((row) => row.userId === userId).slice(-30).reverse();
  }

  // A profile is visible to the player, their friends, and people at a table with them.
  // Only the player sees their own friends list; only friends see which game they are in.
  profile(
    userId: string,
    viewerId: string,
  ): { player: PublicPlayer; history: MatchHistoryRow[]; friends: PublicPlayer[] } | null {
    const player = this.players.get(userId);
    if (!player) {
      return null;
    }
    const self = userId === viewerId;
    const friend = this.friendRecord(userId, viewerId)?.status === 'accepted';
    if (!self && !friend && !this.shareTable(userId, viewerId)) {
      return null;
    }
    const shown = this.publicPlayer(player);
    return {
      player: self || friend ? shown : { ...shown, playingGameId: null },
      history: this.historyFor(userId),
      friends: self ? this.friendsOf(userId) : [],
    };
  }
}
