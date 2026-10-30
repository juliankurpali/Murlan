import pg from 'pg';
import { PlatformSnapshot } from '../src/platform/types';

const ROW_ID = 'platform';
const WRITE_EVERY_MS = 5_000;

export type Persistence = {
  initial: PlatformSnapshot | null;
  onSave: (snapshot: PlatformSnapshot) => void;
  flush: () => Promise<void>;
};

export async function openPostgres(url: string): Promise<Persistence> {
  const pool = new pg.Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 30_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  });
  await pool.query(
    'create table if not exists murlan_state (id text primary key, data jsonb not null, updated_at timestamptz not null default now())',
  );
  const found = await pool.query<{ data: PlatformSnapshot }>('select data from murlan_state where id = $1', [ROW_ID]);
  const initial = found.rows[0]?.data ?? null;

  let latest: PlatformSnapshot | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> | null = null;

  const write = async () => {
    timer = null;
    if (!latest) {
      return;
    }
    const data = JSON.stringify(latest);
    latest = null;
    try {
      await pool.query(
        'insert into murlan_state (id, data, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set data = excluded.data, updated_at = now()',
        [ROW_ID, data],
      );
    } catch (error) {
      console.error('persist failed, will retry', error instanceof Error ? error.message : error);
      if (!latest) {
        latest = JSON.parse(data) as PlatformSnapshot;
      }
      timer ??= setTimeout(run, WRITE_EVERY_MS);
    }
  };

  const run = () => {
    writing = (writing ?? Promise.resolve()).then(write).finally(() => {
      writing = null;
    });
  };

  return {
    initial,
    onSave(snapshot) {
      latest = snapshot;
      timer ??= setTimeout(run, WRITE_EVERY_MS);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await writing;
      await write();
      await pool.end();
    },
  };
}
