-- 1. Create Agents Table (if not exists)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Initial Agents
INSERT INTO agents (name) VALUES ('Seri'), ('Qila'), ('Mahira')
ON CONFLICT (name) DO NOTHING;

-- 2. Create Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'ai_handling' CHECK (status IN ('ai_handling', 'waiting_agent', 'assigned', 'closed')),
  assigned_agent_id UUID REFERENCES agents(id),
  tags JSONB DEFAULT '[]'::jsonb,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('customer', 'ai', 'agent')),
  message_text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_phone_number ON tickets(phone_number);
