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

export function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value, 0, false), 400);
  };

  return (
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
                    fireGiphyAnalytics(gif.analytics.onclickUrl);
                    onSelect(gif.url, gif.analytics.onsentUrl);
                    onClose();
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
  );
}
