-- Fix reactions broadcast trigger to handle missing messages gracefully
-- and ensure proper search_path for the trigger function

CREATE OR REPLACE FUNCTION room_reactions_broadcast_trigger()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public, extensions'
LANGUAGE plpgsql
AS $$
DECLARE
  msg_room public.chat_room;
BEGIN
  -- obtain room from messages table using message_id
  IF TG_OP = 'DELETE' THEN
    SELECT room INTO msg_room FROM public.messages WHERE id = OLD.message_id;
    -- Only broadcast if we found the room
    IF msg_room IS NOT NULL THEN
      PERFORM realtime.broadcast_changes(
        'room:' || msg_room::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NULL,
        OLD
      );
    END IF;
    RETURN OLD;
  ELSE
    SELECT room INTO msg_room FROM public.messages WHERE id = NEW.message_id;
    -- Only broadcast if we found the room
    IF msg_room IS NOT NULL THEN
      PERFORM realtime.broadcast_changes(
        'room:' || msg_room::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        NULL
      );
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Also fix the messages broadcast trigger to have proper search_path
CREATE OR REPLACE FUNCTION room_messages_broadcast_trigger()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public, extensions'
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
