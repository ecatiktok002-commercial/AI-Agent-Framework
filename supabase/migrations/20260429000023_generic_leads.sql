CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  lead_type text NOT NULL, -- e.g., 'booking', 'inquiry', 'support'
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- dynamic capture fields
  status text DEFAULT 'New' CHECK (status IN ('New', 'InProgress', 'Done', 'Rejected')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;
END $$;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.leads TO anon, authenticated, service_role;
