import { useCallback, useRef, useState } from 'react';
import { EmojiAutocomplete } from './EmojiAutocomplete';
import { EmojiText } from '../../lib/emoji';
import type { Emoji } from '../../lib/emoji';
import type { Message } from '../../types/database';

// Check if content has any emoji shortcodes
const SHORTCODE_REGEX = /:([a-zA-Z0-9_+-]+):/;
function hasEmojiShortcodes(content: string): boolean {
  return SHORTCODE_REGEX.test(content);
}

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => Promise<void>;
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setError(null);

    try {
      await onSend(trimmed, replyTo?.id);
      setContent('');
      onCancelReply();
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When autocomplete has results, let it handle navigation keys
    if (hasAutocompleteResults) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
        // These are handled by autocomplete
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter selects emoji when autocomplete is showing
        return;
      }
      if (e.key === 'Escape') {
        // Escape closes autocomplete
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
      // Replace the :query with :code: (completed shortcode)
      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex);
      const newContent = `${before}:${emoji.code}:${after}`;
      
      setContent(newContent);
      
      // Move cursor to after the inserted emoji
      const newCursorPos = startIndex + emoji.code.length + 2; // +2 for the colons
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
    // Re-enable after a short delay to allow new typing
    setTimeout(() => setAutocompleteEnabled(true), 100);
  }, []);

  const handleAutocompleteResultsChange = useCallback((hasResults: boolean) => {
    setHasAutocompleteResults(hasResults);
  }, []);

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

      <div className="chat-input-row">
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
          disabled={!content.trim() || isOverLimit || sending || disabled}
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
