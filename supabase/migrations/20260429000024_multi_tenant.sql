CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp_phone_number_id text NOT NULL,
  meta_access_token text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);

-- Note: In a production environment, DDL statements dropping constraints and default values might lead to some downtime.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.company_knowledge ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

-- Wait, system_settings has `key text NOT NULL PRIMARY KEY`. 
-- If we add business_id, the primary key should be (business_id, key).
ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (business_id, key);

-- Also routing_rules potentially needs it, though it references agents(id) which has business_id.
ALTER TABLE public.routing_rules ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

-- Optional: Enable RLS and add basic policies later,
-- For now, open it up just like the other tables if they don't use strict RLS yet.
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.businesses TO anon, authenticated, service_role;
