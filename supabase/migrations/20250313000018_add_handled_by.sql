-- Add the handled_by column to the tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS handled_by text DEFAULT 'ai';

-- Drop the previous constraint if it exists
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_handled_by_check;

-- Add the updated constraint
ALTER TABLE tickets ADD CONSTRAINT tickets_handled_by_check CHECK (handled_by IN ('ai', 'agent'));

-- Update any existing rows that might have been set to 'human' (if the column already existed)
UPDATE tickets SET handled_by = 'agent' WHERE handled_by = 'human';

-- Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
