import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { preloadImages } from '../lib/imagePreloadCache';
import type { ChatRoom, Message, Reaction } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PAGE_SIZE = 50;

interface ChatContextValue {
  messages: Message[];
  reactions: Reaction[];
  loading: boolean;
  loadingOlder: boolean;
  hasMoreMessages: boolean;
  error: string | null;
  loadOlderError: string | null;
  currentRoom: ChatRoom | null;
  joinRoom: (room: ChatRoom) => void;
  leaveRoom: (room: ChatRoom) => void;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (content: string, imageUrl?: string | null, replyToId?: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  reportMessage: (id: string, reason?: string) => Promise<string>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);


export function ChatProvider({ children, userId }: { children: React.ReactNode; userId: string | undefined }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);

  // Composite cursor for pagination: both created_at and id of the oldest loaded message.
  // Using only created_at is unsafe — multiple rows can share the same timestamp (bursty
  // traffic, batch inserts), so a single-column .lt cursor silently skips those rows.
  // (created_at < T) OR (created_at = T AND id < cursor_id) with ORDER BY created_at DESC,
  // id DESC gives a fully-stable, gap-free page boundary regardless of timestamp collisions.
  const oldestCursorRef = useRef<{ created_at: string; id: string } | undefined>(undefined);

  // Mirrors currentRoom state synchronously so loadOlderMessages can detect stale responses
  // after an async fetch without closing over a potentially-stale state value.
  const activeRoomRef = useRef<ChatRoom | null>(null);

  // Mirrors loadingOlder state synchronously so the guard in loadOlderMessages doesn't need
  // loadingOlder in its dependency array (which would cause unnecessary callback churn).
  const loadingOlderRef = useRef(false);

  // Ref to hold active channel (single channel per room for both messages and reactions)
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Cache pseudonyms: profile_id -> pseudonym
  const pseudonymCache = useRef<Map<string, string>>(new Map());

  // Resolve pseudonym for a profile_id
  const resolvePseudonym = useCallback(async (profileId: string): Promise<string> => {
    const cached = pseudonymCache.current.get(profileId);
    if (cached) return cached;

    const { data, error: rpcError } = await supabase.rpc('get_pseudonym', {
      user_id: profileId,
    });

    if (rpcError || !data) return 'unknown';

    pseudonymCache.current.set(profileId, data);
    return data;
  }, []);

  // Attach pseudonyms to messages
  const attachPseudonyms = useCallback(
    async (msgs: Message[]): Promise<Message[]> => {
      const uniqueIds = [...new Set(msgs.map((m) => m.profile_id))];
      await Promise.all(uniqueIds.map((id) => resolvePseudonym(id)));

      return msgs.map((m) => ({
        ...m,
        profiles: { pseudonym: pseudonymCache.current.get(m.profile_id) ?? 'unknown' },
      }));
    },
    [resolvePseudonym]
  );

  // Fetch the most recent PAGE_SIZE messages for a room
  const fetchMessages = useCallback(async (room: ChatRoom) => {
    setLoading(true);
    setError(null);
    setHasMoreMessages(false);

    // Fetch one extra row — if we get PAGE_SIZE + 1 back, there are older messages waiting.
    // Secondary sort on id gives a stable, deterministic order when multiple messages share
    // the same created_at timestamp, which is required for the composite cursor to work.
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('room', room)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const hasMore = (data ?? []).length > PAGE_SIZE;
    const page = (data ?? []).slice(0, PAGE_SIZE).reverse(); // flip to ascending for display
    const withPseudonyms = await attachPseudonyms(page);

    setMessages(withPseudonyms);
    const oldest = withPseudonyms[0];
    oldestCursorRef.current = oldest ? { created_at: oldest.created_at, id: oldest.id } : undefined;
    setHasMoreMessages(hasMore);
    setLoading(false);
  }, [attachPseudonyms]);

  // Load the next page of older messages (prepend to list)
  const loadOlderMessages = useCallback(async () => {
    // Use refs for guards so this callback doesn't need currentRoom/loadingOlder in its
    // dep array — prevents unnecessary recreation on every loadingOlder state toggle.
    const room = activeRoomRef.current;
    if (!room || loadingOlderRef.current) return;
    const cursor = oldestCursorRef.current;
    if (!cursor) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setLoadOlderError(null);

    // Composite cursor: (created_at < T) OR (created_at = T AND id < cursor_id).
    // This is safe even when multiple messages share the same timestamp — a plain
    // .lt('created_at', T) would permanently skip any same-timestamp rows that fell
    // past the page boundary.  Secondary id sort must match the ORDER BY below.
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('room', room)
      .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (fetchError) {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
      setLoadOlderError('failed to load older messages — tap to retry');
      return;
    }

    // Discard if the user switched rooms while the fetch was in-flight.
    if (activeRoomRef.current !== room) {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
      return;
    }

    const hasMore = (data ?? []).length > PAGE_SIZE;
    const page = (data ?? []).slice(0, PAGE_SIZE).reverse();
    const withPseudonyms = await attachPseudonyms(page);

    // Guard again after the async pseudonym resolution pass.
    if (activeRoomRef.current !== room) {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
      return;
    }

    // Pre-warm the browser image cache before the DOM mutation.
    // When <img> elements are first painted they will render from cache at their
    // correct intrinsic size — MessageImage reads the cache on lazy init and skips
    // the loading skeleton entirely, so no post-paint layout shifts corrupt the
    // scroll-anchor restoration.
    const imageUrls = withPseudonyms.filter(m => m.image_url).map(m => m.image_url!);
    if (imageUrls.length > 0) {
      await preloadImages(imageUrls);
      // Guard once more: preloading is async and a room switch could have happened.
      if (activeRoomRef.current !== room) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
        return;
      }
    }

    setMessages((prev) => [...withPseudonyms, ...prev]);
    if (withPseudonyms.length > 0) {
      const oldest = withPseudonyms[0];
      oldestCursorRef.current = { created_at: oldest.created_at, id: oldest.id };
    }
    setHasMoreMessages(hasMore);
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [attachPseudonyms]); // currentRoom and loadingOlder intentionally omitted — accessed via refs

  // Fetch reactions for visible messages
  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) {
      setReactions([]);
      return;
    }

    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .in('message_id', messageIds);

    if (!error && data) {
      setReactions(data);
    }
  }, []);

  // Leave current room (unsubscribe)
  const leaveRoom = useCallback((_room?: ChatRoom) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    activeRoomRef.current = null;
    setCurrentRoom(null);
    setMessages([]);
    setReactions([]);
    setHasMoreMessages(false);
    setLoadOlderError(null);
    oldestCursorRef.current = undefined;
  }, []);

  // Join a chat room (subscribe to realtime via broadcast)
  const joinRoom = useCallback((room: ChatRoom) => {
    // If already subscribed to this exact room, do nothing
    if (channelRef.current?.subTopic === `room:${room}`) return;

    // Tear down any existing subscription for a different room
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    activeRoomRef.current = room;
    setCurrentRoom(room);
    fetchMessages(room);

    // Channel name must match the trigger topic: 'room:<room>'
    const channelName = `room:${room}`;
    
    // Subscribe to broadcast events (from realtime.broadcast_changes triggers)
    const channel = supabase
      .channel(channelName, { config: { private: true } })
      // Message INSERT events
      .on('broadcast', { event: 'INSERT' }, async (payload) => {
        // Check if this is a message (has room field) or reaction (has message_id field)
        const record = payload.payload?.record || payload.payload;
        
        if (record && 'room' in record) {
          // This is a message — guard against cross-room broadcast leakage
          const newMsg = record as Message;
          if (newMsg.room !== room) return;
          const pseudonym = await resolvePseudonym(newMsg.profile_id);
          const enriched: Message = {
            ...newMsg,
            profiles: { pseudonym },
          };
          setMessages((prev) => {
            // Dedupe by id
            if (prev.some((m) => m.id === enriched.id)) return prev;
            return [...prev, enriched];
          });
        } else if (record && 'message_id' in record) {
          // This is a reaction
          const newReaction = record as Reaction;
          setReactions((prev) => {
            if (prev.some((r) => r.id === newReaction.id)) return prev;
            return [...prev, newReaction];
          });
        }
      })
      // Message/Reaction DELETE events
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        const record = payload.payload?.old_record || payload.payload?.record || payload.payload;
        
        if (record && record.id) {
          // Try to remove from both messages and reactions
          setMessages((prev) => prev.filter((m) => m.id !== record.id));
          setReactions((prev) => prev.filter((r) => r.id !== record.id));
        }
      })
      // Message UPDATE events (if needed)
      .on('broadcast', { event: 'UPDATE' }, async (payload) => {
        const record = payload.payload?.record || payload.payload;
        
        if (record && 'room' in record) {
          // Update message — guard against cross-room broadcast leakage
          const updatedMsg = record as Message;
          if (updatedMsg.room !== room) return;
          const pseudonym = await resolvePseudonym(updatedMsg.profile_id);
          const enriched: Message = {
            ...updatedMsg,
            profiles: { pseudonym },
          };
          setMessages((prev) => prev.map((m) => m.id === enriched.id ? enriched : m));
        }
      })
      .subscribe((_status, _err) => {
        // Subscription lifecycle — no logging to avoid leaking room/payload data
      });

    channelRef.current = channel;
  }, [fetchMessages, resolvePseudonym]);

  // Fetch reactions when messages change
  useEffect(() => {
    const messageIds = messages.map((m) => m.id);
    if (messageIds.length > 0) {
      fetchReactions(messageIds);
    }
  }, [messages, fetchReactions]);

  // Prune expired messages every minute (72-hour TTL matches server-side retention).
  // Also keeps oldestCursorRef aligned with the actual oldest in-memory message so
  // the pagination cursor doesn't point to a row that no longer exists in the client state.
  useEffect(() => {
    const interval = setInterval(() => {
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      setMessages((prev) => {
        const remaining = prev.filter((m) => m.created_at >= seventyTwoHoursAgo);
        const oldest = remaining[0];
        oldestCursorRef.current = oldest ? { created_at: oldest.created_at, id: oldest.id } : undefined;
        return remaining;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string, imageUrl?: string | null, replyToId?: string) => {
      if (!userId) throw new Error('Not authenticated');
      if (!currentRoom) throw new Error('Not in a room');

      const trimmedContent = content.trim() || null;
      const trimmedImageUrl = imageUrl?.trim() || null;

      if (!trimmedContent && !trimmedImageUrl) {
        throw new Error('Message must have content or an image');
      }
      if (trimmedContent && trimmedContent.length > 2000) {
        throw new Error('Message content must be 2000 characters or fewer');
      }

      const { error: insertError } = await supabase.from('messages').insert({
        room: currentRoom,
        profile_id: userId,
        content: trimmedContent,
        image_url: trimmedImageUrl,
        reply_to_id: replyToId ?? null,
      });

      if (insertError) throw new Error(insertError.message);
    },
    [currentRoom, userId]
  );

  // Delete message
  const deleteMessage = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);
  }, []);

  // Report message
  const reportMessage = useCallback(async (id: string, reason?: string): Promise<string> => {
    const { data, error: rpcError } = await supabase.rpc('report_message', {
      target_message_id: id,
      report_reason: reason ?? null,
    });

    if (rpcError) throw new Error(rpcError.message);
    return data as string;
  }, []);

  // Toggle reaction
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;

      const existing = reactions.find(
        (r) => r.message_id === messageId && r.profile_id === userId && r.emoji === emoji
      );

      if (existing) {
        // Remove reaction
        const { error } = await supabase.from('reactions').delete().eq('id', existing.id);
        if (error) throw new Error(error.message);
      } else {
        // Add reaction
        const { error } = await supabase.from('reactions').insert({
          message_id: messageId,
          profile_id: userId,
          emoji,
        });
        if (error) throw new Error(error.message);
      }
    },
    [userId, reactions]
  );

  const value: ChatContextValue = {
    messages,
    reactions,
    loading,
    loadingOlder,
    hasMoreMessages,
    error,
    loadOlderError,
    currentRoom,
    joinRoom,
    leaveRoom,
    loadOlderMessages,
    sendMessage,
    deleteMessage,
    reportMessage,
    toggleReaction,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
