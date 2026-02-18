import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../contexts/ChatContext';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { CHAT_ROOMS } from '../lib/constants';
import type { ChatRoom, Message } from '../types/database';

export function Chat() {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ChatRoom>('general');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const {
    messages,
    reactions: rawReactions,
    loading,
    error,
    joinRoom,
    leaveRoom,
    sendMessage,
    deleteMessage,
    reportMessage,
    toggleReaction,
  } = useChat();

  // Join room when component mounts or room changes
  useEffect(() => {
    if (activeRoom) joinRoom(activeRoom);
  }, [activeRoom, joinRoom]);

  // Build reaction map from raw reactions
  const reactions = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { count: number; reacted: boolean; reactionId?: string }>
    >();

    for (const r of rawReactions) {
      if (!map.has(r.message_id)) {
        map.set(r.message_id, new Map());
      }
      const msgReactions = map.get(r.message_id)!;
      const existing = msgReactions.get(r.emoji);

      if (existing) {
        existing.count++;
        if (r.profile_id === user?.id) {
          existing.reacted = true;
          existing.reactionId = r.id;
        }
      } else {
        msgReactions.set(r.emoji, {
          count: 1,
          reacted: r.profile_id === user?.id,
          reactionId: r.profile_id === user?.id ? r.id : undefined,
        });
      }
    }

    return map;
  }, [rawReactions, user?.id]);

  const handleRoomChange = (room: ChatRoom) => {
    if (activeRoom) leaveRoom(activeRoom);
    setActiveRoom(room);
    setReplyTo(null);
    setReportFeedback(null);
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleReport = async (id: string) => {
    const reason = window.prompt('Reason for report (optional):');
    if (reason === null) return; // cancelled

    try {
      await reportMessage(id, reason || undefined);
      setReportFeedback('report submitted');
      setTimeout(() => setReportFeedback(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to report';
      setReportFeedback(`error: ${msg}`);
      setTimeout(() => setReportFeedback(null), 5000);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction(messageId, emoji);
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  return (
    <section className="section chat-section">
      <div className="container">
        <div className="chat-header">
          <p className="prompt">chat</p>
          <p className="comment">ephemeral rooms — messages expire after 1 hour</p>
        </div>

        {/* Room tabs */}
        <div className="tabs">
          <ul>
            {CHAT_ROOMS.map((room) => (
              <li
                key={room.id}
                className={activeRoom === room.id ? 'is-active' : ''}
              >
                <a onClick={() => handleRoomChange(room.id)} title={room.description}>
                  {room.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Error / feedback banner */}
        {error && (
          <div className="notification is-danger">
            <span className="comment">{error}</span>
          </div>
        )}
        {reportFeedback && (
          <div className="chat-feedback">
            <span className="comment">{reportFeedback}</span>
          </div>
        )}

        {/* Chat area */}
        <div className="chat-container">
          <MessageList
            messages={messages}
            currentUserId={user?.id}
            reactions={reactions}
            loading={loading}
            onReply={handleReply}
            onDelete={handleDelete}
            onReport={handleReport}
            onReaction={handleReaction}
          />

          <MessageInput
            onSend={sendMessage}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
            disabled={!user}
          />
        </div>
      </div>
    </section>
  );
}
