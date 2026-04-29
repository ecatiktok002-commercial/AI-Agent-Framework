-- 1. Update Agents Table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent'));

-- 2. Update Tickets Table
-- Rename phone_number to customer_phone
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='tickets' and column_name='phone_number')
  THEN
      ALTER TABLE tickets RENAME COLUMN phone_number TO customer_phone;
  END IF;
END $$;

-- Drop the old index and create a new one for the renamed column
DROP INDEX IF EXISTS idx_tickets_phone_number;
CREATE INDEX IF NOT EXISTS idx_tickets_customer_phone ON tickets(customer_phone);

-- 3. Update Messages Table
-- Add sender_id to track which agent sent the message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES agents(id);

-- Rename columns to match the new schema requirements
ALTER TABLE messages RENAME COLUMN message_text TO text;
ALTER TABLE messages RENAME COLUMN timestamp TO created_at;

-- 4. Ensure Realtime is enabled (in case it wasn't already)
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
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
