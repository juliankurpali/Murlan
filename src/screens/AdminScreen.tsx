import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { t, tError } from '../i18n';
import { GameSummary } from '../platform/types';
import { fetchAdminGames } from '../social/api';
import { colors, radius, spacing } from '../theme';

const ADMIN_TOKEN_KEY = 'murlan.adminToken';

type Props = {
  language: Language;
  onBack: () => void;
};

function storedToken(): string {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return '';
  }
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
}

function rememberToken(value: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return;
  }
  if (value) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, value);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function relativeTime(language: Language, updatedAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (minutes < 1) {
    return t(language, 'justNow');
  }
  return t(language, 'minutesAgo', { count: minutes });
}

function unlockError(language: Language, error: unknown): string {
  const code = error instanceof Error ? error.message : String(error ?? '');
  if (code === 'not-found') {
    return t(language, 'adminDisabled');
  }
  if (code === 'auth') {
    return t(language, 'adminBadPassword');
  }
  return tError(language, error);
}

function GameCard({ language, game }: { language: Language; game: GameSummary }) {
  const filled = game.seats.filter((seat) => seat.userId || seat.isBot).length;
  const names = game.seats
    .map((seat) => {
      if (!seat.userId && !seat.isBot) {
        return t(language, 'emptySeat');
      }
      const host = seat.userId === game.createdBy ? ` (${t(language, 'host')})` : '';
      return `${seat.name}${host}`;
    })
    .join(', ');
  const waiting = game.pendingJoins.map((row) => row.username).join(', ');
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {game.code} · {game.mode === '2v2' ? t(language, 'mode2v2') : t(language, 'modeIndividual')}
      </Text>
      <Text style={styles.meta}>
        {game.status === 'playing' ? t(language, 'adminPlaying') : t(language, 'adminLobby')}
        {' · '}
        {t(language, 'adminSeats', { filled })}
      </Text>
      <Text style={styles.names}>{names}</Text>
      {waiting ? <Text style={styles.meta}>{`${t(language, 'joinRequests')}: ${waiting}`}</Text> : null}
      <Text style={styles.when}>{t(language, 'adminUpdated', { when: relativeTime(language, game.updatedAt) })}</Text>
    </View>
  );
}

export function AdminScreen({ language, onBack }: Props) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(storedToken);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (secret: string) => {
      if (!secret) {
        return false;
      }
      setBusy(true);
      try {
        const next = await fetchAdminGames(secret);
        setGames(next);
        setError(null);
        rememberToken(secret);
        setToken(secret);
        return true;
      } catch (caught) {
        setError(unlockError(language, caught));
        rememberToken('');
        setToken('');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [language],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    const first = setTimeout(() => {
      void load(token);
    }, 0);
    const timer = setInterval(() => {
      void load(token);
    }, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, token]);

  const unlock = () => {
    const secret = password.trim();
    if (!secret) {
      return;
    }
    void load(secret);
  };

  return (
    <LandscapeFrame
      title={t(language, 'adminTitle')}
      backLabel={t(language, 'back')}
      onBack={onBack}
      action={
        token ? <UiButton label={t(language, 'adminRefresh')} variant="ghost" onPress={() => void load(token)} /> : null
      }
    >
      <LandscapePane wide>
        {token ? (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {games.length === 0 && !error ? <Text style={styles.meta}>{t(language, 'adminEmpty')}</Text> : null}
            {games.map((game) => (
              <GameCard key={game.id} language={language} game={game} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.unlock}>
            <Text style={styles.label}>{t(language, 'adminPassword')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={unlock}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              secureTextEntry
              placeholder={t(language, 'adminPassword')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <UiButton label={t(language, 'adminUnlock')} onPress={unlock} disabled={busy || password.trim().length < 16} />
          </View>
        )}
      </LandscapePane>
    </LandscapeFrame>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  unlock: {
    maxWidth: 420,
    gap: spacing.sm,
    justifyContent: 'center',
    flex: 1,
  },
  label: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    color: colors.goldHi,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  names: {
    color: colors.cream,
    fontSize: 14,
  },
  when: {
    color: colors.sage,
    fontSize: 12,
  },
});
