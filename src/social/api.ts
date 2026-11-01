import { MatchMode } from '../domain';
import { apiRoots } from '../online/relayUrl';
import {
  AdminSnapshot,
  AuthResult,
  Friendship,
  GameSummary,
  JoinOutcome,
  MatchHistoryRow,
  PlatformNotice,
  PublicPlayer,
  TablePayload,
} from '../platform/types';

export type SocialSnapshot = {
  me: PublicPlayer | null;
  friends: PublicPlayer[];
  requests: Friendship[];
  inbox: PlatformNotice[];
  games: GameSummary[];
};

let token: string | null = null;

export function setApiToken(next: string | null) {
  token = next;
}

export function apiToken(): string | null {
  return token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const roots = apiRoots();
  let last = 'relayDown';
  for (const root of roots) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 8_000);
    try {
      const response = await fetch(`${root}${path}`, {
        ...init,
        signal: abort.signal,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) {
        last = payload.error ?? `http-${response.status}`;
        if (response.status === 401 || response.status === 400) {
          throw new Error(last);
        }
        continue;
      }
      return payload;
    } catch (error) {
      last = error instanceof Error && error.name !== 'AbortError' ? error.message : 'relayDown';
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

export async function createGuest(identity: string): Promise<AuthResult> {
  const result = await request<AuthResult>('/v1/guest', {
    method: 'POST',
    body: JSON.stringify({ identity }),
  });
  setApiToken(result.token);
  return result;
}

export async function fetchMe(): Promise<{ player: PublicPlayer; inbox: PlatformNotice[]; games: GameSummary[] }> {
  return request('/v1/me');
}

export async function markInboxRead(ids: string[]) {
  if (ids.length === 0) {
    return;
  }
  await request('/v1/inbox/read', { method: 'POST', body: JSON.stringify({ ids }) }).catch(() => undefined);
}

export async function patchMe(body: { username?: string; avatar?: string }) {
  return request<{ player: PublicPlayer }>('/v1/me', { method: 'PATCH', body: JSON.stringify(body) });
}

export async function searchPlayers(q: string): Promise<PublicPlayer[]> {
  const result = await request<{ players: PublicPlayer[] }>(`/v1/players?q=${encodeURIComponent(q)}`);
  return result.players;
}

export async function fetchProfile(id: string): Promise<{
  player: PublicPlayer;
  history: MatchHistoryRow[];
  friends: PublicPlayer[];
} | null> {
  const result = await request<{ player?: PublicPlayer; history?: MatchHistoryRow[]; friends?: PublicPlayer[]; error?: string }>(
    `/v1/players/${encodeURIComponent(id)}/profile`,
  ).catch(() => null);
  if (!result?.player) {
    return null;
  }
  return { player: result.player, history: result.history ?? [], friends: result.friends ?? [] };
}

export async function requestFriend(username: string) {
  return request<{ friends: PublicPlayer[]; requests: Friendship[] }>('/v1/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function respondFriend(id: string, accept: boolean) {
  return request('/v1/friends/respond', { method: 'POST', body: JSON.stringify({ id, accept }) });
}

export async function removeFriend(id: string) {
  return request(`/v1/friends/${id}`, { method: 'DELETE' });
}

export async function blockPlayer(id: string) {
  return request(`/v1/friends/block/${id}`, { method: 'POST' });
}

export async function createGame(): Promise<GameSummary> {
  const result = await request<{ game: GameSummary }>('/v1/games', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return result.game;
}

export async function joinGame(code: string, team?: 0 | 1): Promise<JoinOutcome> {
  const result = await request<JoinOutcome>('/v1/games/join', {
    method: 'POST',
    body: JSON.stringify({ code, team }),
  });
  return { game: result.game, pending: Boolean(result.pending) };
}

export async function joinGameById(gameId: string, team?: 0 | 1): Promise<JoinOutcome> {
  const result = await request<JoinOutcome>(`/v1/games/${gameId}/join`, {
    method: 'POST',
    body: JSON.stringify({ team }),
  });
  return { game: result.game, pending: Boolean(result.pending) };
}

export async function respondJoin(gameId: string, fromId: string, accept: boolean) {
  return request<{ game: GameSummary }>(`/v1/games/${gameId}/admit`, {
    method: 'POST',
    body: JSON.stringify({ fromId, accept }),
  });
}

export async function claimSeat(gameId: string, seat: number) {
  return request<{ game: GameSummary; pending?: boolean }>(`/v1/games/${gameId}/seat`, {
    method: 'POST',
    body: JSON.stringify({ seat }),
  });
}

export async function respondSwitch(gameId: string, fromId: string, accept: boolean) {
  return request<{ game: GameSummary }>(`/v1/games/${gameId}/switch`, {
    method: 'POST',
    body: JSON.stringify({ fromId, accept }),
  });
}

export async function inviteToGame(gameId: string, username: string, team?: 0 | 1 | 2) {
  return request(`/v1/games/${gameId}/invite`, { method: 'POST', body: JSON.stringify({ username, team }) });
}

export async function fillGameBots(gameId: string) {
  return request<{ game: GameSummary }>(`/v1/games/${gameId}/bots`, { method: 'POST' });
}

export async function startGame(
  gameId: string,
  mode?: MatchMode,
): Promise<{ game: GameSummary; table: TablePayload | null }> {
  return request(`/v1/games/${gameId}/start`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function setGameMode(gameId: string, mode: MatchMode): Promise<GameSummary> {
  const result = await request<{ game: GameSummary }>(`/v1/games/${gameId}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
  return result.game;
}

export async function setLobbyReady(gameId: string, ready: boolean) {
  return request<{ game: GameSummary }>(`/v1/games/${gameId}/ready`, {
    method: 'POST',
    body: JSON.stringify({ ready: ready === true }),
  });
}

export async function leaveGame(gameId: string) {
  return request<{ ok: boolean; ended?: boolean }>(`/v1/games/${gameId}/leave`, { method: 'POST' });
}

export async function fetchAdminSnapshot(adminToken: string): Promise<AdminSnapshot> {
  return request<AdminSnapshot>('/v1/admin/games', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
}

export async function endAdminGame(adminToken: string, gameId: string): Promise<AdminSnapshot> {
  return request<AdminSnapshot>(`/v1/admin/games/${encodeURIComponent(gameId)}/end`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
  });
}
