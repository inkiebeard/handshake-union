import { useCallback, useEffect, useRef, useState } from 'react';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API as string;

// Cached once per page session — used as a privacy-safe proxy for the user
let sessionRandomId = '';

async function ensureRandomId(): Promise<string> {
  if (sessionRandomId) return sessionRandomId;
  try {
    const res = await fetch(`https://api.giphy.com/v1/randomid?api_key=${GIPHY_API_KEY}`);
    const data = await res.json();
    sessionRandomId = (data?.data?.random_id as string) ?? '';
  } catch {
    // Non-fatal — analytics will still fire without it
  }
  return sessionRandomId;
}

/** Fire-and-forget GIPHY analytics pingback. Appends required ts + random_id params. */
export function fireGiphyAnalytics(pingbackUrl: string): void {
  if (!pingbackUrl) return;
  try {
    const url = new URL(pingbackUrl);
    url.searchParams.set('ts', Date.now().toString());
    if (sessionRandomId) url.searchParams.set('random_id', sessionRandomId);
    fetch(url.toString()).catch(() => {});
  } catch {
    // Ignore malformed URLs
  }
}

interface GiphyAnalytics {
  onloadUrl: string;
  onclickUrl: string;
  onsentUrl: string;
}

interface GiphyGif {
  id: string;
  /** URL stored in the message — downsized (<2MB) with fallback to original */
  url: string;
  /** WebP preview URL for the picker grid */
  previewUrl: string;
  alt: string;
  analytics: GiphyAnalytics;
}

interface GiphyPickerProps {
  /** Called with the GIF's display URL and its onsent analytics URL */
  onSelect: (url: string, onsentUrl: string) => void;
  onClose: () => void;
}

const LIMIT = 18;

type RawImages = Record<string, { url?: string; webp?: string; width?: string; height?: string; mp4?: string }>;
type RawAnalytics = { onload?: { url?: string }; onclick?: { url?: string }; onsent?: { url?: string } };

interface FetchResult {
  gifs: GiphyGif[];
  totalCount: number;
}

async function fetchGifs(searchQuery: string, offset: number, signal?: AbortSignal): Promise<FetchResult> {
  const randomId = await ensureRandomId();
  const base = searchQuery.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=${LIMIT}&offset=${offset}&rating=pg-13&lang=en`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${LIMIT}&offset=${offset}&rating=pg-13`;

  const endpoint = randomId ? `${base}&random_id=${randomId}` : base;
  const res = await fetch(endpoint, { signal });
  if (!res.ok) throw new Error('giphy request failed');
  const data = await res.json();

  const gifs = (data.data as Record<string, unknown>[]).map((g) => {
    const images = g.images as RawImages;
    const analytics = (g.analytics ?? {}) as RawAnalytics;

    // Best practice: use fixed_width webp for grid previews
    const previewUrl = images.fixed_width?.webp ?? images.fixed_width?.url ?? '';

    // Best practice: use downsized (<2MB) for the sent message, fall back to original
    const messageUrl = images.downsized?.url ?? images.original?.url ?? '';

    return {
      id: g.id as string,
      url: messageUrl,
      previewUrl,
      alt: (g.alt_text as string) || (g.title as string) || 'GIF',
      analytics: {
        onloadUrl: analytics.onload?.url ?? '',
        onclickUrl: analytics.onclick?.url ?? '',
        onsentUrl: analytics.onsent?.url ?? '',
      },
    };
  });

  return {
    gifs,
    totalCount: (data.pagination?.total_count as number) ?? 0,
  };
}

interface HoveredGif {
  gif: GiphyGif;
  rect: DOMRect;
}

export function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredGif, setHoveredGif] = useState<HoveredGif | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  const load = useCallback(async (q: string, nextOffset: number, append: boolean) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const { gifs: results, totalCount } = await fetchGifs(q, nextOffset, signal);
      setGifs((prev) => append ? [...prev, ...results] : results);
      setOffset(nextOffset);
      setHasMore(nextOffset + LIMIT < totalCount);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('failed to load GIFs');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
    load('', 0, false);
  }, [load]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!hoveredGif || window.matchMedia('(hover: hover)').matches) return;
    const dismiss = () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      setHoveredGif(null);
    };
    document.addEventListener('touchstart', dismiss, { once: true, passive: true });
    return () => document.removeEventListener('touchstart', dismiss);
  }, [hoveredGif]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value, 0, false), 400);
  };

  const PREVIEW_W = 220;
  const PREVIEW_H = 220;
  const PREVIEW_PAD = 8;
  const isHoverDevice = window.matchMedia('(hover: hover)').matches;
  let previewStyle: React.CSSProperties | undefined;
  if (hoveredGif) {
    if (isHoverDevice) {
      const { rect } = hoveredGif;
      let left = rect.left - PREVIEW_W - PREVIEW_PAD;
      if (left < PREVIEW_PAD) left = rect.right + PREVIEW_PAD;
      left = Math.min(left, window.innerWidth - PREVIEW_W - PREVIEW_PAD);
      let top = rect.top + rect.height / 2 - PREVIEW_H / 2;
      top = Math.max(PREVIEW_PAD, Math.min(top, window.innerHeight - PREVIEW_H - PREVIEW_PAD));
      previewStyle = { left, top };
    } else {
      previewStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }
  }

  return (
    <>
    <div className="giphy-picker">
      <div className="giphy-picker-header">
        <input
          ref={searchRef}
          className="giphy-search-input"
          type="text"
          placeholder="search GIFs..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoComplete="off"
        />
        <button type="button" className="giphy-close-btn" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      <div className="giphy-grid-container">
        {error && <div className="giphy-status">{error}</div>}
        {loading && <div className="giphy-status">loading...</div>}
        {!loading && !error && gifs.length === 0 && query && (
          <div className="giphy-status">no results for "{query}"</div>
        )}
        {!loading && !error && (
          <>
            <div className="giphy-grid">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className="giphy-gif-btn"
                  onClick={() => {
                    if (longPressedRef.current) { longPressedRef.current = false; return; }
                    fireGiphyAnalytics(gif.analytics.onclickUrl);
                    onSelect(gif.url, gif.analytics.onsentUrl);
                    onClose();
                  }}
                  onMouseEnter={(e) => {
                    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                    const rect = e.currentTarget.getBoundingClientRect();
                    previewTimerRef.current = setTimeout(() => setHoveredGif({ gif, rect }), 500);
                  }}
                  onMouseLeave={() => {
                    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                    setHoveredGif(null);
                  }}
                  onTouchStart={(e) => {
                    longPressedRef.current = false;
                    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                    const touch = e.touches[0];
                    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                    const rect = e.currentTarget.getBoundingClientRect();
                    previewTimerRef.current = setTimeout(() => {
                      setHoveredGif({ gif, rect });
                      longPressedRef.current = true;
                    }, 600);
                  }}
                  onTouchMove={(e) => {
                    if (!touchStartRef.current) return;
                    const touch = e.touches[0];
                    const dx = touch.clientX - touchStartRef.current.x;
                    const dy = touch.clientY - touchStartRef.current.y;
                    if (Math.hypot(dx, dy) > 10) {
                      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                      setHoveredGif(null);
                      touchStartRef.current = null;
                    }
                  }}
                  onTouchEnd={() => {
                    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                    touchStartRef.current = null;
                    dismissTimerRef.current = setTimeout(() => setHoveredGif(null), 1500);
                  }}
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.alt}
                    loading="lazy"
                    onLoad={() => fireGiphyAnalytics(gif.analytics.onloadUrl)}
                  />
                </button>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                className="giphy-more-btn"
                onClick={() => load(query, offset + LIMIT, true)}
                disabled={loadingMore}
              >
                {loadingMore ? 'loading...' : 'more'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="giphy-attribution">
        Powered By <strong>GIPHY</strong>
      </div>
    </div>

    {hoveredGif && previewStyle && (
      <div className="giphy-hover-preview" style={previewStyle}>
        <img
          src={hoveredGif.gif.url}
          alt={hoveredGif.gif.alt}
          referrerPolicy="no-referrer"
        />
      </div>
    )}
    </>
  );
}
