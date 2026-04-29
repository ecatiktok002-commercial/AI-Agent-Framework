-- Add whatsapp_message_id to messages table to prevent duplicate processing
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT UNIQUE;
