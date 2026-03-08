const TIMEOUT_MS = 5_000;
const MAX_BYTES = 100 * 1024; // 100 KB — enough to capture <head> on any reasonable page

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Extract the content attribute of a <meta> tag by property or name.
// Handles both attribute orderings: property/name before content, and content before property/name.
function extractMeta(html: string, attr: 'property' | 'name', value: string): string | null {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+${attr}=["']${escaped}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // ── Auth: require a logged-in user ───────────────────────────────────────
  // The Supabase gateway already verifies the JWT signature before the request
  // reaches this function, so we only need to decode the payload (no extra
  // network round-trip) to confirm the caller is authenticated, not anonymous.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  try {
    const payloadB64 = authHeader.slice(7).split('.')[1];
    if (!payloadB64) throw new Error('malformed jwt');
    // base64url → base64 (add padding, swap URL-safe chars)
    const pad = payloadB64.length % 4;
    const padded = pad ? payloadB64 + '='.repeat(4 - pad) : payloadB64;
    const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role !== 'authenticated') return json({ error: 'unauthorized' }, 401);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }

  // ── Parse & validate the target URL ──────────────────────────────────────
  let targetUrl: string;
  try {
    const body = await req.json();
    targetUrl = body.url;
  } catch {
    return json({ error: 'invalid json body' }, 400);
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    return json({ error: 'url required' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return json({ error: 'invalid url' }, 400);
  }

  if (parsed.protocol !== 'https:') {
    return json({ error: 'https only' }, 400);
  }

  // ── Fetch the page HTML ───────────────────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok || !res.body) {
      return json({ error: 'upstream fetch failed' }, 502);
    }

    // Stream at most MAX_BYTES — meta tags are always in <head>, never at the bottom.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) { await reader.cancel(); break; }
      }
    } catch { /* stream aborted */ }

    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);

    // ── Extract Open Graph tags, fall back to Twitter Card ────────────────
    const title =
      extractMeta(html, 'property', 'og:title') ??
      extractMeta(html, 'name',     'twitter:title');

    const description =
      extractMeta(html, 'property', 'og:description') ??
      extractMeta(html, 'name',     'twitter:description');

    const image =
      extractMeta(html, 'property', 'og:image') ??
      extractMeta(html, 'name',     'twitter:image');

    return json({ title, description, image });
  } catch {
    return json({ error: 'failed to fetch' }, 502);
  }
});
