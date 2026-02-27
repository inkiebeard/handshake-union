/**
 * Module-level cache of image URL → natural dimensions.
 *
 * Populated by ChatContext before DOM mutations (loadOlderMessages) so that
 * MessageImage can initialise directly into the 'ready' state on first render —
 * skipping the loading skeleton and rendering at the correct intrinsic size
 * from the first paint.  This prevents post-paint layout shifts that would
 * corrupt the scroll-anchor restoration during pagination.
 */
export const imagePreloadCache = new Map<string, { naturalWidth: number; naturalHeight: number }>();

/** Preloads a single image URL and stores its dimensions. Always resolves. */
export function preloadImage(url: string): Promise<void> {
  if (imagePreloadCache.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      imagePreloadCache.set(url, { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

/** Preloads a list of URLs in parallel. Always resolves (individual failures are swallowed). */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(urls.map(preloadImage));
}
