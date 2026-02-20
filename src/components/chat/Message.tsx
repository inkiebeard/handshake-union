import { useCallback, useEffect, useRef, useState } from "react";
import { PixelAvatar } from "../PixelAvatar";
import { ReactionPicker } from "./ReactionPicker";
import { EmojiText, getEmoji } from "../../lib/emoji";
import type { Message as MessageType } from "../../types/database";
import type { ImageDisplayMode } from "../../hooks/useImageDisplayMode";

interface ReactionInfo {
  count: number;
  reacted: boolean;
}

interface MessageProps {
  message: MessageType;
  currentUserId: string | undefined;
  reactions: Map<string, ReactionInfo>;
  replyTarget?: MessageType;
  imageDisplayMode: ImageDisplayMode;
  onReply: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onImageLoad: () => void;
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

function ReactionDisplay({ code }: { code: string }) {
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

  return <span>{code}</span>;
}

function MessageImage({ url, mode, onLoad }: { url: string; mode: ImageDisplayMode; onLoad: () => void }) {
  const [manuallyRevealed, setManuallyRevealed] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isRevealed = mode === "full" || manuallyRevealed;

  // Reset per-image reveal when global mode switches back to blurred
  useEffect(() => {
    if (mode === "blurred") {
      setManuallyRevealed(false);
      setHasError(false);
    }
  }, [mode]);

  return (
    <div className={`chat-message-image${isRevealed ? " is-revealed" : ""}`}>
      {isRevealed ? (
        hasError ? (
          <div className="chat-message-image-error">
            ⚠ could not load image
          </div>
        ) : (
          <img
            src={url}
            alt="attached image"
            className="chat-message-img"
            loading="lazy"
            onLoad={onLoad}
            onError={() => setHasError(true)}
          />
        )
      ) : (
        <button
          type="button"
          className="chat-image-reveal-btn"
          onClick={() => setManuallyRevealed(true)}
        >
          <span className="chat-image-reveal-icon">&#128248;</span>
          <span>image attached — click to reveal</span>
        </button>
      )}
    </div>
  );
}

export function Message({ message, currentUserId, reactions, replyTarget, imageDisplayMode, onReply, onDelete, onReport, onReaction, onImageLoad }: MessageProps) {
  const [showActions, setShowActions] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOwn = message.profile_id === currentUserId;
  const pseudonym = message.profiles?.pseudonym ?? "unknown";

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
                {replyTarget.content
                  ? <EmojiText>{replyTarget.content.length > 80 ? replyTarget.content.slice(0, 80) + "..." : replyTarget.content}</EmojiText>
                  : <span className="chat-reply-image-only">&#128248; image</span>
                }
              </span>
            </div>
          )}
          {message.content && (
            <div className="chat-message-content"><EmojiText>{message.content}</EmojiText></div>
          )}

          {/* Attached image */}
          {message.image_url && (
            <MessageImage url={message.image_url} mode={imageDisplayMode} onLoad={onImageLoad} />
          )}

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

        {/* Actions (visible on hover) */}
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
