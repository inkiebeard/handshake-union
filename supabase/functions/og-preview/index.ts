const TIMEOUT_MS = 10_000;
const MAX_BYTES = 150 * 1024;         // 150 KB — enough to capture <head> on any reasonable page
const IMAGE_MAX_BYTES = 200 * 1024;   // 200 KB — cap proxied OG thumbnail size
const IMAGE_TIMEOUT_MS = 5_000;       // separate timeout for the image fetch
const OEMBED_MAX_BYTES = 50 * 1024;   // 50 KB — generous for any JSON oEmbed response

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
  description:         ['og:description',       'twitter:description',  'description'],
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

// Extract the contents of the HTML <title> element as a fallback when OG/Twitter title is absent.
function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return m?.[1]?.trim() || null;
}

// Parse the JSON oEmbed discovery URL from a page's <link> tag.
// WordPress, Vimeo, Flickr, Soundcloud, and many others publish this.
// Returns a resolved absolute URL string, or null if not present.
function extractOembedDiscoveryUrl(html: string, base: string): string | null {
  const m =
    html.match(/<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"'<>]+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"'<>]+)["'][^>]+type=["']application\/json\+oembed["']/i);
  if (!m?.[1]) return null;
  try { return new URL(m[1].trim(), base).toString(); } catch { return null; }
}

// Fetch a generic oEmbed endpoint and return whichever fields are present.
// Uses redirect: 'manual' and re-validates each hop through validateUrl/isSafeHost
// so a page-controlled oEmbed URL cannot redirect to a private/link-local address (SSRF).
// Response body is streamed with a hard cap — oEmbed JSON is never large.
async function fetchGenericOembed(
  oembedUrl: string,
  signal: AbortSignal,
  validateUrl: (raw: string, base?: string) => URL | null,
): Promise<{ title?: string; thumbnailUrl?: string; authorName?: string; siteName?: string } | null> {
  let currentUrl = validateUrl(oembedUrl);
  if (!currentUrl) return null;
  const MAX_HOPS = 3;
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const res = await fetch(currentUrl.toString(), {
        signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)' },
      });

      // Follow redirects manually, re-validating each destination.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        const next = validateUrl(location, currentUrl.toString());
        if (!next) return null;
        currentUrl = next;
        continue;
      }

      if (!res.ok || !res.body) return null;

      // Stream with a size cap — oEmbed JSON is never large.
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          total += value.length;
          if (total >= OEMBED_MAX_BYTES) { await reader.cancel(); break; }
        }
      } catch { /* stream aborted or size-capped */ }

      if (chunks.length === 0) return null;
      const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.length; }
      const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { return null; }

      return {
        title:        typeof data.title          === 'string' ? data.title          : undefined,
        thumbnailUrl: typeof data.thumbnail_url  === 'string' ? data.thumbnail_url  : undefined,
        authorName:   typeof data.author_name    === 'string' ? data.author_name    : undefined,
        siteName:     typeof data.provider_name  === 'string' ? data.provider_name  : undefined,
      };
    }
    return null; // exceeded max redirect hops
  } catch {
    return null;
  }
}

// Returns the YouTube video ID for youtu.be/<id> and youtube.com/watch?v=<id> URLs.
function getYoutubeVideoId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    // pathname can be /<id>, /<id>/, or /<id>/extra — extract the first non-empty segment only.
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return id || null;
  }
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' ||
      url.hostname === 'm.youtube.com') {
    return url.searchParams.get('v');
  }
  return null;
}

// Fetch YouTube oEmbed metadata. Returns structured data or null on failure.
// oEmbed is a public, stable endpoint — no API key required.
async function fetchYoutubeOembed(
  videoUrl: string,
  signal: AbortSignal,
): Promise<{ title: string; thumbnailUrl: string; authorName: string } | null> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  try {
    const res = await fetch(oembedUrl, {
      signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HandshakeUnionBot/1.0)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const title        = typeof data.title         === 'string' ? data.title         : null;
    const thumbnailUrl = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null;
    const authorName   = typeof data.author_name   === 'string' ? data.author_name   : null;
    if (!title) return null;
    return { title, thumbnailUrl: thumbnailUrl ?? '', authorName: authorName ?? '' };
  } catch {
    return null;
  }
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

  // ── YouTube: resolve short URL then use oEmbed for structured metadata ───
  // youtu.be/<id> and youtube.com/watch?v=<id> URLs don't expose OG tags in
  // the first 150 KB of HTML because Google injects them deeper in the page.
  // YouTube's public oEmbed endpoint gives us title + thumbnail reliably.
  const ytVideoId = getYoutubeVideoId(parsed);
  if (ytVideoId) {
    const canonicalUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const oembed = await fetchYoutubeOembed(canonicalUrl, controller.signal);
      if (oembed) {
        const image = oembed.thumbnailUrl ? await proxyImage(oembed.thumbnailUrl) : null;
        return json({
          title: oembed.title,
          description: null,
          image,
          url: canonicalUrl,
          siteName: 'YouTube',
          type: 'video',
          imageWidth: null,
          imageHeight: null,
          imageAlt: oembed.title,
          imageType: null,
          videoUrl: canonicalUrl,
          videoType: 'text/html',
          videoWidth: null,
          videoHeight: null,
          twitterCard: 'player',
          twitterSite: '@youtube',
          twitterCreator: oembed.authorName || null,
          twitterImageAlt: null,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
    // oEmbed failed — fall through to normal HTML fetch below
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
    console.log(`From target: ${targetUrl} received: ${html}`)

    // ── Extract Open Graph / Twitter Card metadata ─────────────────────────
    // Fall back to <title> element if no OG/Twitter title meta tag is found.
    let title       = extractMeta(html, 'title') ?? extractHtmlTitle(html);
    let description = extractMeta(html, 'description');
    let rawImageUrl = extractMeta(html, 'image');
    let siteName    = extractMeta(html, 'site_name');

    // ── oEmbed discovery fallback ───────────────────────────────────────────
    // WordPress (and many other platforms) publish a <link type="application/json+oembed">
    // discovery tag in <head>. If any key fields are still missing after OG extraction,
    // try that endpoint — no API key required, works for any oEmbed-capable site.
    if (!title || !rawImageUrl) {
      const oembedDiscoveryUrl = extractOembedDiscoveryUrl(html, targetUrl);
      if (oembedDiscoveryUrl) {
        const oembedCtrl    = new AbortController();
        const oembedTimeout = setTimeout(() => oembedCtrl.abort(), IMAGE_TIMEOUT_MS);
        try {
          const oembed = await fetchGenericOembed(oembedDiscoveryUrl, oembedCtrl.signal, validateProxyUrl);
          if (oembed) {
            title       ??= oembed.title;
            rawImageUrl ??= oembed.thumbnailUrl;
            siteName    ??= oembed.siteName;
            // description is rarely provided by oEmbed; leave as-is
          }
        } finally {
          clearTimeout(oembedTimeout);
        }
      }
    }

    // OG images are proxied server-side so the viewer's IP never reaches the
    // third-party CDN (AGENTS.md §7).  proxyImage() applies the same SSRF
    // guards as the page fetch and returns a base64 data URL, or null on failure.
    const image = rawImageUrl ? await proxyImage(rawImageUrl) : null;

    const url      = extractMeta(html, 'url');
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

    console.log(`Outputting`, {
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
    })

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
