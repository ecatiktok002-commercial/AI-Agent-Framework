import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentId, businessId } = await req.json();

    if (!documentId) {
      throw new Error("documentId is required");
    }

    const { data: doc, error: docError } = await supabase.from('pdf_documents').select('*').eq('id', documentId).single();
    if (docError) throw docError;
    if (!doc) throw new Error("Document not found");

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const systemInstruction = `You are a strict data structuring assistant. I will provide you with a Markdown document detailing a health equipment manual. 
You must break down this Markdown into discrete, factual pieces of knowledge. 
Extract EVERY factual detail, therapy benefit, pricing, and safety rule from the text.
If there are image URLs embedded like ![Diagram](URL), attach the EXACT matching image URL to the corresponding fact.
Output STRICTLY as a JSON array with exactly these keys: "category", "topic", "fact", and "image_url" (can be null).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: doc.content_markdown }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              topic: { type: Type.STRING },
              fact: { type: Type.STRING },
              image_url: { type: Type.STRING, nullable: true }
            },
            required: ["category", "topic", "fact"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text() || "[]");

    const insertPayload = parsedData.map((item: any) => ({
      business_id: businessId || null,
      category: item.category,
      topic: item.topic,
      fact: item.fact,
      image_url: item.image_url || null,
      is_active: true
    }));

    if (insertPayload.length > 0) {
      const { error } = await supabase.from('company_knowledge').insert(insertPayload);
      if (error) throw error;
    }

    const { error: updateError } = await supabase.from('pdf_documents').update({ status: 'exported' }).eq('id', documentId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, count: insertPayload.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error exporting PDF:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
