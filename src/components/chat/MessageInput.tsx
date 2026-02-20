import { useCallback, useRef, useState } from 'react';
import { EmojiAutocomplete } from './EmojiAutocomplete';
import { EmojiText } from '../../lib/emoji';
import type { Emoji } from '../../lib/emoji';
import type { Message } from '../../types/database';

const SHORTCODE_REGEX = /:([a-zA-Z0-9_+-]+):/;
function hasEmojiShortcodes(content: string): boolean {
  return SHORTCODE_REGEX.test(content);
}

const IMAGE_URL_REGEX = /^https:\/\/.+/i;
function isValidImageUrl(url: string): boolean {
  return IMAGE_URL_REGEX.test(url) && url.length <= 2048;
}

interface MessageInputProps {
  onSend: (content: string, imageUrl?: string | null, replyToId?: string) => Promise<void>;
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
  const [imageUrl, setImageUrl] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const imageUrlTrimmed = imageUrl.trim();
  const hasImage = imageUrlTrimmed.length > 0;
  const imageUrlInvalid = hasImage && !isValidImageUrl(imageUrlTrimmed);

  const hasContent = content.trim().length > 0;
  const canSend = (hasContent || (hasImage && !imageUrlInvalid)) && !imageUrlInvalid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || sending || disabled) return;

    setSending(true);
    setError(null);

    try {
      await onSend(content, hasImage ? imageUrlTrimmed : null, replyTo?.id);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
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
    setShowImageInput((prev) => {
      if (prev) setImageUrl('');
      return !prev;
    });
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

      {/* Image URL input */}
      {showImageInput && (
        <div className="chat-image-url-bar">
          <input
            type="url"
            className={`chat-image-url-input${imageUrlInvalid ? ' is-invalid' : ''}`}
            placeholder="image url (https://...)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={disabled || sending}
          />
          {imageUrlInvalid && (
            <span className="chat-image-url-error">must be a valid https:// url</span>
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
