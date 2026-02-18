-- ============================================
-- Broadcast Triggers for Realtime Chat
-- ============================================
-- Uses realtime.broadcast_changes to send events to room channels
-- Client subscribes to 'room:<room>' and listens for broadcast events

-- 1) Trigger function to broadcast changes for messages
CREATE OR REPLACE FUNCTION room_messages_broadcast_trigger()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.room, OLD.room)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Trigger for messages
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION room_messages_broadcast_trigger();

-- 3) Trigger function for reactions (reactions reference messages -> need room from messages)
CREATE OR REPLACE FUNCTION room_reactions_broadcast_trigger()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  msg_room public.chat_room;
BEGIN
  -- obtain room from messages table using message_id
  IF TG_OP = 'DELETE' THEN
    SELECT room INTO msg_room FROM public.messages WHERE id = OLD.message_id;
    PERFORM realtime.broadcast_changes('room:' || COALESCE(msg_room, '')::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NULL, OLD);
    RETURN OLD;
  ELSE
    SELECT room INTO msg_room FROM public.messages WHERE id = NEW.message_id;
    PERFORM realtime.broadcast_changes('room:' || COALESCE(msg_room, '')::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, NULL);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS reactions_broadcast_trigger ON public.reactions;
CREATE TRIGGER reactions_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION room_reactions_broadcast_trigger();

-- 4) Indexes to help RLS performance
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON public.reactions(message_id);

-- 5) RLS policies on realtime.messages to allow authenticated users to SELECT and INSERT for room topics
-- realtime.messages.topic contains the channel topic; we allow SELECT/INSERT when topic starts with 'room:'

-- Allow select (drop if exists first to avoid errors)
DROP POLICY IF EXISTS "room_members_can_read" ON realtime.messages;
CREATE POLICY "room_members_can_read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (topic LIKE 'room:%');

-- Allow insert (clients sending broadcasts)
DROP POLICY IF EXISTS "room_members_can_write" ON realtime.messages;
CREATE POLICY "room_members_can_write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (topic LIKE 'room:%');
