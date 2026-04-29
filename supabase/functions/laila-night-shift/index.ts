import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

serve(async (req) => {
  try {
    // 1. Fetch tickets closed in the last 24 hours that were handled by human agents
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('handled_by', 'agent')
      .eq('is_closed', true)
      .gte('closed_at', yesterday.toISOString());

    if (ticketError || !tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ message: "No recent agent tickets to process." }), { status: 200 });
    }

    let newFactsCount = 0;

    // 2. Process each ticket
    for (const ticket of tickets) {
      // Fetch messages for this ticket
      const { data: messages } = await supabase
        .from('messages')
        .select('sender_type, message_text')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (!messages || messages.length < 3) continue; // Skip very short chats

      const transcript = messages.map(m => `${m.sender_type}: ${m.message_text}`).join('\n');

      // 3. Ask Gemini to extract facts
      const prompt = `Analyze this customer service chat transcript.
Identify any new business rules, pricing details, or policies stated by the human agent.
Extract these into clear, concise standalone facts.
DO NOT extract small talk or specific customer details.
Output strictly as a JSON array of objects with keys: "category", "topic", "fact".
If no new general rules are found, return an empty array [].

Transcript:
${transcript}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text || "[]";
      let extractedFacts = [];
      try {
         extractedFacts = JSON.parse(resultText);
      } catch (e) {
         console.error("Failed to parse JSON:", resultText);
         continue;
      }

      // 4. Save to company_knowledge as pending (is_active: false)
      for (const fact of extractedFacts) {
        if (fact.category && fact.topic && fact.fact) {
          await supabase.from('company_knowledge').insert([{
            category: fact.category,
            topic: fact.topic,
            fact: fact.fact,
            is_active: false // Requires admin approval
          }]);
          newFactsCount++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, factsExtracted: newFactsCount }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
