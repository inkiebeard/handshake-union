import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllEmojis, getEmoji, getCustomEmoteCategories, type Emoji } from '../../lib/emoji';

interface ReactionPickerProps {
  onSelect: (code: string) => void;
}

interface PickerStyle {
  position: 'fixed';
  top?: number;
  bottom?: number;
  left?: number;
  right?: string;
}

interface EmojiCategory {
  id: string;
  label: string;
  codes?: string[];
  filter?: (e: Emoji) => boolean;
  emojis?: Emoji[]; // For custom categories
}

// Quick reactions shown at the top of the picker (most commonly used)
const QUICK_REACTION_CODES = [
  'thumbsup', '+1', 'thumbsdown', 'joy', 'fire', 'eyes', '100',
  'handshake', 'bug', 'rocket', 'skull', 'salute', 'coffee',
  'solidarity', 'union', 'fair-go',
];

// Base categories for organizing standard emojis
const BASE_EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'quick', label: 'Quick', codes: QUICK_REACTION_CODES },
  { id: 'faces', label: 'Faces', filter: (e: Emoji) => 
    ['smile', 'grin', 'joy', 'rofl', 'wink', 'thinking', 'facepalm', 'shrug', 'salute', 
     'angry', 'rage', 'cry', 'sob', 'scream', 'exploding_head', 'nerd', 'sunglasses',
     'partying', 'smirk', 'unamused', 'rolling_eyes'].includes(e.code) },
  { id: 'gestures', label: 'Gestures', filter: (e: Emoji) => 
    ['thumbsup', '+1', 'thumbsdown', '-1', 'ok_hand', 'clap', 'raised_hands', 'wave',
     'fist', 'punch', 'muscle', 'pray', 'handshake'].includes(e.code) },
  { id: 'symbols', label: 'Symbols', filter: (e: Emoji) => 
    ['heart', 'fire', 'sparkles', 'star', 'zap', 'boom', '100', 'check', 'x', 
     'warning', 'eyes', 'skull'].includes(e.code) },
  { id: 'dev', label: 'Dev', filter: (e: Emoji) => 
    ['bug', 'rocket', 'shipit', 'lgtm', 'deploy', 'hotfix', 'merge', 'pr', 'review',
     'approved', 'rejected', 'wip', 'coffee', 'computer'].includes(e.code) },
  { id: 'solidarity', label: 'Solidarity', filter: (e: Emoji) => 
    ['solidarity', 'union', 'fair-go', 'strike', 'workers', 'fist'].includes(e.code) },
];

export function ReactionPicker({ onSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<PickerStyle | null>(null);
  const [activeCategory, setActiveCategory] = useState('quick');
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Get all emojis
  const allEmojis = useMemo(() => getAllEmojis(), []);
  
  // Build categories including custom emote categories from database
  const categories = useMemo(() => {
    const customCategories = getCustomEmoteCategories();
    
    // Convert custom categories to our format
    const customCats: EmojiCategory[] = customCategories.map(({ category, emojis }) => ({
      id: `custom-${category}`,
      label: category.charAt(0).toUpperCase() + category.slice(1), // Capitalize
      emojis,
    }));
    
    // Combine base categories with custom ones
    return [...BASE_EMOJI_CATEGORIES, ...customCats];
  }, []);
  
  // Filter emojis based on search or category
  const displayedEmojis = useMemo(() => {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      return allEmojis.filter(e => 
        e.code.toLowerCase().includes(query) || 
        e.alt.toLowerCase().includes(query)
      ).slice(0, 30);
    }
    
    const category = categories.find(c => c.id === activeCategory);
    if (!category) return [];
    
    // Custom category with pre-loaded emojis
    if (category.emojis) {
      return category.emojis;
    }
    
    if (category.codes) {
      // Quick reactions - use specific codes
      return category.codes
        .map(code => getEmoji(code))
        .filter((e): e is Emoji => e !== undefined);
    }
    
    if (category.filter) {
      return allEmojis.filter(category.filter);
    }
    
    return [];
  }, [allEmojis, categories, activeCategory, searchQuery]);

  const calculateStyle = (): PickerStyle => {
    if (!triggerRef.current) return { position: 'fixed', top: 0, left: 0 };

    const rect = triggerRef.current.getBoundingClientRect();
    const pickerWidth = 280;
    const gap = 6;
    const spaceAbove = rect.top;
    const openUp = spaceAbove > 200;

    // Horizontal: align right edge of picker with right edge of trigger
    let left = rect.right - pickerWidth;
    if (left < 8) left = 8;

    if (openUp) {
      return {
        position: 'fixed',
        bottom: window.innerHeight - rect.top + gap,
        left,
      };
    } else {
      return {
        position: 'fixed',
        top: rect.bottom + gap,
        left,
      };
    }
  };

  // Close on click outside and on scroll (but not scroll inside picker)
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the picker
      if (pickerRef.current && pickerRef.current.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      setStyle(calculateStyle());
      setSearchQuery('');
      setActiveCategory('quick');
    }
    setOpen(!open);
  };

  const handleSelect = (emoji: Emoji) => {
    // Use the shortcode format for reactions
    onSelect(`:${emoji.code}:`);
    setOpen(false);
  };

  const renderEmoji = (emoji: Emoji) => {
    if (emoji.isCustom) {
      return (
        <img
          src={emoji.display}
          alt={emoji.alt}
          className="reaction-emoji-img"
          loading="lazy"
        />
      );
    }
    return <span>{emoji.display}</span>;
  };

  return (
    <div className="reaction-picker-wrapper" ref={wrapperRef}>
      <button
        ref={triggerRef}
        className="reaction-trigger"
        onClick={handleToggle}
        title="Add reaction"
      >
        +
      </button>
      {open && style && (
        <div
          ref={pickerRef}
          className="reaction-picker"
          style={style}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="reaction-picker-search">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search emojis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="reaction-search-input"
            />
          </div>
          
          {/* Category tabs */}
          {!searchQuery && (
            <div className="reaction-picker-tabs">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`reaction-tab ${activeCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  title={cat.label}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Emoji grid */}
          <div className="reaction-picker-grid">
            {displayedEmojis.length === 0 ? (
              <div className="reaction-picker-empty">No emojis found</div>
            ) : (
              displayedEmojis.map((emoji) => (
                <button
                  key={emoji.code}
                  className="reaction-option"
                  onClick={() => handleSelect(emoji)}
                  title={`:${emoji.code}: - ${emoji.alt}`}
                >
                  {renderEmoji(emoji)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
