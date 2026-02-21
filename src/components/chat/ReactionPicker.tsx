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
  'thumbsup', 'thumbsdown', 'joy', 'fire', 'eyes', '100',
  'handshake', 'bug', 'rocket', 'skull', 'salute', 'coffee',
  'solidarity', 'union', 'fair-go', 'facepalm', 'panik', 'chefkiss'
];

function renderPickerEmoji(emoji: Emoji) {
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
}

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
  // Set true for a short window after a touch inside the picker, so that
  // any spurious scroll events on underlying containers are ignored.
  const touchedInsideRef = useRef(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true briefly after the picker opens to suppress scroll events triggered
  // by the tap itself (mobile overscroll bounce) or keyboard appearance.
  const justOpenedRef = useRef(false);
  const justOpenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    
    // Custom categories first, then base categories
    return [...customCats, ...BASE_EMOJI_CATEGORIES];
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

  // Close on click/tap outside and on scroll (but not scroll inside picker)
  useEffect(() => {
    if (!open) return;

    // Suppress scroll-close briefly after opening to absorb any bounce/overscroll
    // events that mobile browsers fire as a side-effect of the tap that opened the picker.
    justOpenedRef.current = true;
    if (justOpenedTimerRef.current) clearTimeout(justOpenedTimerRef.current);
    justOpenedTimerRef.current = setTimeout(() => {
      justOpenedRef.current = false;
    }, 400);

    // Desktop: mousedown outside closes picker
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    // Mobile: touchstart outside closes picker (mousedown synthesis is unreliable on mobile)
    const handleTouchOutside = (e: TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        pickerRef.current && !pickerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    // Track when user touches inside the picker so the scroll handler can
    // ignore spurious scroll events that mobile browsers fire on underlying containers.
    const handleTouchInsidePicker = (e: TouchEvent) => {
      if (pickerRef.current && pickerRef.current.contains(e.target as Node)) {
        touchedInsideRef.current = true;
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        touchTimerRef.current = setTimeout(() => {
          touchedInsideRef.current = false;
        }, 600);
      }
    };

    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the picker itself
      if (pickerRef.current && pickerRef.current.contains(e.target as Node)) {
        return;
      }
      // Don't close if this scroll was triggered by touching inside the picker
      // (mobile browsers fire scroll events on underlying containers when tapping fixed overlays)
      if (touchedInsideRef.current) {
        return;
      }
      // Don't close during the brief cooldown after opening (absorbs mobile bounce
      // scroll from the tap that opened the picker, or keyboard-show scroll)
      if (justOpenedRef.current) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    document.addEventListener('touchstart', handleTouchInsidePicker, { passive: true, capture: true });
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
      document.removeEventListener('touchstart', handleTouchInsidePicker, { capture: true });
      document.removeEventListener('scroll', handleScroll, true);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      if (justOpenedTimerRef.current) clearTimeout(justOpenedTimerRef.current);
    };
  }, [open]);

  // Focus search when opened — skip on touch devices to avoid popping the
  // keyboard, which causes a scroll event that would immediately close the picker.
  useEffect(() => {
    if (open && searchRef.current) {
      const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      if (!isTouchDevice) {
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      setStyle(calculateStyle());
      setSearchQuery('');
      setActiveCategory(categories[0]?.id ?? 'quick');
    }
    setOpen(!open);
  };

  const handleSelect = (emoji: Emoji) => {
    // Use the shortcode format for reactions
    onSelect(`:${emoji.code}:`);
    setOpen(false);
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
          onTouchStart={(e) => e.stopPropagation()}
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
                  {renderPickerEmoji(emoji)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
