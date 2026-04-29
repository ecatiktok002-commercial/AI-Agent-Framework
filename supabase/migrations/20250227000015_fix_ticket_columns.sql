-- Add missing columns to tickets table to support clearing and closing conversations
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
