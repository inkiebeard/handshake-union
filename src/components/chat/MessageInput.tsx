import { useCallback, useEffect, useRef, useState } from 'react';
import { EmojiAutocomplete } from './EmojiAutocomplete';
import { GiphyPicker, fireGiphyAnalytics } from './GiphyPicker';
import { EmojiText } from '../../lib/emoji';
import { LinkPreview } from './LinkPreview';
import type { Emoji } from '../../lib/emoji';
import type { Message } from '../../types/database';
import { ALLOWED_IMAGE_HOSTNAME_RE, ALLOWED_IMAGE_PROVIDERS } from '../../lib/constants';

const SHORTCODE_REGEX = /:([a-zA-Z0-9_+-]+):/;
function hasEmojiShortcodes(content: string): boolean {
  return SHORTCODE_REGEX.test(content);
}

function isValidImageUrl(url: string): boolean {
  if (url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_IMAGE_HOSTNAME_RE.test(parsed.hostname) &&
      parsed.pathname.length > 1  // DB regex requires a path after the TLD
    );
  } catch {
    return false;
  }
}

function isValidLinkUrl(url: string): boolean {
  if (url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface MessageInputProps {
  onSend: (content: string, imageUrl?: string | null, replyToId?: string, linkUrl?: string | null) => Promise<void>;
  replyTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, replyTo, onCancelReply, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(true);
  const [hasAutocompleteResults, setHasAutocompleteResults] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [gifOnsentUrl, setGifOnsentUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const imageUrlTrimmed = imageUrl.trim();
  const hasImage = imageUrlTrimmed.length > 0;
  const imageUrlInvalid = hasImage && !isValidImageUrl(imageUrlTrimmed);

  const linkUrlTrimmed = linkUrl.trim();
  const hasLink = linkUrlTrimmed.length > 0;
  const linkUrlInvalid = hasLink && !isValidLinkUrl(linkUrlTrimmed);

  const [debouncedLinkUrl, setDebouncedLinkUrl] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLinkUrl(linkUrlTrimmed), 500);
    return () => clearTimeout(timer);
  }, [linkUrlTrimmed]);
  const showLinkPreview = debouncedLinkUrl.length > 0 && isValidLinkUrl(debouncedLinkUrl);

  const hasContent = content.trim().length > 0;
  const canSend = (hasContent || (hasImage && !imageUrlInvalid) || (hasLink && !linkUrlInvalid)) && !imageUrlInvalid && !linkUrlInvalid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || sending || disabled) return;

    setSending(true);
    setError(null);

    try {
      await onSend(content, hasImage ? imageUrlTrimmed : null, replyTo?.id, hasLink ? linkUrlTrimmed : null);
      // Fire onsent analytics after the message actually delivers
      if (gifOnsentUrl) {
        fireGiphyAnalytics(gifOnsentUrl);
        setGifOnsentUrl('');
      }
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      setLinkUrl('');
      setDebouncedLinkUrl('');
      setShowLinkInput(false);
      onCancelReply();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
      // Defer focus until after the re-render that re-enables the textarea
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (hasAutocompleteResults) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        return;
      }
      if (e.key === 'Escape') {
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape' && replyTo) {
      onCancelReply();
    }
  };

  const handleSelectionChange = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart);
    }
  };

  const handleEmojiSelect = useCallback(
    (emoji: Emoji, startIndex: number, endIndex: number) => {
      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex);
      const newContent = `${before}:${emoji.code}:${after}`;

      setContent(newContent);

      const newCursorPos = startIndex + emoji.code.length + 2;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = newCursorPos;
          inputRef.current.selectionEnd = newCursorPos;
          inputRef.current.focus();
          setCursorPosition(newCursorPos);
        }
      }, 0);
    },
    [content]
  );

  const handleAutocompleteClose = useCallback(() => {
    setAutocompleteEnabled(false);
    setHasAutocompleteResults(false);
    setTimeout(() => setAutocompleteEnabled(true), 100);
  }, []);

  const handleAutocompleteResultsChange = useCallback((hasResults: boolean) => {
    setHasAutocompleteResults(hasResults);
  }, []);

  const handleToggleImageInput = () => {
    setShowGiphyPicker(false);
    setShowImageInput((prev) => {
      if (prev) {
        setImageUrl('');
        setGifOnsentUrl('');
      }
      return !prev;
    });
  };

  const handleToggleGiphyPicker = () => {
    // Clear any stale image attachment when hiding the image bar via the GIF toggle
    setShowImageInput(false);
    setImageUrl('');
    setGifOnsentUrl('');
    setShowGiphyPicker((prev) => !prev);
  };

  const handleToggleLinkInput = () => {
    setShowLinkInput((prev) => {
      if (prev) {
        setLinkUrl('');
        setDebouncedLinkUrl('');
      }
      return !prev;
    });
  };

  const handleGifSelect = (url: string, onsentUrl: string) => {
    setImageUrl(url);
    setGifOnsentUrl(onsentUrl);
    setShowImageInput(true);
    setShowGiphyPicker(false);
  };

  const charCount = content.length;
  const isOverLimit = charCount > 2000;
  const showPreview = hasEmojiShortcodes(content);

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      {/* Reply indicator */}
      {replyTo && (
        <div className="chat-reply-bar">
          <span className="chat-reply-label">
            replying to <strong>{replyTo.profiles?.pseudonym ?? 'unknown'}</strong>
          </span>
          <button
            type="button"
            className="chat-reply-cancel"
            onClick={onCancelReply}
          >
            &times;
          </button>
        </div>
      )}

      {/* Preview of rendered emojis */}
      {showPreview && (
        <div className="chat-input-preview">
          <span className="chat-input-preview-label">preview:</span>
          <span className="chat-input-preview-content">
            <EmojiText>{content}</EmojiText>
          </span>
        </div>
      )}

      {/* Giphy picker */}
      {showGiphyPicker && (
        <GiphyPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGiphyPicker(false)}
        />
      )}

      {/* Link URL input */}
      {showLinkInput && (
        <div className="chat-image-url-bar">
          <div className="chat-image-url-row">
            <input
              type="url"
              className={`chat-image-url-input${linkUrlInvalid ? ' is-invalid' : ''}`}
              placeholder="link url (https://...)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={disabled || sending}
            />
            <button
              type="button"
              className="chat-image-url-clear"
              onClick={() => {
                setLinkUrl('');
                setDebouncedLinkUrl('');
                setShowLinkInput(false);
              }}
              disabled={disabled || sending}
              title="Remove link"
            >
              &times;
            </button>
          </div>
          {linkUrlInvalid && (
            <span className="chat-image-url-error">
              must be a valid https:// URL
            </span>
          )}
          {showLinkPreview && <LinkPreview url={debouncedLinkUrl} />}
        </div>
      )}

      {/* Image URL input */}
      {showImageInput && (
        <div className="chat-image-url-bar">
          <div className="chat-image-url-row">
            <input
              type="url"
              className={`chat-image-url-input${imageUrlInvalid ? ' is-invalid' : ''}`}
              placeholder="image url (https://...)"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                // User edited the URL manually — the original GIF onsent is no longer valid
                setGifOnsentUrl('');
              }}
              disabled={disabled || sending}
            />
            <button
              type="button"
              className="chat-image-url-clear"
              onClick={() => {
                setImageUrl('');
                setGifOnsentUrl('');
                setShowImageInput(false);
              }}
              disabled={disabled || sending}
              title="Remove image"
            >
              &times;
            </button>
          </div>
          {imageUrlInvalid && (
            <span className="chat-image-url-error">
              allowed: {ALLOWED_IMAGE_PROVIDERS.join(', ')} — e.g. https://media.tenor.com/…
            </span>
          )}
          {hasImage && !imageUrlInvalid && (
            <div className="chat-input-image-preview">
              <img
                src={imageUrlTrimmed}
                alt="attachment preview"
                className="chat-input-image-preview-img"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  const img = event.currentTarget;
                  img.style.display = 'none';
                  const container = img.parentElement;
                  if (!container) return;
                  if (container.querySelector('.chat-input-image-preview-error')) return;
                  const errorSpan = document.createElement('span');
                  errorSpan.className = 'chat-input-image-preview-error';
                  errorSpan.textContent = 'Failed to load image preview';
                  container.appendChild(errorSpan);
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="chat-input-row">
        <button
          type="button"
          className={`chat-image-toggle-btn${showImageInput ? ' is-active' : ''}`}
          onClick={handleToggleImageInput}
          title={showImageInput ? 'Remove image' : 'Attach image URL'}
          disabled={disabled || sending}
        >
          &#128248;
        </button>
        <button
          type="button"
          className={`chat-image-toggle-btn${showGiphyPicker ? ' is-active' : ''}`}
          onClick={handleToggleGiphyPicker}
          title={showGiphyPicker ? 'Close GIF picker' : 'Search GIFs'}
          disabled={disabled || sending}
        >
          GIF
        </button>
        <button
          type="button"
          className={`chat-image-toggle-btn${showLinkInput ? ' is-active' : ''}`}
          onClick={handleToggleLinkInput}
          title={showLinkInput ? 'Remove link' : 'Attach a link'}
          disabled={disabled || sending}
        >
          &#128279;
        </button>
        <div className="chat-textarea-wrapper">
          <textarea
            ref={inputRef}
            className="chat-textarea"
            placeholder="type a message... (shift+enter for newline, :emoji: for emojis)"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setCursorPosition(e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            onSelect={handleSelectionChange}
            rows={1}
            disabled={disabled || sending}
            maxLength={2100}
          />
          {autocompleteEnabled && (
            <EmojiAutocomplete
              value={content}
              cursorPosition={cursorPosition}
              onSelect={handleEmojiSelect}
              onClose={handleAutocompleteClose}
              onResultsChange={handleAutocompleteResultsChange}
              anchorRef={inputRef}
            />
          )}
        </div>
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!canSend || isOverLimit || sending || disabled}
          title="Send (Enter)"
        >
          {sending ? '...' : '>'}
        </button>
      </div>

      <div className="chat-input-meta">
        {error && <span className="chat-input-error">{error}</span>}
        <span className={`chat-char-count ${isOverLimit ? 'is-over' : ''}`}>
          {charCount > 0 ? `${charCount}/2000` : ''}
        </span>
      </div>
    </form>
  );
}
