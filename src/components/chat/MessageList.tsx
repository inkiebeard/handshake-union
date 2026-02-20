import { useEffect, useRef, useState } from 'react';
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
  imageDisplayMode: ImageDisplayMode;
  onReply: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

const NEAR_BOTTOM_THRESHOLD = 100;

export function MessageList({
  messages,
  currentUserId,
  reactions,
  loading,
  imageDisplayMode,
  onReply,
  onDelete,
  onReport,
  onReaction,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

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

  const handleScroll = () => {
    const near = checkNearBottom();
    isNearBottomRef.current = near;
    if (near) setShowNewMessages(false);
  };

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

  // Re-scroll when content height grows (e.g. images finishing loading) while tracking bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    // Observe the inner scroll content so any height change (image load, etc.) triggers a re-scroll
    for (const child of Array.from(el.children)) {
      observer.observe(child);
    }
    // Also observe the container itself
    observer.observe(el);

    return () => observer.disconnect();
  }, [messages.length]);

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
