-- ============================================
-- Fix mutable search_path on all functions
-- Sets search_path to empty string to prevent
-- search_path injection attacks
-- ============================================

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
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE pseudonym = new_pseudonym) LOOP
    chosen_prefix := prefixes[1 + floor(random() * array_length(prefixes, 1))::int];
    hex_suffix := substr(md5(random()::text), 1, 6);
    new_pseudonym := chosen_prefix || '_' || hex_suffix;
  END LOOP;
  RETURN new_pseudonym;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudonym)
  VALUES (NEW.id, public.generate_pseudonym());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
