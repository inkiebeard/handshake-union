import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatRoom, Message, Reaction } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChatContextValue {
  messages: Message[];
  reactions: Reaction[];
  loading: boolean;
  error: string | null;
  currentRoom: ChatRoom | null;
  joinRoom: (room: ChatRoom) => void;
  leaveRoom: (room: ChatRoom) => void;
  sendMessage: (content: string, replyToId?: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  reportMessage: (id: string, reason?: string) => Promise<string>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);


export function ChatProvider({ children, userId }: { children: React.ReactNode; userId: string | undefined }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);

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

  // Fetch messages for a room
  const fetchMessages = useCallback(async (room: ChatRoom) => {
    setLoading(true);
    setError(null);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('room', room)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const withPseudonyms = await attachPseudonyms(data ?? []);
    setMessages(withPseudonyms);
    setLoading(false);
  }, [attachPseudonyms]);

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
  const leaveRoom = useCallback((room?: ChatRoom) => {
    console.log('Leaving room:', room);
    
    if (channelRef.current && (room === undefined || channelRef.current.subTopic !== `room:${room}`)) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setCurrentRoom(null);
    setMessages([]);
    setReactions([]);
  }, []);

  // Join a chat room (subscribe to realtime via broadcast)
  const joinRoom = useCallback((room: ChatRoom) => {
    console.log('Joining room:', room);
    
    channelRef.current && room !== (channelRef.current.subTopic?.replace('room:', '') as ChatRoom) && leaveRoom(channelRef.current.subTopic?.replace('room:', '') as ChatRoom);

    setCurrentRoom(room);
    fetchMessages(room);

    // Channel name must match the trigger topic: 'room:<room>'
    const channelName = `room:${room}`;
    
    // Subscribe to broadcast events (from realtime.broadcast_changes triggers)
    const channel = supabase
      .channel(channelName, { config: { private: true } })
      // Message INSERT events
      .on('broadcast', { event: 'INSERT' }, async (payload) => {
        console.log('Broadcast INSERT received:', payload);
        // Check if this is a message (has room field) or reaction (has message_id field)
        const record = payload.payload?.record || payload.payload;
        
        if (record && 'room' in record) {
          // This is a message
          const newMsg = record as Message;
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
        console.log('Broadcast DELETE received:', payload);
        const record = payload.payload?.old_record || payload.payload?.record || payload.payload;
        
        if (record && record.id) {
          // Try to remove from both messages and reactions
          setMessages((prev) => prev.filter((m) => m.id !== record.id));
          setReactions((prev) => prev.filter((r) => r.id !== record.id));
        }
      })
      // Message UPDATE events (if needed)
      .on('broadcast', { event: 'UPDATE' }, async (payload) => {
        console.log('Broadcast UPDATE received:', payload);
        const record = payload.payload?.record || payload.payload;
        
        if (record && 'room' in record) {
          // Update message
          const updatedMsg = record as Message;
          const pseudonym = await resolvePseudonym(updatedMsg.profile_id);
          const enriched: Message = {
            ...updatedMsg,
            profiles: { pseudonym },
          };
          setMessages((prev) => prev.map((m) => m.id === enriched.id ? enriched : m));
        }
      })
      .subscribe((status, err) => {
        console.log('Room subscription status:', status, err);
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to ${channelName}`);
        }
      });

    channelRef.current = channel;
  }, [fetchMessages, resolvePseudonym, leaveRoom]);

  // Fetch reactions when messages change
  useEffect(() => {
    const messageIds = messages.map((m) => m.id);
    if (messageIds.length > 0) {
      fetchReactions(messageIds);
    }
  }, [messages, fetchReactions]);

  // Prune expired messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      setMessages((prev) => prev.filter((m) => m.created_at >= oneHourAgo));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!userId) throw new Error('Not authenticated');
      if (!currentRoom) throw new Error('Not in a room');

      const trimmed = content.trim();
      if (!trimmed || trimmed.length > 2000) {
        throw new Error('Message must be 1-2000 characters');
      }

      const { error: insertError } = await supabase.from('messages').insert({
        room: currentRoom,
        profile_id: userId,
        content: trimmed,
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
    error,
    currentRoom,
    joinRoom,
    leaveRoom,
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
