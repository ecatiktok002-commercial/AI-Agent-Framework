-- 1. Create Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT UNIQUE NOT NULL, -- WhatsApp Phone Number
  customer_name TEXT,
  status TEXT DEFAULT 'AI_HANDLING' CHECK (status IN ('AI_HANDLING', 'ASSIGNED_TO_HUMAN')),
  last_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('CUSTOMER', 'AI_AGENT', 'HUMAN_AGENT')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Realtime for Dashboard Updates
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 4. Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_wa_id ON conversations(wa_id);
