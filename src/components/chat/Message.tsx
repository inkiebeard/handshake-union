import { useCallback, useEffect, useRef, useState } from "react";
import { PixelAvatar } from "../PixelAvatar";
import { ReactionPicker } from "./ReactionPicker";
import { EmojiText, getEmoji } from "../../lib/emoji";
import { imagePreloadCache, preloadImage } from "../../lib/imagePreloadCache";
import { LinkPreview } from "./LinkPreview";
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

type ImageLoadState = "loading" | "ready" | "error";

function MessageImage({ url, mode, onLoad }: { url: string; mode: ImageDisplayMode; onLoad: () => void }) {
  const [manuallyRevealed, setManuallyRevealed] = useState(false);
  const isRevealed = mode === "full" || manuallyRevealed;

  // Lazily initialise from the preload cache populated by ChatContext before the DOM
  // mutation. If the image was pre-warmed we go straight to 'ready' on the first render,
  // skipping the skeleton entirely — the <img> is painted at its correct intrinsic size
  // with no subsequent layout shift, so the scroll-anchor restoration stays accurate.
  const [loadState, setLoadState] = useState<ImageLoadState>(() =>
    isRevealed && imagePreloadCache.has(url) ? "ready" : "loading"
  );
  const [size, setSize] = useState<{ w: number; h: number } | null>(() => {
    if (!isRevealed) return null;
    const cached = imagePreloadCache.get(url);
    return cached ? { w: cached.naturalWidth, h: cached.naturalHeight } : null;
  });

  // Reset per-image reveal when global mode switches back to blurred
  useEffect(() => {
    if (mode === "blurred") {
      setManuallyRevealed(false);
    }
  }, [mode]);

  // Keep onLoad stable inside effects without re-triggering the preload
  const onLoadRef = useRef(onLoad);
  useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);

  // Track whether onLoad has been fired for this image (avoid duplicate calls)
  const onLoadFiredRef = useRef(loadState === "ready");
  useEffect(() => { onLoadFiredRef.current = false; }, [url]);

  // Notify MessageList when the image becomes ready (triggers auto-scroll when near bottom)
  useEffect(() => {
    if (isRevealed && loadState === "ready" && !onLoadFiredRef.current) {
      onLoadFiredRef.current = true;
      onLoadRef.current();
    }
  }, [isRevealed, loadState]);

  // Start preloading when the image becomes revealed and isn't already cached
  useEffect(() => {
    if (!isRevealed || loadState !== "loading") return;

    // Re-check cache: another component may have loaded the same URL while we were loading
    const cached = imagePreloadCache.get(url);
    if (cached) {
      setSize({ w: cached.naturalWidth, h: cached.naturalHeight });
      setLoadState("ready");
      return;
    }

    let cancelled = false;
    preloadImage(url).then(() => {
      if (cancelled) return;
      const dims = imagePreloadCache.get(url);
      if (dims) {
        setSize({ w: dims.naturalWidth, h: dims.naturalHeight });
        setLoadState("ready");
      } else {
        setLoadState("error");
      }
    });

    return () => { cancelled = true; };
  }, [isRevealed, url, loadState]);

  if (!isRevealed) {
    return (
      <div className="chat-message-image">
        <button
          type="button"
          className="chat-image-reveal-btn"
          onClick={() => setManuallyRevealed(true)}
        >
          <span className="chat-image-reveal-icon">&#128248;</span>
          <span>image attached — click to reveal</span>
        </button>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="chat-message-image">
        <div className="chat-message-image-skeleton" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="chat-message-image">
        <div className="chat-message-image-error">&#9888; could not load image</div>
      </div>
    );
  }

  // Image is in the browser cache; the <img> renders at its correct intrinsic size
  // immediately. Explicit width/height attrs + CSS max-width/height:auto let the browser
  // reserve the correct space without needing to decode the image again.
  return (
    <div className="chat-message-image is-revealed">
      <img
        src={url}
        alt="attached image"
        className="chat-message-img"
        referrerPolicy="no-referrer"
        width={size?.w}
        height={size?.h}
      />
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

          {/* Attached link */}
          {message.link_url && (
            <LinkPreview url={message.link_url} />
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
