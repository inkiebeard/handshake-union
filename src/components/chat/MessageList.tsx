import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Message } from './Message';
import { MessageErrorBoundary } from './MessageErrorBoundary';
import type { Message as MessageType } from '../../types/database';
import type { ImageDisplayMode } from '../../hooks/useImageDisplayMode';

// Map of message_id -> emoji -> { count, reacted, reactionId }
export type ReactionMap = Map<
  string,
  Map<string, { count: number; reacted: boolean; reactionId?: string }>
>;

interface MessageListProps {
  messages: MessageType[];
  currentUserId: string | undefined;
  reactions: ReactionMap;
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  loadOlderError?: string | null;
  imageDisplayMode: ImageDisplayMode;
  onReply: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onLoadMore: () => void;
}

const NEAR_BOTTOM_THRESHOLD = 100;
const NEAR_TOP_THRESHOLD = 80;

export function MessageList({
  messages,
  currentUserId,
  reactions,
  loading,
  loadingOlder,
  hasMore,
  loadOlderError,
  imageDisplayMode,
  onReply,
  onDelete,
  onReport,
  onReaction,
  onLoadMore,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const isNearBottomRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

  // Scroll anchor: reference to the first message element + its content-space position at the
  // time load-more was triggered. Using a DOM element ref rather than scrollHeight means the
  // delta only reflects content prepended *before* the anchor — realtime-appended messages
  // are below it and don't affect its offsetTop, so concurrent broadcasts can't corrupt the
  // restoration. A diff of 0 (error path — nothing was prepended) is also a no-op.
  const scrollAnchorRef = useRef<{ element: HTMLElement; prevTop: number } | null>(null);

  const scrollToBottom = (smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  // Called by any image that finishes loading inside the list
  const handleImageLoad = () => {
    if (isNearBottomRef.current) {
      // Use rAF so the browser has committed the new layout height before we scroll
      requestAnimationFrame(() => scrollToBottom(false));
    }
  };

  const checkNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  };

  // Returns the element's position in the container's content space, independent of
  // CSS offsetParent chains. Reliable in useLayoutEffect before the browser paints.
  const getContentTop = (el: HTMLElement): number => {
    const container = containerRef.current;
    if (!container) return 0;
    return (
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop
    );
  };

  // Find the first message element (skip the load-older indicator at the top if present)
  // and save its content-space position as the scroll anchor.
  const handleLoadMore = () => {
    if (!containerRef.current || scrollAnchorRef.current) return;

    const inner = innerRef.current;
    if (!inner) return;

    let firstMsgEl: HTMLElement | null = null;
    for (const child of Array.from(inner.children)) {
      if (!(child as HTMLElement).classList.contains('chat-load-older-indicator')) {
        firstMsgEl = child as HTMLElement;
        break;
      }
    }
    if (!firstMsgEl) return;

    scrollAnchorRef.current = {
      element: firstMsgEl,
      prevTop: getContentTop(firstMsgEl),
    };
    onLoadMore();
  };

  const handleScroll = () => {
    const near = checkNearBottom();
    isNearBottomRef.current = near;
    if (near) setShowNewMessages(false);

    const el = containerRef.current;
    if (el && el.scrollTop < NEAR_TOP_THRESHOLD && hasMore && !loadingOlder) {
      handleLoadMore();
    }
  };

  // After older messages are prepended, restore the scroll position using the element anchor.
  // diff > 0 only when content was actually prepended before the anchor element — concurrent
  // realtime appends (below the anchor) produce no diff, and a failed fetch (no DOM change)
  // also produces no diff, so both cases are naturally no-ops.
  useLayoutEffect(() => {
    if (!loadingOlder && scrollAnchorRef.current && containerRef.current) {
      const { element, prevTop } = scrollAnchorRef.current;
      const diff = getContentTop(element) - prevTop;
      if (diff > 0) {
        containerRef.current.scrollTop += diff;
      }
      scrollAnchorRef.current = null;
    }
  // getContentTop is stable (only uses refs, not state), so it's safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingOlder]);

  // When new messages arrive: auto-scroll if at bottom, otherwise show banner
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
      setShowNewMessages(false);
    } else {
      setShowNewMessages(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Scroll to bottom instantly on initial load / room change
  useEffect(() => {
    isNearBottomRef.current = true;
    setShowNewMessages(false);
    scrollToBottom(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Single long-lived ResizeObserver on the inner wrapper.
  // Fires whenever any child (message, image, etc.) changes height — no need
  // to reconnect on every messages.length change.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    observerRef.current = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    });

    observerRef.current.observe(inner);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []); // mount/unmount only

  // Build a lookup for reply targets
  const messageMap = new Map(messages.map((m) => [m.id, m]));

  if (loading) {
    return (
      <div className="chat-message-list">
        <div className="chat-empty">
          <span className="comment">loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="chat-message-list">
        <div className="chat-empty">
          <span className="comment">no messages yet — be the first to say something</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-message-list-wrapper">
      <div className="chat-message-list" ref={containerRef} onScroll={handleScroll}>
        <div ref={innerRef}>
          {loadingOlder && (
            <div className="chat-load-older-indicator">
              <span className="comment">loading older messages...</span>
            </div>
          )}
          {!loadingOlder && loadOlderError && (
            <div className="chat-load-older-indicator">
              <button
                type="button"
                className="chat-load-older-btn chat-load-older-btn--error"
                onClick={handleLoadMore}
              >
                {loadOlderError}
              </button>
            </div>
          )}
          {!loadingOlder && !loadOlderError && hasMore && (
            <div className="chat-load-older-indicator">
              <button
                type="button"
                className="chat-load-older-btn"
                onClick={handleLoadMore}
              >
                &#8593; load older messages
              </button>
            </div>
          )}
          {messages.map((msg) => (
            <MessageErrorBoundary key={msg.id} messageId={msg.id}>
              <Message
                message={msg}
                currentUserId={currentUserId}
                reactions={reactions.get(msg.id) ?? new Map()}
                replyTarget={msg.reply_to_id ? messageMap.get(msg.reply_to_id) : undefined}
                imageDisplayMode={imageDisplayMode}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
                onReaction={onReaction}
                onImageLoad={handleImageLoad}
              />
            </MessageErrorBoundary>
          ))}
        </div>
      </div>

      {showNewMessages && (
        <button
          type="button"
          className="chat-new-messages-btn"
          onClick={() => {
            scrollToBottom();
            setShowNewMessages(false);
          }}
        >
          new messages &#8595;
        </button>
      )}
    </div>
  );
}
