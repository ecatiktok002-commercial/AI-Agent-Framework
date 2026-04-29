-- 1. Create Agents Table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert Initial Agents
INSERT INTO agents (name) VALUES ('Seri'), ('Qila'), ('Mahira')
ON CONFLICT (name) DO NOTHING;

-- 3. Update Conversations Table
-- First, drop the old check constraint if it exists
DO $$ 
BEGIN 
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
EXCEPTION 
    WHEN undefined_object THEN NULL;
END $$;

-- Add assigned_agent_id and update status check
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES agents(id),
ALTER COLUMN status SET DEFAULT 'AI_HwANDLING';

-- Update status check to match the new requirement
ALTER TABLE conversations 
ADD CONSTRAINT conversations_status_check 
CHECK (status IN ('AI_HANDLING', 'HUMAN_ASSIGNED'));

-- 4. Ensure Realtime is enabled for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
