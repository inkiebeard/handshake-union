-- ============================================
-- Update pseudonym generator with varied prefixes
-- Safe to run on existing DBs — uses CREATE OR REPLACE
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
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM profiles WHERE pseudonym = new_pseudonym) LOOP
    chosen_prefix := prefixes[1 + floor(random() * array_length(prefixes, 1))::int];
    hex_suffix := substr(md5(random()::text), 1, 6);
    new_pseudonym := chosen_prefix || '_' || hex_suffix;
  END LOOP;
  RETURN new_pseudonym;
END;
$$ LANGUAGE plpgsql;
