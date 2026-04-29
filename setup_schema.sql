-- Drop existing tables to start fresh (Run this CAREFULLY, you will lose existing data)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS routing_rules CASCADE;
DROP TABLE IF EXISTS company_knowledge CASCADE;
DROP TABLE IF EXISTS generic_leads CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS pdf_documents CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;


-- Recreate schema

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'agent',
    status TEXT NOT NULL DEFAULT 'offline',
    is_approved BOOLEAN DEFAULT true,
    tone_style TEXT DEFAULT 'professional',
    greeting_template TEXT,
    signature TEXT,
    emoji_level TEXT DEFAULT 'medium',
    response_style_rules JSONB DEFAULT '{"useStructuredReplies": true, "useShortSentences": false, "addEmojisAutomatically": false, "formalLanguageMode": true}'::jsonb,
    personality_instructions TEXT,
    training_notes TEXT,
    active_tickets INTEGER DEFAULT 0,
    ai_mirroring_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ai_handling',
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    handled_by TEXT DEFAULT 'ai',
    tag TEXT DEFAULT 'General',
    is_closed BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE company_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    fact TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE generic_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    customer_phone TEXT NOT NULL,
    lead_type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'New',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE pdf_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
