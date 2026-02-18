-- ============================================
-- Custom Emotes Table
-- ============================================
-- Stores custom emotes (GIFs, images) that can be used in chat
-- via shortcodes like :partyparrot: or :dumpsterfire:

CREATE TABLE IF NOT EXISTS public.custom_emotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  url text NOT NULL,
  alt text NOT NULL,
  category text DEFAULT 'custom',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Ensure code follows shortcode format (lowercase, alphanumeric, hyphens, underscores)
  CONSTRAINT valid_emote_code CHECK (code ~ '^[a-z0-9_-]+$')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_custom_emotes_code ON public.custom_emotes(code);
CREATE INDEX IF NOT EXISTS idx_custom_emotes_enabled ON public.custom_emotes(enabled) WHERE enabled = true;

-- RLS policies
ALTER TABLE public.custom_emotes ENABLE ROW LEVEL SECURITY;

-- Everyone can read enabled emotes
CREATE POLICY "Anyone can read enabled emotes"
  ON public.custom_emotes
  FOR SELECT
  USING (enabled = true);

-- Only admins can manage emotes (uses is_admin() from 007_roles.sql)
CREATE POLICY "Admins can manage emotes"
  ON public.custom_emotes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Grant access
GRANT SELECT ON public.custom_emotes TO authenticated;
GRANT SELECT ON public.custom_emotes TO anon;

-- ============================================
-- Seed some example emotes (optional)
-- ============================================
-- Uncomment and modify URLs when you have actual emote files hosted

-- INSERT INTO public.custom_emotes (code, url, alt, category) VALUES
--   ('partyparrot', 'https://your-cdn.com/emotes/partyparrot.gif', 'party parrot', 'fun'),
--   ('dumpsterfire', 'https://your-cdn.com/emotes/dumpsterfire.gif', 'dumpster fire', 'dev'),
--   ('shipit-squirrel', 'https://your-cdn.com/emotes/shipit.gif', 'ship it squirrel', 'dev'),
--   ('this-is-fine', 'https://your-cdn.com/emotes/thisisfine.gif', 'this is fine', 'fun'),
--   ('nyan', 'https://your-cdn.com/emotes/nyan.gif', 'nyan cat', 'fun')
-- ON CONFLICT (code) DO NOTHING;
