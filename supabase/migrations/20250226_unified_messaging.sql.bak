-- 1. Update Agents Table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent'));

-- 2. Update Tickets Table
-- Rename phone_number to customer_phone
ALTER TABLE tickets RENAME COLUMN phone_number TO customer_phone;

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
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
