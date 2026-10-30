// Adds a Content-Security-Policy to the exported web app so the page can only run its own
// bundle and only talk to the game server. GitHub Pages cannot send custom headers, so the
// policy is set with <meta http-equiv>.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = process.argv[2] ?? 'dist';
const relay = (process.env.EXPO_PUBLIC_RELAY_URL ?? '').trim().replace(/\/+$/, '');
if (!/^wss?:\/\/[^/\s]+$/i.test(relay)) {
  console.error(`EXPO_PUBLIC_RELAY_URL must look like wss://host, got "${relay}"`);
  process.exit(1);
}
const http = relay.replace(/^ws/i, 'http');

const policy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  `connect-src 'self' ${relay} ${http} data: blob:`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const file = `${dir}/index.html`;
const html = readFileSync(file, 'utf8');
if (html.includes('Content-Security-Policy')) {
  console.log('CSP already present');
  process.exit(0);
}
const tags = [
  `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
  '<meta name="referrer" content="no-referrer">',
].join('\n    ');
const out = html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    ${tags}`);
if (out === html) {
  console.error('could not find <meta charset> in index.html');
  process.exit(1);
}
writeFileSync(file, out);
console.log(`CSP added (connect-src ${relay})`);
