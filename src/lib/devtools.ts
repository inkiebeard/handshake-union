/**
 * Browser console dev tools — only active in development builds.
 * Vite tree-shakes the entire module in production due to import.meta.env.DEV guards
 * at all call-sites, so this code never ships to users.
 *
 * Usage from the browser console:
 *   window.__hu_dev.help()
 *   window.__hu_dev.injectMessage({ image: true, imageState: 'loading' })
 *   window.__hu_dev.injectMessage({ link: 'https://github.com', linkState: 'timeout' })
 *   window.__hu_dev.clearDevMessages()
 */

import type { ChatRoom, Message } from '../types/database';

// Maps from fake URL → forced visual state.
// MessageImage and LinkPreview read these maps during their state initializers
// and effect guards so the components permanently stay in the requested state.
export const DEV_IMAGE_OVERRIDES = new Map<string, 'loading' | 'error'>();
export const DEV_LINK_OVERRIDES  = new Map<string, 'loading' | 'timeout'>();

// Track dev-injected message ids so clearDevMessages() can remove only those.
const _devMessageIds = new Set<string>();

interface InjectOpts {
  /** Body text of the message. */
  content?: string;
  /**
   * Inline image.
   * Pass a URL string to use that URL directly (no state override).
   * Pass `true` to generate a sample image URL.
   * Ignored when imageState is also set.
   */
  image?: string | boolean;
  /** Force the image into a permanent visual state, bypassing the real load. */
  imageState?: 'loading' | 'error';
  /**
   * Link preview URL.
   * Pass a URL string to use that URL directly (no state override).
   * Pass `true` to generate a sample link URL.
   * Ignored when linkState is also set.
   */
  link?: string | boolean;
  /** Force the link preview into a permanent visual state. */
  linkState?: 'loading' | 'timeout';
  /** Display name shown on the message. Defaults to 'dev_preview'. */
  author?: string;
  /** Room to inject into. Defaults to the currently-active room. */
  room?: ChatRoom;
}

export function initDevTools(
  setMessages: (fn: (prev: Message[]) => Message[]) => void,
  getRoom: () => ChatRoom | null,
) {
  function injectMessage(opts: InjectOpts = {}): string {
    const id = `__dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);

    let image_url: string | null = null;
    let link_url: string | null = null;

    // --- image ---
    if (opts.imageState) {
      const fakeUrl = `__dev_img_${opts.imageState}_${ts}_${rand}`;
      DEV_IMAGE_OVERRIDES.set(fakeUrl, opts.imageState);
      image_url = fakeUrl;
    } else if (opts.image) {
      image_url = typeof opts.image === 'string'
        ? opts.image
        : `https://picsum.photos/seed/${rand}/640/360`;
    }

    // --- link ---
    if (opts.linkState) {
      const fakeUrl = `https://dev.mock.local/link-${opts.linkState}-${ts}`;
      DEV_LINK_OVERRIDES.set(fakeUrl, opts.linkState);
      link_url = fakeUrl;
    } else if (opts.link) {
      link_url = typeof opts.link === 'string'
        ? opts.link
        : 'https://github.com/torvalds/linux';
    }

    if (!opts.content && !image_url && !link_url) {
      console.warn('__hu_dev.injectMessage: message needs at least one of content/image/link');
      return id;
    }

    const room: ChatRoom = opts.room ?? getRoom() ?? 'general';
    const msg: Message = {
      id,
      room,
      profile_id: '__dev__',
      content: opts.content ?? null,
      image_url,
      link_url,
      created_at: new Date().toISOString(),
      reply_to_id: null,
      profiles: { pseudonym: opts.author ?? 'dev_preview' },
    };

    setMessages(prev => [...prev, msg]);
    _devMessageIds.add(id);
    console.log(`[__hu_dev] injected message ${id}`);
    return id;
  }

  function removeMessage(id: string): void {
    setMessages(prev => prev.filter(m => m.id !== id));
    _devMessageIds.delete(id);
  }

  function clearDevMessages(): void {
    setMessages(prev => prev.filter(m => !_devMessageIds.has(m.id)));
    _devMessageIds.clear();
    console.log('[__hu_dev] cleared all dev messages');
  }

  function help(): void {
    console.log(`
window.__hu_dev — Handshake Union local dev tools
─────────────────────────────────────────────────

injectMessage(opts?)  →  string (message id)
  opts.content        string    — body text
  opts.image          string    — image URL (use true for a sample)
  opts.imageState     'loading' | 'error'    — freeze at this visual state
  opts.link           string    — link URL (use true for a sample)
  opts.linkState      'loading' | 'timeout'  — freeze at this visual state
  opts.author         string    — display name (default: 'dev_preview')
  opts.room           'general' | 'memes' | 'whinge'  — default: active room

removeMessage(id)     — remove one injected message
clearDevMessages()    — remove all injected messages

Examples:
  __hu_dev.injectMessage({ imageState: 'loading' })
  __hu_dev.injectMessage({ imageState: 'error' })
  __hu_dev.injectMessage({ image: true })
  __hu_dev.injectMessage({ linkState: 'loading' })
  __hu_dev.injectMessage({ linkState: 'timeout' })
  __hu_dev.injectMessage({ link: 'https://github.com' })
  __hu_dev.injectMessage({ content: 'hello', image: true, link: 'https://github.com' })
`.trim());
  }

  (window as Window & { __hu_dev?: unknown }).__hu_dev = {
    injectMessage,
    removeMessage,
    clearDevMessages,
    help,
  };

  console.log('[__hu_dev] dev tools ready — call __hu_dev.help() for usage');
}
