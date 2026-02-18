import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllEmojis, type Emoji } from '../../lib/emoji';

interface EmojiAutocompleteProps {
  /** Current input value */
  value: string;
  /** Cursor position in the input */
  cursorPosition: number;
  /** Called when an emoji is selected */
  onSelect: (emoji: Emoji, startIndex: number, endIndex: number) => void;
  /** Called when the picker should close */
  onClose: () => void;
  /** Called when results availability changes */
  onResultsChange: (hasResults: boolean) => void;
  /** Position anchor element (the textarea) */
  anchorRef: React.RefObject<HTMLTextAreaElement>;
}

interface AutocompleteState {
  isOpen: boolean;
  query: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Fuzzy match an emoji against a query
 * Returns a score (higher = better match), or -1 if no match
 */
function fuzzyMatch(emoji: Emoji, query: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerCode = emoji.code.toLowerCase();
  const lowerAlt = emoji.alt.toLowerCase();
  
  // Exact prefix match on code - highest priority
  if (lowerCode.startsWith(lowerQuery)) {
    return 1000 - lowerCode.length; // Shorter codes rank higher
  }
  
  // Exact prefix match on alt text
  if (lowerAlt.startsWith(lowerQuery)) {
    return 500 - lowerAlt.length;
  }
  
  // Contains match on code
  if (lowerCode.includes(lowerQuery)) {
    return 200 - lowerCode.indexOf(lowerQuery);
  }
  
  // Contains match on alt
  if (lowerAlt.includes(lowerQuery)) {
    return 100 - lowerAlt.indexOf(lowerQuery);
  }
  
  // Fuzzy character match on code
  let queryIdx = 0;
  let score = 0;
  for (let i = 0; i < lowerCode.length && queryIdx < lowerQuery.length; i++) {
    if (lowerCode[i] === lowerQuery[queryIdx]) {
      score += 10 - i; // Earlier matches score higher
      queryIdx++;
    }
  }
  
  if (queryIdx === lowerQuery.length) {
    return score;
  }
  
  return -1; // No match
}

/**
 * Parse the input to find if we're in an emoji shortcode context
 */
function parseEmojiContext(value: string, cursorPosition: number): AutocompleteState | null {
  // Look backwards from cursor to find a ':'
  let colonIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = value[i];
    
    // Stop at whitespace or another colon (closed shortcode)
    if (char === ' ' || char === '\n' || char === '\t') {
      return null;
    }
    
    // Found the opening colon
    if (char === ':') {
      colonIndex = i;
      break;
    }
  }
  
  if (colonIndex === -1) {
    return null;
  }
  
  // Extract the query (text between : and cursor)
  const query = value.slice(colonIndex + 1, cursorPosition);
  
  // Need at least 2 characters to trigger autocomplete
  if (query.length < 2) {
    return null;
  }
  
  // Make sure query only contains valid shortcode characters
  if (!/^[a-zA-Z0-9_+-]+$/.test(query)) {
    return null;
  }
  
  return {
    isOpen: true,
    query,
    startIndex: colonIndex,
    endIndex: cursorPosition,
  };
}

export function EmojiAutocomplete({
  value,
  cursorPosition,
  onSelect,
  onClose,
  onResultsChange,
  anchorRef,
}: EmojiAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  
  // Parse the current context
  const context = useMemo(
    () => parseEmojiContext(value, cursorPosition),
    [value, cursorPosition]
  );
  
  // Get filtered and sorted emoji list
  const filteredEmojis = useMemo(() => {
    if (!context) return [];
    
    const allEmojis = getAllEmojis();
    const scored = allEmojis
      .map((emoji) => ({ emoji, score: fuzzyMatch(emoji, context.query) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Limit to 10 results
    
    return scored.map((item) => item.emoji);
  }, [context]);
  
  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredEmojis]);
  
  // Report results availability to parent
  useEffect(() => {
    const hasResults = context !== null && filteredEmojis.length > 0;
    onResultsChange(hasResults);
  }, [context, filteredEmojis.length, onResultsChange]);
  
  // Scroll selected item into view
  useEffect(() => {
    const item = itemRefs.current.get(selectedIndex);
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!context || filteredEmojis.length === 0) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredEmojis.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
          break;
        case 'Tab':
        case 'Enter':
          if (filteredEmojis[selectedIndex]) {
            e.preventDefault();
            onSelect(filteredEmojis[selectedIndex], context.startIndex, context.endIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [context, filteredEmojis, selectedIndex, onSelect, onClose]
  );
  
  // Attach keyboard listener to the textarea
  useEffect(() => {
    const textarea = anchorRef.current;
    if (!textarea || !context) return;
    
    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [anchorRef, context, handleKeyDown]);
  
  // Don't render if not in emoji context or no results
  if (!context || filteredEmojis.length === 0) {
    return null;
  }
  
  const handleItemClick = (emoji: Emoji, index: number) => {
    setSelectedIndex(index);
    onSelect(emoji, context.startIndex, context.endIndex);
  };
  
  return (
    <div className="emoji-autocomplete" ref={listRef}>
      <div className="emoji-autocomplete-header">
        <span className="emoji-autocomplete-query">:{context.query}</span>
      </div>
      <div className="emoji-autocomplete-list">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={emoji.code}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            type="button"
            className={`emoji-autocomplete-item ${index === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => handleItemClick(emoji, index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {emoji.isCustom ? (
              <img
                src={emoji.display}
                alt={emoji.alt}
                className="emoji-autocomplete-preview emoji-autocomplete-preview-custom"
                loading="lazy"
              />
            ) : (
              <span className="emoji-autocomplete-preview">{emoji.display}</span>
            )}
            <span className="emoji-autocomplete-code">:{emoji.code}:</span>
            <span className="emoji-autocomplete-alt">{emoji.alt}</span>
          </button>
        ))}
      </div>
      <div className="emoji-autocomplete-hint">
        <kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Tab</kbd>/<kbd>Enter</kbd> select · <kbd>Esc</kbd> close
      </div>
    </div>
  );
}
