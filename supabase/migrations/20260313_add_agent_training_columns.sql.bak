-- Add missing columns to the agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role text DEFAULT 'agent';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tone_style text DEFAULT 'friendly';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS greeting_template text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS signature text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS emoji_level text DEFAULT 'medium';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS response_style_rules jsonb DEFAULT '{"useStructuredReplies": true, "useShortSentences": false, "addEmojisAutomatically": true, "formalLanguageMode": false}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality_instructions text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS training_notes text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ai_mirroring_enabled boolean DEFAULT true;

-- Update existing agents to have roles if needed
UPDATE agents SET role = 'admin' WHERE name IN ('Seri');

-- Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
