#!/usr/bin/env node
// Suspend or resume the Render game server. Secrets stay in env, never in the repo.
// Usage: node scripts/hosting.mjs start|stop|status [--quiet]
// Env: RENDER_API_KEY (required), RENDER_SERVICE_ID (optional), RENDER_SERVICE_NAME (default murlan-server)
// GitHub YAML treats the words on/off as booleans, so the workflow uses start/stop.

const RAW = (process.argv[2] ?? '').toLowerCase();
const ACTION =
  RAW === 'stop' || RAW === 'off' || RAW === 'false' ? 'off'
  : RAW === 'start' || RAW === 'on' || RAW === 'true' ? 'on'
  : RAW;
const QUIET = process.argv.includes('--quiet');
const KEY = (process.env.RENDER_API_KEY ?? '').trim();
const NAME = (process.env.RENDER_SERVICE_NAME ?? 'murlan-server').trim();
const FIXED_ID = (process.env.RENDER_SERVICE_ID ?? '').trim();
const API = 'https://api.render.com/v1';

if (!['on', 'off', 'status'].includes(ACTION)) {
  console.error('Usage: node scripts/hosting.mjs start|stop|status [--quiet]');
  process.exit(1);
}
if (KEY.length < 8) {
  console.error('Set RENDER_API_KEY (Render Dashboard → Account Settings → API Keys).');
  process.exit(1);
}

function log(message) {
  if (!QUIET) console.log(message);
}

async function api(path, method = 'GET') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${KEY}`,
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

async function resolveService() {
  if (FIXED_ID) {
    const got = await api(`/services/${encodeURIComponent(FIXED_ID)}`);
    const service = unwrapService(got.body) ?? got.body;
    if (!got.ok || !service?.id) {
      console.error(`Render did not find service ${FIXED_ID} (${got.status}).`);
      process.exit(1);
    }
    return service;
  }
  const listed = await api(`/services?name=${encodeURIComponent(NAME)}&limit=20`);
  if (!listed.ok || !Array.isArray(listed.body)) {
    console.error(`Could not list Render services (${listed.status}). Check RENDER_API_KEY.`);
    process.exit(1);
  }
  const matches = listed.body.map(unwrapService).filter((s) => s && s.name === NAME);
  if (matches.length === 0) {
    console.error(`No Render service named "${NAME}". Set RENDER_SERVICE_ID.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Several Render services named "${NAME}". Set RENDER_SERVICE_ID.`);
    process.exit(1);
  }
  return matches[0];
}

function isOff(service) {
  return service.suspended === 'suspended';
}

function printQuiet(service) {
  process.stdout.write(isOff(service) ? 'off\n' : 'on\n');
}

const service = await resolveService();
const currentlyOff = isOff(service);

if (ACTION === 'status') {
  if (QUIET) printQuiet(service);
  else log(`${service.name} (${service.id}) is ${currentlyOff ? 'off' : 'on'}.`);
  process.exit(0);
}

const wantOff = ACTION === 'off';
if (wantOff === currentlyOff) {
  if (QUIET) printQuiet(service);
  else log(`${service.name} is already ${currentlyOff ? 'off' : 'on'}.`);
  process.exit(0);
}

const path = wantOff ? `/services/${service.id}/suspend` : `/services/${service.id}/resume`;
const result = await api(path, 'POST');
if (result.status !== 202 && !result.ok) {
  console.error(`Render ${ACTION} failed (${result.status}).`);
  process.exit(1);
}
if (QUIET) process.stdout.write(wantOff ? 'off\n' : 'on\n');
else {
  log(wantOff ? `${service.name} is turning off.` : `${service.name} is turning on. Give it about a minute.`);
}
