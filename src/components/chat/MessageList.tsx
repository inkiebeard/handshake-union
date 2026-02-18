import { useEffect, useRef } from 'react';
import { Message } from './Message';
import type { Message as MessageType } from '../../types/database';

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
  onReply: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  reactions,
  loading,
  onReply,
  onDelete,
  onReport,
  onReaction,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  // Track if user is near the bottom of the scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
    <div className="chat-message-list" ref={containerRef} onScroll={handleScroll}>
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          currentUserId={currentUserId}
          reactions={reactions.get(msg.id) ?? new Map()}
          replyTarget={msg.reply_to_id ? messageMap.get(msg.reply_to_id) : undefined}
          onReply={onReply}
          onDelete={onDelete}
          onReport={onReport}
          onReaction={onReaction}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
