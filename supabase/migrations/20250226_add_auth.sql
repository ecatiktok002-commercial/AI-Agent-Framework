-- Add password column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password TEXT;

-- Update existing agents with a default password for testing (e.g., 'password123')
UPDATE agents SET password = 'password123' WHERE password IS NULL;

-- Enable Realtime for tickets and agents
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
