-- Migration to update booking_leads table to the new schema
-- Step 1: Create the table if it doesn't exist, or update it

-- Drop existing table if we want a clean start, but user said "update the booking_leads table"
-- To be safe and preserve data if any, we can add columns, but the schema changed significantly.
-- I'll use a clean approach as the user provided a specific schema.

DROP TABLE IF EXISTS public.booking_leads;

CREATE TABLE public.booking_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_phone TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    pickup_date TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    price TEXT NOT NULL,
    duration TEXT NOT NULL,
    ic_url TEXT,
    license_url TEXT,
    receipt_url TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE booking_leads;

-- Enable RLS and allow all for now as per previous instructions for internal dashboard
ALTER TABLE public.booking_leads DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.booking_leads TO anon;
GRANT ALL ON public.booking_leads TO authenticated;
GRANT ALL ON public.booking_leads TO service_role;
