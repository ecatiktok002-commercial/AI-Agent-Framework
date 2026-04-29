import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_PHONE_ID = Deno.env.get("META_PHONE_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { message, customer_ids, template_name, language_code } = await req.json();

    if (!customer_ids || (!message && !template_name)) {
      throw new Error("Missing customer_ids or message content");
    }

    const { data: customers } = await supabase
      .from('customers')
      .select('phone_number, id')
      .in('id', customer_ids);

    if (!customers) throw new Error("No customers found");

    const results = [];

    for (const customer of customers) {
      console.log(`📢 Broadcasting to ${customer.phone_number}`);
      
      const payload: any = {
        messaging_product: "whatsapp",
        to: customer.phone_number,
      };

      if (template_name) {
        payload.type = "template";
        payload.template = {
          name: template_name,
          language: { code: language_code || "en_US" }
        };
      } else {
        payload.type = "text";
        payload.text = { body: message };
      }

      const waResponse = await fetch(`https://graph.facebook.com/v17.0/${META_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resData = await waResponse.json();
      results.push({ customer_id: customer.id, success: !!resData.messages, error: resData.error });

      // Save as system/ai message in history if needed
      if (!!resData.messages) {
        // Find or create ticket for this broadcast
        const { data: ticket } = await supabase
          .from('tickets')
          .select('id')
          .eq('customer_id', customer.id)
          .eq('is_closed', false)
          .limit(1)
          .maybeSingle();
        
        if (ticket) {
          await supabase.from('messages').insert({
            ticket_id: ticket.id,
            sender_type: "ai",
            message_text: `[BROADCAST]: ${message || 'Template: ' + template_name}`
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
