-- Allow anon users to delete facts for testing purposes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'company_knowledge' AND policyname = 'Allow delete for anon users'
    ) THEN
        CREATE POLICY "Allow delete for anon users" ON company_knowledge
            FOR DELETE USING (auth.role() = 'anon' OR auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'company_knowledge' AND policyname = 'Allow all for anon users'
    ) THEN
        CREATE POLICY "Allow all for anon users" ON company_knowledge
            FOR ALL USING (auth.role() = 'anon' OR auth.role() = 'authenticated');
    END IF;
END $$;
