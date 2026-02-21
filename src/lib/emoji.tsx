import { Fragment, type ReactNode } from 'react';
import { getCachedEmotes } from '../hooks/useCustomEmotes';
import type { CustomEmote } from '../types/database';

// ============================================
// Emoji Shortcode System
// ============================================
// Shortcodes like :smile: are stored in message content as-is
// but rendered as actual emojis/images when displayed.
// This allows for future custom emotes (GIFs, etc.) without
// storing binary data in message content.

export interface Emoji {
  /** Shortcode without colons, e.g. "smile" */
  code: string;
  /** Display value - can be unicode emoji or URL for custom emotes */
  display: string;
  /** Whether this is a custom emote (image/gif) vs unicode */
  isCustom?: boolean;
  /** Alt text for accessibility */
  alt: string;
  /** Score for sorting in autocomplete - Desc */
  score?: number;
}

// Standard emoji shortcodes
// Based on common shortcode conventions (Slack, Discord, GitHub)
const STANDARD_EMOJIS: Emoji[] = [
  // Smileys & People
  { code: 'smile', display: '😊', alt: 'smiling face', score: 0 },
  { code: 'grin', display: '😀', alt: 'grinning face', score: 0 },
  { code: 'joy', display: '😂', alt: 'face with tears of joy', score: 0 },
  { code: 'rofl', display: '🤣', alt: 'rolling on the floor laughing', score: 0 },
  { code: 'wink', display: '😉', alt: 'winking face', score: 0 },
  { code: 'blush', display: '😊', alt: 'blushing face', score: 0 },
  { code: 'heart_eyes', display: '😍', alt: 'heart eyes', score: 0 },
  { code: 'kissing_heart', display: '😘', alt: 'kissing heart', score: 0 },
  { code: 'thinking', display: '🤔', alt: 'thinking face', score: 0 },
  { code: 'raised_eyebrow', display: '🤨', alt: 'raised eyebrow', score: 0 },
  { code: 'neutral_face', display: '😐', alt: 'neutral face', score: 0 },
  { code: 'expressionless', display: '😑', alt: 'expressionless', score: 0 },
  { code: 'unamused', display: '😒', alt: 'unamused', score: 0 },
  { code: 'rolling_eyes', display: '🙄', alt: 'rolling eyes', score: 0 },
  { code: 'grimacing', display: '😬', alt: 'grimacing', score: 0 },
  { code: 'relieved', display: '😌', alt: 'relieved', score: 0 },
  { code: 'pensive', display: '😔', alt: 'pensive', score: 0 },
  { code: 'sleepy', display: '😪', alt: 'sleepy', score: 0 },
  { code: 'drooling', display: '🤤', alt: 'drooling', score: 0 },
  { code: 'sleeping', display: '😴', alt: 'sleeping', score: 0 },
  { code: 'mask', display: '😷', alt: 'mask', score: 0 },
  { code: 'nerd', display: '🤓', alt: 'nerd face', score: 0 },
  { code: 'sunglasses', display: '😎', alt: 'sunglasses', score: 0 },
  { code: 'clown', display: '🤡', alt: 'clown', score: 0 },
  { code: 'cowboy', display: '🤠', alt: 'cowboy', score: 0 },
  { code: 'partying', display: '🥳', alt: 'partying', score: 0 },
  { code: 'smirk', display: '😏', alt: 'smirk', score: 0 },
  { code: 'disappointed', display: '😞', alt: 'disappointed', score: 0 },
  { code: 'worried', display: '😟', alt: 'worried', score: 0 },
  { code: 'angry', display: '😠', alt: 'angry', score: 0 },
  { code: 'rage', display: '😡', alt: 'rage', score: 0 },
  { code: 'cry', display: '😢', alt: 'crying', score: 0 },
  { code: 'sob', display: '😭', alt: 'sobbing', score: 0 },
  { code: 'scream', display: '😱', alt: 'screaming', score: 0 },
  { code: 'flushed', display: '😳', alt: 'flushed', score: 0 },
  { code: 'dizzy_face', display: '😵', alt: 'dizzy', score: 0 },
  { code: 'exploding_head', display: '🤯', alt: 'exploding head', score: 0 },
  { code: 'shush', display: '🤫', alt: 'shushing', score: 0 },
  { code: 'lying', display: '🤥', alt: 'lying', score: 0 },
  { code: 'no_mouth', display: '😶', alt: 'no mouth', score: 0 },
  { code: 'zipper_mouth', display: '🤐', alt: 'zipper mouth', score: 0 },
  { code: 'money_mouth', display: '🤑', alt: 'money mouth', score: 0 },
  { code: 'hugs', display: '🤗', alt: 'hugging', score: 0 },
  { code: 'shrug', display: '🤷', alt: 'shrug', score: 0 },
  { code: 'salute', display: '🫡', alt: 'salute', score: 0 },
  
  // Gestures
  { code: 'thumbsup', display: '👍', alt: 'thumbs up', score: 0 },
  { code: '+1', display: '👍', alt: 'thumbs up', score: 0 },
  { code: 'thumbsdown', display: '👎', alt: 'thumbs down', score: 0 },
  { code: '-1', display: '👎', alt: 'thumbs down', score: 0 },
  { code: 'ok_hand', display: '👌', alt: 'ok hand', score: 0 },
  { code: 'pinched_fingers', display: '🤌', alt: 'pinched fingers', score: 0 },
  { code: 'pinching_hand', display: '🤏', alt: 'pinching hand', score: 0 },
  { code: 'v', display: '✌️', alt: 'peace', score: 0 },
  { code: 'crossed_fingers', display: '🤞', alt: 'crossed fingers', score: 0 },
  { code: 'love_you', display: '🤟', alt: 'love you', score: 0 },
  { code: 'metal', display: '🤘', alt: 'metal', score: 0 },
  { code: 'call_me', display: '🤙', alt: 'call me', score: 0 },
  { code: 'point_left', display: '👈', alt: 'point left', score: 0 },
  { code: 'point_right', display: '👉', alt: 'point right', score: 0 },
  { code: 'point_up', display: '👆', alt: 'point up', score: 0 },
  { code: 'point_down', display: '👇', alt: 'point down', score: 0 },
  { code: 'middle_finger', display: '🖕', alt: 'middle finger', score: 0 },
  { code: 'raised_hand', display: '✋', alt: 'raised hand', score: 0 },
  { code: 'wave', display: '👋', alt: 'wave', score: 0 },
  { code: 'clap', display: '👏', alt: 'clap', score: 0 },
  { code: 'raised_hands', display: '🙌', alt: 'raised hands', score: 0 },
  { code: 'open_hands', display: '👐', alt: 'open hands', score: 0 },
  { code: 'palms_up', display: '🤲', alt: 'palms up', score: 0 },
  { code: 'handshake', display: '🤝', alt: 'handshake', score: 0 },
  { code: 'pray', display: '🙏', alt: 'pray', score: 0 },
  { code: 'writing_hand', display: '✍️', alt: 'writing', score: 0 },
  { code: 'muscle', display: '💪', alt: 'muscle', score: 0 },
  { code: 'fist', display: '✊', alt: 'fist', score: 0 },
  { code: 'punch', display: '👊', alt: 'punch', score: 0 },
  
  // Hearts & Symbols
  { code: 'heart', display: '❤️', alt: 'heart', score: 0 },
  { code: 'orange_heart', display: '🧡', alt: 'orange heart', score: 0 },
  { code: 'yellow_heart', display: '💛', alt: 'yellow heart', score: 0 },
  { code: 'green_heart', display: '💚', alt: 'green heart', score: 0 },
  { code: 'blue_heart', display: '💙', alt: 'blue heart', score: 0 },
  { code: 'purple_heart', display: '💜', alt: 'purple heart', score: 0 },
  { code: 'black_heart', display: '🖤', alt: 'black heart', score: 0 },
  { code: 'broken_heart', display: '💔', alt: 'broken heart', score: 0 },
  { code: 'fire', display: '🔥', alt: 'fire', score: 0 },
  { code: 'sparkles', display: '✨', alt: 'sparkles', score: 0 },
  { code: 'star', display: '⭐', alt: 'star', score: 0 },
  { code: 'zap', display: '⚡', alt: 'zap', score: 0 },
  { code: 'boom', display: '💥', alt: 'boom', score: 0 },
  { code: '100', display: '💯', alt: 'hundred', score: 0 },
  { code: 'check', display: '✅', alt: 'check', score: 0 },
  { code: 'x', display: '❌', alt: 'x', score: 0 },
  { code: 'question', display: '❓', alt: 'question', score: 0 },
  { code: 'exclamation', display: '❗', alt: 'exclamation', score: 0 },
  { code: 'warning', display: '⚠️', alt: 'warning', score: 0 },
  
  // Objects & Tech
  { code: 'eyes', display: '👀', alt: 'eyes', score: 0 },
  { code: 'brain', display: '🧠', alt: 'brain', score: 0 },
  { code: 'skull', display: '💀', alt: 'skull', score: 0 },
  { code: 'poop', display: '💩', alt: 'poop', score: 0 },
  { code: 'robot', display: '🤖', alt: 'robot', score: 0 },
  { code: 'alien', display: '👽', alt: 'alien', score: 0 },
  { code: 'ghost', display: '👻', alt: 'ghost', score: 0 },
  { code: 'computer', display: '💻', alt: 'computer', score: 0 },
  { code: 'keyboard', display: '⌨️', alt: 'keyboard', score: 0 },
  { code: 'desktop', display: '🖥️', alt: 'desktop', score: 0 },
  { code: 'phone', display: '📱', alt: 'phone', score: 0 },
  { code: 'bug', display: '🐛', alt: 'bug', score: 0 },
  { code: 'rocket', display: '🚀', alt: 'rocket', score: 0 },
  { code: 'gear', display: '⚙️', alt: 'gear', score: 0 },
  { code: 'wrench', display: '🔧', alt: 'wrench', score: 0 },
  { code: 'hammer', display: '🔨', alt: 'hammer', score: 0 },
  { code: 'tools', display: '🛠️', alt: 'tools', score: 0 },
  { code: 'lock', display: '🔒', alt: 'lock', score: 0 },
  { code: 'key', display: '🔑', alt: 'key', score: 0 },
  { code: 'bulb', display: '💡', alt: 'light bulb', score: 0 },
  { code: 'mag', display: '🔍', alt: 'magnifying glass', score: 0 },
  { code: 'link', display: '🔗', alt: 'link', score: 0 },
  { code: 'paperclip', display: '📎', alt: 'paperclip', score: 0 },
  { code: 'clipboard', display: '📋', alt: 'clipboard', score: 0 },
  { code: 'memo', display: '📝', alt: 'memo', score: 0 },
  { code: 'book', display: '📖', alt: 'book', score: 0 },
  { code: 'books', display: '📚', alt: 'books', score: 0 },
  { code: 'calendar', display: '📅', alt: 'calendar', score: 0 },
  { code: 'chart', display: '📈', alt: 'chart', score: 0 },
  { code: 'chart_down', display: '📉', alt: 'chart down', score: 0 },
  { code: 'money', display: '💰', alt: 'money', score: 0 },
  { code: 'dollar', display: '💵', alt: 'dollar', score: 0 },
  { code: 'credit_card', display: '💳', alt: 'credit card', score: 0 },
  
  // Food & Drink
  { code: 'coffee', display: '☕', alt: 'coffee', score: 0 },
  { code: 'tea', display: '🍵', alt: 'tea', score: 0 },
  { code: 'beer', display: '🍺', alt: 'beer', score: 0 },
  { code: 'beers', display: '🍻', alt: 'beers', score: 0 },
  { code: 'wine', display: '🍷', alt: 'wine', score: 0 },
  { code: 'cocktail', display: '🍸', alt: 'cocktail', score: 0 },
  { code: 'pizza', display: '🍕', alt: 'pizza', score: 0 },
  { code: 'burger', display: '🍔', alt: 'burger', score: 0 },
  { code: 'fries', display: '🍟', alt: 'fries', score: 0 },
  { code: 'taco', display: '🌮', alt: 'taco', score: 0 },
  { code: 'cake', display: '🎂', alt: 'cake', score: 0 },
  { code: 'cookie', display: '🍪', alt: 'cookie', score: 0 },
  { code: 'popcorn', display: '🍿', alt: 'popcorn', score: 0 },
  
  // Nature & Animals
  { code: 'sun', display: '☀️', alt: 'sun', score: 0 },
  { code: 'moon', display: '🌙', alt: 'moon', score: 0 },
  { code: 'cloud', display: '☁️', alt: 'cloud', score: 0 },
  { code: 'rain', display: '🌧️', alt: 'rain', score: 0 },
  { code: 'rainbow', display: '🌈', alt: 'rainbow', score: 0 },
  { code: 'tree', display: '🌳', alt: 'tree', score: 0 },
  { code: 'flower', display: '🌸', alt: 'flower', score: 0 },
  { code: 'dog', display: '🐕', alt: 'dog', score: 0 },
  { code: 'cat', display: '🐈', alt: 'cat', score: 0 },
  { code: 'unicorn', display: '🦄', alt: 'unicorn', score: 0 },
  { code: 'snake', display: '🐍', alt: 'snake', score: 0 },
  { code: 'turtle', display: '🐢', alt: 'turtle', score: 0 },
  { code: 'crab', display: '🦀', alt: 'crab', score: 0 },
  { code: 'octopus', display: '🐙', alt: 'octopus', score: 0 },
  
  // Dev & Work culture
  { code: 'shipit', display: '🚀', alt: 'ship it', score: 0 },
  { code: 'lgtm', display: '👍', alt: 'looks good to me', score: 0 },
  { code: 'wfh', display: '🏠', alt: 'work from home', score: 0 },
  { code: 'meeting', display: '📅', alt: 'meeting', score: 0 },
  { code: 'standup', display: '🧍', alt: 'standup', score: 0 },
  { code: 'deploy', display: '🚀', alt: 'deploy', score: 0 },
  { code: 'hotfix', display: '🔥', alt: 'hotfix', score: 0 },
  { code: 'revert', display: '⏪', alt: 'revert', score: 0 },
  { code: 'merge', display: '🔀', alt: 'merge', score: 0 },
  { code: 'pr', display: '📝', alt: 'pull request', score: 0 },
  { code: 'review', display: '👀', alt: 'review', score: 0 },
  { code: 'approved', display: '✅', alt: 'approved', score: 0 },
  { code: 'rejected', display: '❌', alt: 'rejected', score: 0 },
  { code: 'wip', display: '🚧', alt: 'work in progress', score: 0 },
  { code: 'todo', display: '📋', alt: 'todo', score: 0 },
  { code: 'done', display: '✅', alt: 'done', score: 0 },
  { code: 'blocked', display: '🚫', alt: 'blocked', score: 0 },
  
  // Solidarity / Union
  { code: 'solidarity', display: '✊', alt: 'solidarity', score: 0 },
  { code: 'union', display: '🤝', alt: 'union', score: 0 },
  { code: 'fair-go', display: '⚖️', alt: 'fair go', score: 0 },
  { code: 'strike', display: '✊', alt: 'strike', score: 0 },
  { code: 'workers', display: '👷', alt: 'workers', score: 0 },
];

// Build lookup map for O(1) access to standard emojis
const STANDARD_EMOJI_MAP = new Map<string, Emoji>();
for (const emoji of STANDARD_EMOJIS) {
  STANDARD_EMOJI_MAP.set(emoji.code, emoji);
}

/**
 * Convert a CustomEmote from the database to our Emoji interface
 */
function customEmoteToEmoji(emote: CustomEmote): Emoji {
  return {
    code: emote.code,
    display: emote.url,
    isCustom: true,
    alt: emote.alt,
    score: 1, // Custom emotes are always first in autocomplete
  };
}

/**
 * Get an emoji by its shortcode (without colons)
 * Checks custom emotes first (from database), then standard emojis
 */
export function getEmoji(code: string): Emoji | undefined {
  // Check custom emotes first (they can override standard ones)
  const customEmotes = getCachedEmotes();
  const customMatch = customEmotes.find((e) => e.code === code);
  if (customMatch) {
    return customEmoteToEmoji(customMatch);
  }
  
  // Fall back to standard emojis
  return STANDARD_EMOJI_MAP.get(code);
}

/**
 * Get all available emojis (standard + custom from database)
 */
export function getAllEmojis(): Emoji[] {
  const customEmotes = getCachedEmotes().map(customEmoteToEmoji);
  return [...customEmotes, ...STANDARD_EMOJIS].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Get only standard emojis (no custom)
 */
export function getStandardEmojis(): Emoji[] {
  return [...STANDARD_EMOJIS];
}

/**
 * Get only custom emotes from the database
 */
export function getCustomEmojis(): Emoji[] {
  return getCachedEmotes().map(customEmoteToEmoji);
}

/**
 * Get custom emote categories from the database
 * Returns unique category names with their emotes
 */
export function getCustomEmoteCategories(): { category: string; emojis: Emoji[] }[] {
  const emotes = getCachedEmotes();
  const categoryMap = new Map<string, Emoji[]>();
  
  for (const emote of emotes) {
    const category = emote.category || 'custom';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(customEmoteToEmoji(emote));
  }
  
  return Array.from(categoryMap.entries()).map(([category, emojis]) => ({
    category,
    emojis,
  }));
}

/**
 * Regex to match emoji shortcodes like :smile: or :+1:
 * Matches: colon, one or more word chars/hyphens/plus/digits, colon
 */
const SHORTCODE_REGEX = /:([a-zA-Z0-9_+-]+):/g;

/**
 * Render an emoji - either as unicode or as an image for custom emotes
 */
function renderEmoji(emoji: Emoji, key: string | number): ReactNode {
  if (emoji.isCustom) {
    return (
      <img
        key={key}
        src={emoji.display}
        alt={emoji.alt}
        title={`:${emoji.code}:`}
        className="chat-emoji chat-emoji-custom"
        loading="lazy"
      />
    );
  }
  return (
    <span key={key} className="chat-emoji" title={`:${emoji.code}:`} role="img" aria-label={emoji.alt}>
      {emoji.display}
    </span>
  );
}

/**
 * Parse message content and replace shortcodes with rendered emojis
 * Returns an array of ReactNodes (strings and emoji elements)
 */
export function parseEmojis(content: string): ReactNode[] {
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  // Reset regex state
  SHORTCODE_REGEX.lastIndex = 0;

  while ((match = SHORTCODE_REGEX.exec(content)) !== null) {
    const [fullMatch, code] = match;
    // Use getEmoji which checks custom emotes first, then standard
    const emoji = getEmoji(code);

    // Add text before the match
    if (match.index > lastIndex) {
      result.push(content.slice(lastIndex, match.index));
    }

    if (emoji) {
      // Render the emoji
      result.push(renderEmoji(emoji, `emoji-${keyCounter++}`));
    } else {
      // Unknown shortcode - keep as-is
      result.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    result.push(content.slice(lastIndex));
  }

  // If no matches, return original content
  if (result.length === 0) {
    return [content];
  }

  return result;
}

/**
 * Component to render message content with emoji parsing
 */
export function EmojiText({ children }: { children: string }) {
  const parsed = parseEmojis(children);
  return <>{parsed.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}
