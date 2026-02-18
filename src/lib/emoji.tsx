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
}

// Standard emoji shortcodes
// Based on common shortcode conventions (Slack, Discord, GitHub)
const STANDARD_EMOJIS: Emoji[] = [
  // Smileys & People
  { code: 'smile', display: '😊', alt: 'smiling face' },
  { code: 'grin', display: '😀', alt: 'grinning face' },
  { code: 'joy', display: '😂', alt: 'face with tears of joy' },
  { code: 'rofl', display: '🤣', alt: 'rolling on the floor laughing' },
  { code: 'wink', display: '😉', alt: 'winking face' },
  { code: 'blush', display: '😊', alt: 'blushing face' },
  { code: 'heart_eyes', display: '😍', alt: 'heart eyes' },
  { code: 'kissing_heart', display: '😘', alt: 'kissing heart' },
  { code: 'thinking', display: '🤔', alt: 'thinking face' },
  { code: 'raised_eyebrow', display: '🤨', alt: 'raised eyebrow' },
  { code: 'neutral_face', display: '😐', alt: 'neutral face' },
  { code: 'expressionless', display: '😑', alt: 'expressionless' },
  { code: 'unamused', display: '😒', alt: 'unamused' },
  { code: 'rolling_eyes', display: '🙄', alt: 'rolling eyes' },
  { code: 'grimacing', display: '😬', alt: 'grimacing' },
  { code: 'relieved', display: '😌', alt: 'relieved' },
  { code: 'pensive', display: '😔', alt: 'pensive' },
  { code: 'sleepy', display: '😪', alt: 'sleepy' },
  { code: 'drooling', display: '🤤', alt: 'drooling' },
  { code: 'sleeping', display: '😴', alt: 'sleeping' },
  { code: 'mask', display: '😷', alt: 'mask' },
  { code: 'nerd', display: '🤓', alt: 'nerd face' },
  { code: 'sunglasses', display: '😎', alt: 'sunglasses' },
  { code: 'clown', display: '🤡', alt: 'clown' },
  { code: 'cowboy', display: '🤠', alt: 'cowboy' },
  { code: 'partying', display: '🥳', alt: 'partying' },
  { code: 'smirk', display: '😏', alt: 'smirk' },
  { code: 'disappointed', display: '😞', alt: 'disappointed' },
  { code: 'worried', display: '😟', alt: 'worried' },
  { code: 'angry', display: '😠', alt: 'angry' },
  { code: 'rage', display: '😡', alt: 'rage' },
  { code: 'cry', display: '😢', alt: 'crying' },
  { code: 'sob', display: '😭', alt: 'sobbing' },
  { code: 'scream', display: '😱', alt: 'screaming' },
  { code: 'flushed', display: '😳', alt: 'flushed' },
  { code: 'dizzy_face', display: '😵', alt: 'dizzy' },
  { code: 'exploding_head', display: '🤯', alt: 'exploding head' },
  { code: 'shush', display: '🤫', alt: 'shushing' },
  { code: 'lying', display: '🤥', alt: 'lying' },
  { code: 'no_mouth', display: '😶', alt: 'no mouth' },
  { code: 'zipper_mouth', display: '🤐', alt: 'zipper mouth' },
  { code: 'money_mouth', display: '🤑', alt: 'money mouth' },
  { code: 'hugs', display: '🤗', alt: 'hugging' },
  { code: 'shrug', display: '🤷', alt: 'shrug' },
  { code: 'facepalm', display: '🤦', alt: 'facepalm' },
  { code: 'salute', display: '🫡', alt: 'salute' },
  
  // Gestures
  { code: 'thumbsup', display: '👍', alt: 'thumbs up' },
  { code: '+1', display: '👍', alt: 'thumbs up' },
  { code: 'thumbsdown', display: '👎', alt: 'thumbs down' },
  { code: '-1', display: '👎', alt: 'thumbs down' },
  { code: 'ok_hand', display: '👌', alt: 'ok hand' },
  { code: 'pinched_fingers', display: '🤌', alt: 'pinched fingers' },
  { code: 'pinching_hand', display: '🤏', alt: 'pinching hand' },
  { code: 'v', display: '✌️', alt: 'peace' },
  { code: 'crossed_fingers', display: '🤞', alt: 'crossed fingers' },
  { code: 'love_you', display: '🤟', alt: 'love you' },
  { code: 'metal', display: '🤘', alt: 'metal' },
  { code: 'call_me', display: '🤙', alt: 'call me' },
  { code: 'point_left', display: '👈', alt: 'point left' },
  { code: 'point_right', display: '👉', alt: 'point right' },
  { code: 'point_up', display: '👆', alt: 'point up' },
  { code: 'point_down', display: '👇', alt: 'point down' },
  { code: 'middle_finger', display: '🖕', alt: 'middle finger' },
  { code: 'raised_hand', display: '✋', alt: 'raised hand' },
  { code: 'wave', display: '👋', alt: 'wave' },
  { code: 'clap', display: '👏', alt: 'clap' },
  { code: 'raised_hands', display: '🙌', alt: 'raised hands' },
  { code: 'open_hands', display: '👐', alt: 'open hands' },
  { code: 'palms_up', display: '🤲', alt: 'palms up' },
  { code: 'handshake', display: '🤝', alt: 'handshake' },
  { code: 'pray', display: '🙏', alt: 'pray' },
  { code: 'writing_hand', display: '✍️', alt: 'writing' },
  { code: 'muscle', display: '💪', alt: 'muscle' },
  { code: 'fist', display: '✊', alt: 'fist' },
  { code: 'punch', display: '👊', alt: 'punch' },
  
  // Hearts & Symbols
  { code: 'heart', display: '❤️', alt: 'heart' },
  { code: 'orange_heart', display: '🧡', alt: 'orange heart' },
  { code: 'yellow_heart', display: '💛', alt: 'yellow heart' },
  { code: 'green_heart', display: '💚', alt: 'green heart' },
  { code: 'blue_heart', display: '💙', alt: 'blue heart' },
  { code: 'purple_heart', display: '💜', alt: 'purple heart' },
  { code: 'black_heart', display: '🖤', alt: 'black heart' },
  { code: 'broken_heart', display: '💔', alt: 'broken heart' },
  { code: 'fire', display: '🔥', alt: 'fire' },
  { code: 'sparkles', display: '✨', alt: 'sparkles' },
  { code: 'star', display: '⭐', alt: 'star' },
  { code: 'zap', display: '⚡', alt: 'zap' },
  { code: 'boom', display: '💥', alt: 'boom' },
  { code: '100', display: '💯', alt: 'hundred' },
  { code: 'check', display: '✅', alt: 'check' },
  { code: 'x', display: '❌', alt: 'x' },
  { code: 'question', display: '❓', alt: 'question' },
  { code: 'exclamation', display: '❗', alt: 'exclamation' },
  { code: 'warning', display: '⚠️', alt: 'warning' },
  
  // Objects & Tech
  { code: 'eyes', display: '👀', alt: 'eyes' },
  { code: 'brain', display: '🧠', alt: 'brain' },
  { code: 'skull', display: '💀', alt: 'skull' },
  { code: 'poop', display: '💩', alt: 'poop' },
  { code: 'robot', display: '🤖', alt: 'robot' },
  { code: 'alien', display: '👽', alt: 'alien' },
  { code: 'ghost', display: '👻', alt: 'ghost' },
  { code: 'computer', display: '💻', alt: 'computer' },
  { code: 'keyboard', display: '⌨️', alt: 'keyboard' },
  { code: 'desktop', display: '🖥️', alt: 'desktop' },
  { code: 'phone', display: '📱', alt: 'phone' },
  { code: 'bug', display: '🐛', alt: 'bug' },
  { code: 'rocket', display: '🚀', alt: 'rocket' },
  { code: 'gear', display: '⚙️', alt: 'gear' },
  { code: 'wrench', display: '🔧', alt: 'wrench' },
  { code: 'hammer', display: '🔨', alt: 'hammer' },
  { code: 'tools', display: '🛠️', alt: 'tools' },
  { code: 'lock', display: '🔒', alt: 'lock' },
  { code: 'key', display: '🔑', alt: 'key' },
  { code: 'bulb', display: '💡', alt: 'light bulb' },
  { code: 'mag', display: '🔍', alt: 'magnifying glass' },
  { code: 'link', display: '🔗', alt: 'link' },
  { code: 'paperclip', display: '📎', alt: 'paperclip' },
  { code: 'clipboard', display: '📋', alt: 'clipboard' },
  { code: 'memo', display: '📝', alt: 'memo' },
  { code: 'book', display: '📖', alt: 'book' },
  { code: 'books', display: '📚', alt: 'books' },
  { code: 'calendar', display: '📅', alt: 'calendar' },
  { code: 'chart', display: '📈', alt: 'chart' },
  { code: 'chart_down', display: '📉', alt: 'chart down' },
  { code: 'money', display: '💰', alt: 'money' },
  { code: 'dollar', display: '💵', alt: 'dollar' },
  { code: 'credit_card', display: '💳', alt: 'credit card' },
  
  // Food & Drink
  { code: 'coffee', display: '☕', alt: 'coffee' },
  { code: 'tea', display: '🍵', alt: 'tea' },
  { code: 'beer', display: '🍺', alt: 'beer' },
  { code: 'beers', display: '🍻', alt: 'beers' },
  { code: 'wine', display: '🍷', alt: 'wine' },
  { code: 'cocktail', display: '🍸', alt: 'cocktail' },
  { code: 'pizza', display: '🍕', alt: 'pizza' },
  { code: 'burger', display: '🍔', alt: 'burger' },
  { code: 'fries', display: '🍟', alt: 'fries' },
  { code: 'taco', display: '🌮', alt: 'taco' },
  { code: 'cake', display: '🎂', alt: 'cake' },
  { code: 'cookie', display: '🍪', alt: 'cookie' },
  { code: 'popcorn', display: '🍿', alt: 'popcorn' },
  
  // Nature & Animals
  { code: 'sun', display: '☀️', alt: 'sun' },
  { code: 'moon', display: '🌙', alt: 'moon' },
  { code: 'cloud', display: '☁️', alt: 'cloud' },
  { code: 'rain', display: '🌧️', alt: 'rain' },
  { code: 'rainbow', display: '🌈', alt: 'rainbow' },
  { code: 'tree', display: '🌳', alt: 'tree' },
  { code: 'flower', display: '🌸', alt: 'flower' },
  { code: 'dog', display: '🐕', alt: 'dog' },
  { code: 'cat', display: '🐈', alt: 'cat' },
  { code: 'unicorn', display: '🦄', alt: 'unicorn' },
  { code: 'snake', display: '🐍', alt: 'snake' },
  { code: 'turtle', display: '🐢', alt: 'turtle' },
  { code: 'crab', display: '🦀', alt: 'crab' },
  { code: 'octopus', display: '🐙', alt: 'octopus' },
  
  // Dev & Work culture
  { code: 'shipit', display: '🚀', alt: 'ship it' },
  { code: 'lgtm', display: '👍', alt: 'looks good to me' },
  { code: 'wfh', display: '🏠', alt: 'work from home' },
  { code: 'meeting', display: '📅', alt: 'meeting' },
  { code: 'standup', display: '🧍', alt: 'standup' },
  { code: 'deploy', display: '🚀', alt: 'deploy' },
  { code: 'hotfix', display: '🔥', alt: 'hotfix' },
  { code: 'revert', display: '⏪', alt: 'revert' },
  { code: 'merge', display: '🔀', alt: 'merge' },
  { code: 'pr', display: '📝', alt: 'pull request' },
  { code: 'review', display: '👀', alt: 'review' },
  { code: 'approved', display: '✅', alt: 'approved' },
  { code: 'rejected', display: '❌', alt: 'rejected' },
  { code: 'wip', display: '🚧', alt: 'work in progress' },
  { code: 'todo', display: '📋', alt: 'todo' },
  { code: 'done', display: '✅', alt: 'done' },
  { code: 'blocked', display: '🚫', alt: 'blocked' },
  
  // Solidarity / Union
  { code: 'solidarity', display: '✊', alt: 'solidarity' },
  { code: 'union', display: '🤝', alt: 'union' },
  { code: 'fair-go', display: '⚖️', alt: 'fair go' },
  { code: 'strike', display: '✊', alt: 'strike' },
  { code: 'workers', display: '👷', alt: 'workers' },
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
  return [...STANDARD_EMOJIS, ...customEmotes];
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
