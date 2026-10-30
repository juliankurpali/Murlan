#!/usr/bin/env node
// Suspend or resume Render (game server) and/or Neon (database).
// Secrets stay in env, never in the repo.
// Usage: node scripts/hosting.mjs start|stop|status [server|database|both] [--quiet]
// GitHub YAML treats the words on/off as booleans, so the workflow uses start/stop.

const QUIET = process.argv.includes('--quiet');
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const RAW = (ARGS[0] ?? '').toLowerCase();
const ACTION =
  RAW === 'stop' || RAW === 'off' || RAW === 'false' ? 'off'
  : RAW === 'start' || RAW === 'on' || RAW === 'true' ? 'on'
  : RAW;
const WHAT_RAW = (ARGS[1] ?? 'both').toLowerCase();
const WHAT =
  WHAT_RAW === 'db' || WHAT_RAW === 'database' ? 'database'
  : WHAT_RAW === 'server' || WHAT_RAW === 'render' ? 'server'
  : WHAT_RAW === 'both' || WHAT_RAW === 'all' ? 'both'
  : WHAT_RAW;

if (!['on', 'off', 'status'].includes(ACTION) || !['server', 'database', 'both'].includes(WHAT)) {
  console.error('Usage: node scripts/hosting.mjs start|stop|status [server|database|both] [--quiet]');
  process.exit(1);
}

function log(message) {
  if (!QUIET) console.log(message);
}

async function jsonApi(base, path, key, method = 'GET') {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, body };
}

function unwrapService(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.service && typeof row.service === 'object') return row.service;
  if (row.id && row.name) return row;
  return null;
}

async function applyRender() {
  const key = (process.env.RENDER_API_KEY ?? '').trim();
  const name = (process.env.RENDER_SERVICE_NAME ?? 'murlan-server').trim();
  const fixedId = (process.env.RENDER_SERVICE_ID ?? '').trim();
  const api = 'https://api.render.com/v1';
  if (key.length < 8) {
    throw new Error('Set GitHub secret RENDER_API_KEY (Render → Account Settings → API Keys).');
  }
  const call = (path, method) => jsonApi(api, path, key, method);

  let service;
  if (fixedId) {
    const got = await call(`/services/${encodeURIComponent(fixedId)}`);
    service = unwrapService(got.body) ?? got.body;
    if (!got.ok || !service?.id) {
      throw new Error(`Render did not find service ${fixedId} (${got.status}).`);
    }
  } else {
    const listed = await call(`/services?name=${encodeURIComponent(name)}&limit=20`);
    if (!listed.ok || !Array.isArray(listed.body)) {
      throw new Error(`Could not list Render services (${listed.status}). Check RENDER_API_KEY.`);
    }
    const matches = listed.body.map(unwrapService).filter((s) => s && s.name === name);
    if (matches.length === 0) throw new Error(`No Render service named "${name}". Set RENDER_SERVICE_ID.`);
    if (matches.length > 1) throw new Error(`Several Render services named "${name}". Set RENDER_SERVICE_ID.`);
    service = matches[0];
  }

  const currentlyOff = service.suspended === 'suspended';
  const label = `${service.name} (${service.id})`;
  if (ACTION === 'status') {
    log(`Server ${label} is ${currentlyOff ? 'off' : 'on'}.`);
    return currentlyOff ? 'off' : 'on';
  }
  if ((ACTION === 'off') === currentlyOff) {
    log(`Server ${service.name} is already ${currentlyOff ? 'off' : 'on'}.`);
    return currentlyOff ? 'off' : 'on';
  }
  const path = ACTION === 'off' ? `/services/${service.id}/suspend` : `/services/${service.id}/resume`;
  const result = await call(path, 'POST');
  if (result.status !== 202 && !result.ok) {
    throw new Error(`Render ${ACTION} failed (${result.status}).`);
  }
  log(ACTION === 'off' ? `Server ${service.name} is turning off.` : `Server ${service.name} is turning on. Give it about a minute.`);
  return ACTION === 'off' ? 'off' : 'on';
}

function neonIdle(state) {
  const s = String(state ?? '').toLowerCase();
  return s === 'idle' || s === 'stopped' || s === 'suspended';
}

async function applyNeon() {
  const key = (process.env.NEON_API_KEY ?? '').trim();
  const api = 'https://console.neon.tech/api/v2';
  if (key.length < 8) {
    throw new Error('Set GitHub secret NEON_API_KEY (Neon Console → Account settings → API keys).');
  }
  const call = (path, method) => jsonApi(api, path, key, method);

  const projectIdEnv = (process.env.NEON_PROJECT_ID ?? '').trim();
  const endpointIdEnv = (process.env.NEON_ENDPOINT_ID ?? '').trim();
  let projectId = projectIdEnv;

  if (!projectId) {
    const listed = await call('/projects?search=murlan&limit=20');
    const projects = listed.body?.projects;
    if (!listed.ok || !Array.isArray(projects)) {
      throw new Error(`Could not list Neon projects (${listed.status}). Check NEON_API_KEY.`);
    }
    const named = projects.filter((p) => String(p.name ?? '').toLowerCase().includes('murlan'));
    const pick = named.length === 1 ? named[0] : projects.length === 1 ? projects[0] : null;
    if (!pick?.id) {
      throw new Error('Set GitHub secret NEON_PROJECT_ID (Neon project settings).');
    }
    projectId = pick.id;
  }

  let endpointId = endpointIdEnv;
  let currentState = '';
  if (endpointId) {
    const got = await call(`/projects/${encodeURIComponent(projectId)}/endpoints/${encodeURIComponent(endpointId)}`);
    const endpoint = got.body?.endpoint ?? got.body;
    if (!got.ok || !endpoint?.id) {
      throw new Error(`Neon did not find compute ${endpointId} (${got.status}).`);
    }
    endpointId = endpoint.id;
    currentState = endpoint.current_state ?? '';
  } else {
    const listed = await call(`/projects/${encodeURIComponent(projectId)}/endpoints`);
    const endpoints = listed.body?.endpoints;
    if (!listed.ok || !Array.isArray(endpoints) || endpoints.length === 0) {
      throw new Error(`No Neon computes on project ${projectId} (${listed.status}).`);
    }
    const primary = endpoints.find((e) => e.type === 'read_write') ?? endpoints[0];
    endpointId = primary.id;
    currentState = primary.current_state ?? '';
  }

  const currentlyOff = neonIdle(currentState);
  const label = `database ${projectId} / ${endpointId}`;
  if (ACTION === 'status') {
    log(`${label} is ${currentlyOff ? 'off' : 'on'} (${currentState || 'unknown'}). Player rows are kept either way.`);
    return currentlyOff ? 'off' : 'on';
  }
  if ((ACTION === 'off') === currentlyOff) {
    log(`Database is already ${currentlyOff ? 'off' : 'on'}.`);
    return currentlyOff ? 'off' : 'on';
  }
  const path = ACTION === 'off'
    ? `/projects/${projectId}/endpoints/${endpointId}/suspend`
    : `/projects/${projectId}/endpoints/${endpointId}/start`;
  const result = await call(path, 'POST');
  if (!result.ok) {
    throw new Error(`Neon ${ACTION} failed (${result.status}): ${result.body?.message ?? ''}`.trim());
  }
  log(
    ACTION === 'off'
      ? 'Database compute is turning off. Saved players stay in Neon; nothing is deleted.'
      : 'Database compute is turning on. It may take a few seconds.',
  );
  return ACTION === 'off' ? 'off' : 'on';
}

const wantServer = WHAT === 'server' || WHAT === 'both';
const wantDatabase = WHAT === 'database' || WHAT === 'both';
const states = [];

try {
  // Stop the server first so it cannot immediately wake Neon. Start Neon first so the server can connect.
  if (ACTION === 'off') {
    if (wantServer) states.push(await applyRender());
    if (wantDatabase) states.push(await applyNeon());
  } else if (ACTION === 'on') {
    if (wantDatabase) states.push(await applyNeon());
    if (wantServer) states.push(await applyRender());
  } else {
    if (wantServer) states.push(await applyRender());
    if (wantDatabase) states.push(await applyNeon());
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

if (QUIET) {
  const off = states.length > 0 && states.every((s) => s === 'off');
  process.stdout.write(off ? 'off\n' : 'on\n');
}
