const TIMEOUT_MS = 5_000;
const MAX_BYTES = 100 * 1024;       // 100 KB — enough to capture <head> on any reasonable page
const IMAGE_MAX_BYTES = 200 * 1024; // 200 KB — cap proxied OG thumbnail size
const IMAGE_TIMEOUT_MS = 3_000;     // separate timeout for the image fetch

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

// Priority chains for each supported field name.
// og:* entries are tried with both property= and name= (covers spec-compliant and name= sites).
// twitter:* entries are tried with name= only.
const META_KEYS: Record<string, string[]> = {
  title:               ['og:title',            'twitter:title'],
  description:         ['og:description',       'twitter:description'],
  image:               ['og:image',             'twitter:image'],
  url:                 ['og:url',               'twitter:url'],
  site_name:           ['og:site_name'],
  type:                ['og:type'],
  'image:width':       ['og:image:width'],
  'image:height':      ['og:image:height'],
  'image:alt':         ['og:image:alt',         'twitter:image:alt'],
  'image:type':        ['og:image:type'],
  video:               ['og:video',             'og:video:url',       'og:video:secure_url'],
  'video:type':        ['og:video:type'],
  'video:width':       ['og:video:width'],
  'video:height':      ['og:video:height'],
  'twitter:card':      ['twitter:card'],
  'twitter:site':      ['twitter:site'],
  'twitter:creator':   ['twitter:creator'],
  'twitter:image:alt': ['twitter:image:alt'],
};

// Extract the content of a <meta> tag for a given field name.
// Tries each key in the field's priority chain; og:* keys are matched against both
// property= and name= attributes; twitter:* keys against name= only.
function extractMeta(html: string, field: string): string | null {
  const keys = META_KEYS[field] ?? [field];
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrs = key.startsWith('og:') ? ['property', 'name'] : ['name'];
    for (const attr of attrs) {
      const m =
        html.match(new RegExp(`<meta[^>]+${attr}=["']${esc}["'][^>]+content=["']([^"'<>]+)["']`, 'i')) ??
        html.match(new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+${attr}=["']${esc}["']`, 'i'));
      if (m?.[1]) return m[1].trim();
    }
  }
  return null;
}

// Returns true if the hostname is safe to fetch (not private/loopback/link-local).
function isSafeHost(host: string): boolean {
  const h = host.toLowerCase();
  return !(
    h === 'localhost' || h === 'localhost.' || h.endsWith('.localhost') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||   // IPv4 link-local
    h === '::1' ||
    /^f[cd]/i.test(h) ||       // IPv6 unique-local (fc00::/7)
    /^fe80:/i.test(h)           // IPv6 link-local
  );
}

// Validate a URL is safe to fetch as an image proxy target.
// Returns the parsed URL on success, or null if it fails any check.
function validateProxyUrl(raw: string, base?: string): URL | null {
  let u: URL;
  try { u = new URL(raw, base); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '443') return null;
  if (!isSafeHost(u.hostname)) return null;
  return u;
}

// Fetch an image URL server-side and return it as a base64 data URL.
// This keeps the viewer's IP from ever reaching the third-party CDN.
// Returns null on any failure (timeout, non-image content-type, size exceeded, etc.).
async function proxyImage(imageUrl: string): Promise<string | null> {
  const u = validateProxyUrl(imageUrl);
  if (!u) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    let res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)',
        'Accept': 'image/*',
      },
    });

    // Follow at most one redirect, re-validating the destination.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      const redirected = validateProxyUrl(location, imageUrl);
      if (!redirected) return null;
      res = await fetch(redirected.toString(), {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)',
          'Accept': 'image/*',
        },
      });
    }

    if (!res.ok || !res.body) return null;

    // Only proxy actual images — reject HTML error pages, etc.
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ct.startsWith('image/')) return null;

    // Stream up to IMAGE_MAX_BYTES.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
        if (total >= IMAGE_MAX_BYTES) { await reader.cancel(); break; }
      }
    } catch { /* stream aborted or size-capped */ }

    if (chunks.length === 0) return null;

    // Assemble bytes and encode as base64 data URL.
    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }

    // Build base64 via loop — avoids spread-induced stack overflow on large buffers.
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(binary)}`;

  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // ── Auth: require a logged-in user ───────────────────────────────────────
  // The Supabase gateway verifies the JWT signature before the request reaches
  // this function (verify_jwt is enabled at deploy time). If the function is
  // executing, the caller is already authenticated. We still require an
  // Authorization Bearer header as belt-and-suspenders defence in case the
  // gateway configuration changes, but we do NOT re-decode the JWT manually —
  // supabase-js 2.95+ with publishable keys can deliver the auth context via a
  // path that doesn't surface a standard Bearer token to Deno's request headers,
  // which caused a spurious 401 from the old manual atob/JSON.parse check.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Could not find bearer authorization' }, 401);

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

  // Block credentials in the URL (prevents proxying authenticated requests)
  if (parsed.username || parsed.password) {
    return json({ error: 'credentials not allowed in url' }, 400);
  }

  // Restrict to standard HTTPS port only (empty string = default 443)
  if (parsed.port && parsed.port !== '443') {
    return json({ error: 'only port 443 is permitted' }, 400);
  }

  // Block private, loopback, and link-local address ranges to prevent SSRF
  // (internal network probing, cloud metadata endpoints such as 169.254.169.254, etc.)
  if (!isSafeHost(parsed.hostname)) {
    return json({ error: 'private network addresses are not allowed' }, 400);
  }

  // ── Fetch the page HTML ───────────────────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      // Do not auto-follow redirects — we must re-validate the destination
      // before following, to ensure a redirect cannot bypass the SSRF guards above.
      res = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      // Follow at most one redirect, re-validating the destination URL.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return json({ error: 'upstream redirect missing location' }, 502);

        const redirected = new URL(location, targetUrl);
        if (redirected.protocol !== 'https:')
          return json({ error: 'https only' }, 400);
        if (redirected.port && redirected.port !== '443')
          return json({ error: 'only port 443 is permitted' }, 400);
        if (!isSafeHost(redirected.hostname))
          return json({ error: 'private network addresses are not allowed' }, 400);

        res = await fetch(redirected.toString(), {
          signal: controller.signal,
          redirect: 'error',   // no further hops
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
      }
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

    // ── Extract Open Graph / Twitter Card metadata ─────────────────────────
    const title       = extractMeta(html, 'title');
    const description = extractMeta(html, 'description');

    // OG images are proxied server-side so the viewer's IP never reaches the
    // third-party CDN (AGENTS.md §7).  proxyImage() applies the same SSRF
    // guards as the page fetch and returns a base64 data URL, or null on failure.
    const rawImageUrl = extractMeta(html, 'image');
    const image = rawImageUrl ? await proxyImage(rawImageUrl) : null;

    const url      = extractMeta(html, 'url');
    const siteName = extractMeta(html, 'site_name');
    const type     = extractMeta(html, 'type');

    // Image metadata
    const imageWidth  = extractMeta(html, 'image:width');
    const imageHeight = extractMeta(html, 'image:height');
    const imageAlt    = extractMeta(html, 'image:alt');
    const imageType   = extractMeta(html, 'image:type');

    // Video metadata (YouTube, Vimeo, etc.)
    const videoUrl    = extractMeta(html, 'video');
    const videoType   = extractMeta(html, 'video:type');
    const videoWidth  = extractMeta(html, 'video:width');
    const videoHeight = extractMeta(html, 'video:height');

    // Twitter Card specific
    const twitterCard     = extractMeta(html, 'twitter:card');
    const twitterSite     = extractMeta(html, 'twitter:site');
    const twitterCreator  = extractMeta(html, 'twitter:creator');
    const twitterImageAlt = extractMeta(html, 'twitter:image:alt');

    return json({
      title,
      description,
      image,
      url,
      siteName,
      type,
      imageWidth,
      imageHeight,
      imageAlt,
      imageType,
      videoUrl,
      videoType,
      videoWidth,
      videoHeight,
      twitterCard,
      twitterSite,
      twitterCreator,
      twitterImageAlt,
    });
  } catch {
    return json({ error: 'failed to fetch' }, 502);
  }
});
