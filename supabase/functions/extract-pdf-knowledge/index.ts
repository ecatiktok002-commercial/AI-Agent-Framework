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
    let { pdfText, imageUrls, businessId, fileName } = await req.json();

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const systemInstruction = `You are an expert technical data extractor. Read this manual and extract every factual detail, therapy benefit, and safety rule. 
You are also provided with image URLs representing the pages/diagrams. 
Convert the entire document into a well-structured Markdown document (.md). Ensure headings, lists, and facts are clear. 
If a section or fact is heavily reliant on a visual diagram, embed the image URL directly in the Markdown using standard syntax: ![Diagram](URL). 
Output ONLY valid Markdown text, do not wrap it in JSON.`;

    const parts: any[] = [];
    if (pdfText) {
      parts.push({ text: "PDF Manual Content:\n" + pdfText });
    }

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        parts.push({
          text: `Page/Diagram Image URL: ${url}`
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
      }
    });

    const markdownText = response.text() || "";

    const insertPayload = {
      file_name: fileName || "Imported_Manual.pdf",
      content_markdown: markdownText,
      status: 'pending',
      business_id: businessId || null
    };

    const { data, error } = await supabase.from('pdf_documents').insert([insertPayload]).select();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error extracting PDF:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
