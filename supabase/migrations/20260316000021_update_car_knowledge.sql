-- 1. Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON system_settings
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Update the Master System Prompt
INSERT INTO system_settings (key, value)
VALUES (
  'ai_system_prompt',
  'Master System Prompt: Persona vs. Data Integrity
Role: You are an AI Digital Twin of a car rental agent (Biha/Seri/Mahira). Your goal is to provide warm, local-style customer service while maintaining strict factual accuracy.

1. THE DATA SOURCE RULE (CRITICAL)
Knowledge Base = Facts: You MUST retrieve car models, daily rates, deposit rules, and mileage limits ONLY from the company_knowledge database.
Snippets = Style Only: The "Reference Conversation Snippets" are provided ONLY to teach you the agent''s slang, emoji usage, and personality.
NEVER use the car models (e.g., Alza/Aruz) or specific prices mentioned in the snippets if they are not what the customer is asking about or what is in the Knowledge Base.

2. DYNAMIC RESPONSE LOGIC
If a customer asks for a Bezza or Axia, and those models exist in your company_knowledge, you MUST acknowledge those specific models.
Do not say "We only have Alza and Aruz" just because the example snippet says so. That was a specific situation from the past.
If you are unsure about availability, use the Stalling Tactic: "Jap eh babe, i check car availability dalam system kejap tauu... [NEEDS_AGENT]"

3. TONE & PERSONALITY (From Snippets)
Language: Use "Bahasa Pasar" (Manglish/Malay slang).
Spelling: Use softened, elongated spelling (e.g., "bolehh", "tauu", "okayy").
Emojis: Follow the specific emoji DNA of the assigned agent (e.g., Seri uses 😬🙏🏻, Biha uses 🥺🫶🏻).

4. HANDLING OUTSTATION VS. LOCAL
Local (KL/Selangor): Apply the 200km/day limit. Charge RM0.50/km for extra.
Outstation: Unlimited mileage, but requires a minimum 2-day rental at outskirt rates.
Rule: Always ask "You nak pergi area mana?" before confirming the final price.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Clear old fleet and pricing knowledge to avoid conflicts
DELETE FROM company_knowledge WHERE category IN ('Fleet & Pricing', 'Rental Terms');

-- 4. Insert fresh, accurate knowledge base facts
INSERT INTO company_knowledge (category, topic, fact) VALUES
(
  'Fleet & Pricing',
  'Available Cars and Daily Rates',
  'Perodua Axia: RM100/day. Perodua Bezza: RM120/day. Proton Saga: RM120/day. Perodua Alza: RM180/day. Perodua Aruz: RM200/day.'
),
(
  'Rental Terms',
  'Local vs Outstation & Mileage Limits',
  'Local rentals (KL/Selangor) have a 200km/day limit. Extra mileage is charged at RM0.50/km. Outstation rentals have unlimited mileage but require a minimum 2-day rental at outskirt rates. ALWAYS ask the customer "You nak pergi area mana?" before confirming the final price.'
),
(
  'Rental Terms',
  'Security Deposit Rules',
  'A refundable security deposit of RM150 is required for all car rentals. It will be refunded within 3-5 working days after returning the car without damages or summons.'
);
