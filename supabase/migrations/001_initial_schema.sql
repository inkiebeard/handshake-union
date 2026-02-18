-- ============================================
-- Handshake Union — Initial Schema
-- ============================================

-- Enums
CREATE TYPE salary_band AS ENUM (
  'under_60k',
  '60_80k',
  '80_100k',
  '100_120k',
  '120_150k',
  '150_180k',
  '180_220k',
  'over_220k',
  'prefer_not_to_say'
);

CREATE TYPE experience_band AS ENUM (
  'student',
  '0_1_years',
  '1_3_years',
  '3_5_years',
  '5_10_years',
  '10_15_years',
  '15_plus_years'
);

CREATE TYPE employment_type AS ENUM (
  'full_time_permanent',
  'full_time_contract',
  'part_time',
  'casual',
  'contractor_abn',
  'freelance',
  'unemployed',
  'student'
);

CREATE TYPE wfh_status AS ENUM (
  'full_remote',
  'hybrid_mostly_remote',
  'hybrid_mostly_office',
  'full_office',
  'flexible'
);

CREATE TYPE role_title AS ENUM (
  'junior_dev',
  'mid_dev',
  'senior_dev',
  'lead',
  'staff_engineer',
  'principal',
  'em',
  'director',
  'vp',
  'cto',
  'devops_sre',
  'data_engineer',
  'ml_engineer',
  'qa',
  'security',
  'mobile',
  'frontend',
  'backend',
  'fullstack',
  'other'
);

CREATE TYPE chat_room AS ENUM (
  'general',
  'memes',
  'whinge'
);

-- ============================================
-- Profiles
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudonym TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  salary_band salary_band,
  experience_band experience_band,
  employment_type employment_type,
  wfh_status wfh_status,
  role_title role_title,
  country TEXT,
  requires_visa BOOLEAN
);

-- Auto-generate pseudonym on new user signup
CREATE OR REPLACE FUNCTION generate_pseudonym()
RETURNS TEXT AS $$
DECLARE
  prefixes TEXT[] := ARRAY[
    'anon', 'byte', 'coder', 'debug', 'dev',
    'ghost', 'hack', 'kern', 'node', 'null',
    'pixel', 'root', 'shell', 'stack', 'sys',
    'void', 'wire', 'zero', 'bit', 'flux'
  ];
  chosen_prefix TEXT;
  hex_suffix TEXT;
  new_pseudonym TEXT;
BEGIN
  chosen_prefix := prefixes[1 + floor(random() * array_length(prefixes, 1))::int];
  hex_suffix := substr(md5(random()::text), 1, 6);
  new_pseudonym := chosen_prefix || '_' || hex_suffix;
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE pseudonym = new_pseudonym) LOOP
    chosen_prefix := prefixes[1 + floor(random() * array_length(prefixes, 1))::int];
    hex_suffix := substr(md5(random()::text), 1, 6);
    new_pseudonym := chosen_prefix || '_' || hex_suffix;
  END LOOP;
  RETURN new_pseudonym;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudonym)
  VALUES (NEW.id, public.generate_pseudonym());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Messages
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room chat_room NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_room_created ON messages(room, created_at DESC);
CREATE INDEX idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ============================================
-- Reactions
-- ============================================
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions(message_id);

-- ============================================
-- Baseline Stats (seeded comparison data)
-- ============================================
CREATE TABLE baseline_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  year INTEGER NOT NULL,
  role_title role_title NOT NULL,
  experience_band experience_band NOT NULL,
  country TEXT NOT NULL DEFAULT 'Australia',
  median_salary INTEGER NOT NULL,
  sample_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Row Level Security
-- ============================================

-- Profiles: anyone authenticated can read, only own profile can update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Messages: authenticated can read all, insert own, delete own
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages are viewable by authenticated users"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- Reactions: authenticated can read all, insert/delete own
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are viewable by authenticated users"
  ON reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own reactions"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own reactions"
  ON reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- Baseline stats: read-only for authenticated users
ALTER TABLE baseline_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Baseline stats are viewable by authenticated users"
  ON baseline_stats FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ============================================
-- Cleanup: Delete messages older than 1 hour
-- (Run via Supabase cron extension or edge function)
-- ============================================
-- To enable pg_cron in Supabase, run in the SQL editor:
--
-- SELECT cron.schedule(
--   'cleanup-old-messages',
--   '*/5 * * * *',  -- every 5 minutes
--   $$DELETE FROM messages WHERE created_at < now() - interval '1 hour'$$
-- );
