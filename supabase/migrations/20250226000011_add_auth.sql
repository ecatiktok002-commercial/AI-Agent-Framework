-- Add password column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password TEXT;

-- Update existing agents with a default password for testing (e.g., 'password123')
UPDATE agents SET password = 'password123' WHERE password IS NULL;

-- Enable Realtime for tickets and agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agents;
  END IF;
END $$;
