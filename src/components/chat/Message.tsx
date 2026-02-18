import { useCallback, useRef, useState } from "react";
import { PixelAvatar } from "../PixelAvatar";
import { ReactionPicker } from "./ReactionPicker";
import { EmojiText, getEmoji } from "../../lib/emoji";
import type { Message as MessageType } from "../../types/database";

interface ReactionInfo {
  count: number;
  reacted: boolean;
}

interface MessageProps {
  message: MessageType;
  currentUserId: string | undefined;
  reactions: Map<string, ReactionInfo>;
  replyTarget?: MessageType;
  onReply: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return formatTime(isoString);
}

/** 
 * Render a reaction - handles both shortcode format (:smile:) and raw emoji 
 * Returns either the emoji display or an img for custom emotes
 */
function ReactionDisplay({ code }: { code: string }) {
  // Check if it's a shortcode format :code:
  const shortcodeMatch = code.match(/^:([a-zA-Z0-9_+-]+):$/);
  const emojiCode = shortcodeMatch ? shortcodeMatch[1] : code;
  
  const emoji = getEmoji(emojiCode);
  
  if (emoji) {
    if (emoji.isCustom) {
      return (
        <img 
          src={emoji.display} 
          alt={emoji.alt} 
          className="reaction-badge-emoji" 
          loading="lazy"
        />
      );
    }
    return <span>{emoji.display}</span>;
  }
  
  // Fallback: if it's a raw emoji character, show it directly
  // Otherwise show the code
  return <span>{code}</span>;
}

export function Message({ message, currentUserId, reactions, replyTarget, onReply, onDelete, onReport, onReaction }: MessageProps) {
  const [showActions, setShowActions] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOwn = message.profile_id === currentUserId;
  const pseudonym = message.profiles?.pseudonym ?? "unknown";

  // Delayed hide so mouse can travel to picker/actions without flickering
  const handleMouseEnter = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    setShowActions(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => {
      setShowActions(false);
    }, 200);
  }, []);

  return (
    <div className="chat-message" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="chat-message-row">
        {/* Avatar */}
        <PixelAvatar seed={pseudonym} size={24} />

        {/* Body */}
        <div className="chat-message-body">
          <div className="chat-message-header">
            <span className="chat-message-author">{pseudonym}</span>
            <span className="chat-message-time" title={new Date(message.created_at).toLocaleString()}>
              {timeAgo(message.created_at)}
            </span>
          </div>
          {/* Reply context */}
          {replyTarget && (
            <div className="chat-reply-context">
              <span className="chat-reply-arrow">&#8627;</span>
              <span className="chat-reply-author">{replyTarget.profiles?.pseudonym}</span>
              <span className="chat-reply-preview">
                <EmojiText>{replyTarget.content.length > 80 ? replyTarget.content.slice(0, 80) + "..." : replyTarget.content}</EmojiText>
              </span>
            </div>
          )}
          <div className="chat-message-content"><EmojiText>{message.content}</EmojiText></div>

          {/* Reactions */}
            <div className="chat-reactions">
              {Array.from(reactions.entries()).map(([code, info]) => (
                <button
                  key={code}
                  className={`chat-reaction-badge ${info.reacted ? "is-reacted" : ""}`}
                  onClick={() => onReaction(message.id, code)}
                  title={info.reacted ? "Remove reaction" : "Add reaction"}
                >
                  <ReactionDisplay code={code} /> {info.count}
                </button>
              ))}
              <ReactionPicker onSelect={(code) => onReaction(message.id, code)} />
            </div>
        </div>

        {/* Actions (visible on hover, with delayed hide) */}
        {showActions && (
          <div className="chat-message-actions" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button className="chat-action-btn" onClick={() => onReply(message)} title="Reply">
              &#8617;
            </button>
            {!isOwn && (
              <button className="chat-action-btn chat-action-report" onClick={() => onReport(message.id)} title="Report message">
                &#9873;
              </button>
            )}
            {isOwn && (
              <button className="chat-action-btn chat-action-delete" onClick={() => onDelete(message.id)} title="Delete message">
                &times;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
