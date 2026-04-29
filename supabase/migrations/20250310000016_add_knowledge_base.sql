-- Create company_knowledge table
CREATE TABLE IF NOT EXISTS company_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    fact TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies
-- For simplicity in this environment, we'll allow authenticated users full access
-- and service role to read for the edge function.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'company_knowledge' AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON company_knowledge
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
