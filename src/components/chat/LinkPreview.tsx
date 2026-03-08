import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
}

// Module-level cache — shared across all LinkPreview instances.
// Fetched once per URL per session; covers both input previews and message cards.
const ogCache = new Map<string, OgData | null>();
// Deduplicates in-flight fetches so multiple components for the same URL share one request.
const pending = new Map<string, Promise<OgData | null>>();

async function fetchOg(url: string): Promise<OgData | null> {
  if (ogCache.has(url)) return ogCache.get(url) ?? null;
  if (pending.has(url)) return pending.get(url)!;

  const p = supabase.functions
    .invoke('og-preview', { body: { url } })
    .then(({ data, error }) => {
      const result = error || !data ? null : (data as OgData);
      ogCache.set(url, result);
      pending.delete(url);
      return result;
    })
    .catch(() => {
      ogCache.set(url, null);
      pending.delete(url);
      return null;
    });

  pending.set(url, p);
  return p;
}

// Skeleton card that mirrors the rich-card layout so the transition feels natural.
function PreviewSkeleton() {
  return (
    <div className="chat-link-preview-skeleton">
      <div className="chat-link-preview-skeleton-thumb" />
      <div className="chat-link-preview-skeleton-lines">
        <div className="chat-link-preview-skeleton-line" style={{ width: '58%' }} />
        <div className="chat-link-preview-skeleton-line" style={{ width: '86%' }} />
        <div className="chat-link-preview-skeleton-line" style={{ width: '30%' }} />
      </div>
    </div>
  );
}

// Client-side timeout — how long to wait for the edge function before giving up
// and falling back to the plain domain card.
const PREVIEW_TIMEOUT_MS = 30_000;

export function LinkPreview({ url }: { url: string }) {
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const [ogData, setOgData] = useState<OgData | null>(() => ogCache.get(url) ?? null);
  const [loading, setLoading] = useState(!ogCache.has(url));
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // URL already in cache — use it immediately, no fetch needed.
    if (ogCache.has(url)) {
      setOgData(ogCache.get(url) ?? null);
      setLoading(false);
      setTimedOut(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTimedOut(false);

    // Give up after PREVIEW_TIMEOUT_MS and show the plain domain fallback.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setTimedOut(true);
      }
    }, PREVIEW_TIMEOUT_MS);

    fetchOg(url).then((data) => {
      if (!cancelled) {
        clearTimeout(timeout);
        setOgData(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [url]);

  // Only render https:// OG images — prevents mixed-content issues and referrer leakage.
  const safeImage = ogData?.image?.startsWith('https://') ? ogData.image : null;
  const hasRichData = !loading && ogData && (ogData.title || ogData.description);

  return (
    <div className="chat-link-preview">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-link-preview-anchor"
      >
        {loading ? (
          <PreviewSkeleton />
        ) : hasRichData ? (
          <div className="chat-link-preview-rich">
            {safeImage && (
              <img
                src={safeImage}
                alt=""
                className="chat-link-preview-thumb"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="chat-link-preview-meta">
              {ogData.title && (
                <span className="chat-link-preview-title">{ogData.title}</span>
              )}
              {ogData.description && (
                <span className="chat-link-preview-desc">{ogData.description}</span>
              )}
              <span className="chat-link-preview-domain">&#128279; {hostname}</span>
            </div>
          </div>
        ) : (
          // Fallback: no OG data found, or timed out.
          <>
            <span className="chat-link-preview-domain">
              &#128279; {hostname}
              {timedOut && <span className="chat-link-preview-timeout"> (preview unavailable)</span>}
            </span>
            <span className="chat-link-preview-url">
              {url.length > 80 ? url.slice(0, 80) + '\u2026' : url}
            </span>
          </>
        )}
      </a>
    </div>
  );
}
