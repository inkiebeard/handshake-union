#!/usr/bin/env node
/**
 * Local test harness for the og-preview Edge Function.
 *
 * Usage:
 *   node scripts/test-og-preview.mjs <url> [options]
 *
 * Options:
 *   --port <n>      Local Supabase API port (default: 54321)
 *   --anon <key>    Override the anon key (default: read from env or well-known local value)
 *   --raw           Print raw JSON response without annotations
 *
 * Prerequisites:
 *   1. Start the function with:
 *        npx supabase functions serve og-preview --no-verify-jwt
 *      Or with debugger:
 *        npx supabase functions serve og-preview --no-verify-jwt --inspect
 *      Then attach VS Code / Chrome DevTools to localhost:8083
 *
 *   2. Run this script:
 *        node scripts/test-og-preview.mjs https://example.com
 *        node scripts/test-og-preview.mjs https://youtu.be/dQw4w9WgXcQ
 *        node scripts/test-og-preview.mjs https://mywordpresssite.com/post
 */

import { execSync } from 'child_process';

// ── Parse CLI arguments ───────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: node scripts/test-og-preview.mjs <url> [options]

Options:
  --port <n>    Local Supabase API port  (default: 54321)
  --anon <key>  Override the anon/bearer key
  --raw         Print raw JSON without annotations

Examples:
  node scripts/test-og-preview.mjs https://youtu.be/dQw4w9WgXcQ
  node scripts/test-og-preview.mjs https://mysite.wordpress.com/post --raw
  node scripts/test-og-preview.mjs https://example.com --port 54321
  `);
  process.exit(0);
}

const targetUrl = args[0];
let port = 54321;
let anonKeyOverride = null;
let rawOutput = false;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) { port = Number(args[++i]); }
  else if (args[i] === '--anon' && args[i + 1]) { anonKeyOverride = args[++i]; }
  else if (args[i] === '--raw') { rawOutput = true; }
}

// ── Resolve anon key ──────────────────────────────────────────────────────────
// Priority: --anon flag → SUPABASE_ANON_KEY env → supabase status → well-known local default
const LOCAL_DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.' +
  'CRFA0NiK7W9oHo-zyi4lgkJjpZAOeVTrTa-oQ-9evQ';

function resolveAnonKey() {
  if (anonKeyOverride) return anonKeyOverride;
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  try {
    const status = execSync('npx supabase status 2>/dev/null', { encoding: 'utf8' });
    const match = status.match(/anon key\s*:\s*(\S+)/i);
    if (match?.[1]) return match[1];
  } catch { /* supabase not running or CLI unavailable */ }
  return LOCAL_DEFAULT_ANON_KEY;
}

const anonKey = resolveAnonKey();
const endpoint = `http://localhost:${port}/functions/v1/og-preview`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const GREY   = '\x1b[90m';

function label(text, colour = CYAN) { return `${colour}${BOLD}${text}${RESET}`; }
function val(v) {
  if (v === null || v === undefined) return `${DIM}null${RESET}`;
  if (typeof v === 'string' && v.startsWith('data:')) {
    return `${GREEN}[base64 data URL — ${Math.round(v.length / 1024)} KB]${RESET}`;
  }
  return `${GREEN}${JSON.stringify(v)}${RESET}`;
}

const FIELD_NOTES = {
  title:          'og:title → twitter:title → <title> fallback',
  description:    'og:description → twitter:description → <meta name="description">',
  image:          'og:image → twitter:image (proxied as base64)',
  url:            'og:url',
  siteName:       'og:site_name (or oEmbed provider_name)',
  type:           'og:type',
  imageWidth:     'og:image:width',
  imageHeight:    'og:image:height',
  imageAlt:       'og:image:alt',
  imageType:      'og:image:type',
  videoUrl:       'og:video / og:video:url',
  videoType:      'og:video:type',
  videoWidth:     'og:video:width',
  videoHeight:    'og:video:height',
  twitterCard:    'twitter:card',
  twitterSite:    'twitter:site',
  twitterCreator: 'twitter:creator',
  twitterImageAlt:'twitter:image:alt',
};

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(`\n${label('og-preview local test', CYAN)}`);
console.log(`${GREY}endpoint : ${endpoint}${RESET}`);
console.log(`${GREY}target   : ${targetUrl}${RESET}`);
console.log(`${GREY}anon key : ${anonKey.slice(0, 20)}…${RESET}\n`);

let res;
try {
  res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ url: targetUrl }),
  });
} catch (err) {
  console.error(`${RED}${BOLD}Connection error${RESET} — is the local stack and function running?`);
  console.error(`${DIM}Run: npm run functions:serve   (or functions:debug for breakpoints)${RESET}`);
  console.error(`${DIM}     This starts supabase locally then serves og-preview on port ${port}.${RESET}\n`);
  console.error(err.message);
  process.exit(1);
}

const body = await res.text();

if (rawOutput) {
  console.log(body);
  process.exit(res.ok ? 0 : 1);
}

if (!res.ok) {
  console.error(`${RED}${BOLD}HTTP ${res.status}${RESET}`);
  try { console.error(JSON.parse(body)); } catch { console.error(body); }
  process.exit(1);
}

let data;
try { data = JSON.parse(body); } catch {
  console.error(`${RED}Non-JSON response:${RESET}`, body);
  process.exit(1);
}

// ── Pretty-print with extraction source annotations ───────────────────────────
console.log(`${label('Response')} ${GREY}(HTTP ${res.status})${RESET}\n`);

const maxKey = Math.max(...Object.keys(FIELD_NOTES).map(k => k.length));

for (const [key, note] of Object.entries(FIELD_NOTES)) {
  const v = data[key];
  const pad = ' '.repeat(maxKey - key.length);
  const missing = v === null || v === undefined;
  const valueStr = val(v);
  const noteStr = missing ? `${YELLOW}${note}${RESET}` : `${GREY}${note}${RESET}`;
  console.log(`  ${label(key)}${pad}  ${valueStr}`);
  console.log(`  ${' '.repeat(maxKey)}  ${noteStr}`);
  console.log();
}

// Summary
const populated = Object.keys(FIELD_NOTES).filter(k => data[k] !== null && data[k] !== undefined);
const empty     = Object.keys(FIELD_NOTES).filter(k => data[k] === null || data[k] === undefined);

console.log(`${label('Summary')}`);
console.log(`  ${GREEN}populated${RESET}: ${populated.join(', ') || 'none'}`);
console.log(`  ${YELLOW}null${RESET}     : ${empty.join(', ') || 'none'}\n`);
