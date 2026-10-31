#!/usr/bin/env node
// Deploy a specific git commit to the Render game server.
// Secrets stay in env. Usage: node scripts/deploy-render.mjs [commitSha]

const key = (process.env.RENDER_API_KEY ?? '').trim();
const name = (process.env.RENDER_SERVICE_NAME ?? 'murlan-server').trim();
const fixedId = (process.env.RENDER_SERVICE_ID ?? '').trim();
const commitId = (process.argv[2] ?? process.env.GITHUB_SHA ?? '').trim();
const api = 'https://api.render.com/v1';

if (key.length < 8) {
  throw new Error('Set RENDER_API_KEY.');
}
if (!/^[0-9a-f]{7,40}$/i.test(commitId)) {
  throw new Error('Pass a git commit SHA (or set GITHUB_SHA).');
}

function unwrapService(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.service && typeof row.service === 'object') return row.service;
  if (row.id && row.name) return row;
  return null;
}

async function call(path, method = 'GET', body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

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
    throw new Error(`Could not list Render services (${listed.status}).`);
  }
  const matches = listed.body.map(unwrapService).filter((row) => row && row.name === name);
  if (matches.length !== 1) {
    throw new Error(`Set RENDER_SERVICE_ID (found ${matches.length} services named "${name}").`);
  }
  service = matches[0];
}

if (service.suspended === 'suspended') {
  const resumed = await call(`/services/${service.id}/resume`, 'POST');
  if (resumed.status !== 202 && !resumed.ok) {
    throw new Error(`Render resume failed (${resumed.status}).`);
  }
  console.log(`Server ${service.name} was off; turning it on.`);
}

const deploy = await call(`/services/${service.id}/deploys`, 'POST', {
  clearCache: 'do_not_clear',
  commitId,
});
if (deploy.status !== 201 && deploy.status !== 202 && !deploy.ok) {
  throw new Error(`Render deploy failed (${deploy.status}): ${JSON.stringify(deploy.body)}`);
}
const id = deploy.body?.id ?? deploy.body?.deploy?.id ?? 'queued';
console.log(`Render ${service.name} is building commit ${commitId.slice(0, 7)} (${id}).`);
