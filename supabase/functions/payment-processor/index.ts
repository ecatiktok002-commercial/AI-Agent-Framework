import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_PHONE_ID = Deno.env.get("META_PHONE_ID");

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Generic payment webhook handler (e.g., from ToyyibPay/Stripe)
    // Adjust based on your payment provider's payload
    const body = await req.json();
    console.log("💳 Payment Webhook Received:", JSON.stringify(body));

    // Example logic: expect a 'billCode' or 'orderId' that matches our booking_leads ticket_id
    const orderId = body.orderId || body.billCode;
    const status = body.status; // '1' or 'SUCCESS'

    if (status === '1' || status === 'SUCCESS') {
      // 1. Find the booking lead
      const { data: lead, error: leadError } = await supabase
        .from('booking_leads')
        .select('*, ticket:tickets(*, customer:customers(*))')
        .eq('id', orderId) // Or use a separate custom field
        .single();

      if (lead) {
        // 2. Update status to Done
        await supabase
          .from('booking_leads')
          .update({ status: 'Done' })
          .eq('id', lead.id);

        // 3. Update Ticket Tag
        await supabase
          .from('tickets')
          .update({ tag: 'Done', status: 'closed', is_closed: true, closed_at: new Date().toISOString() })
          .eq('id', lead.ticket_id);

        // 4. Notify Customer via WhatsApp
        const customerPhone = lead.customer_phone;
        const confirmationMsg = "✅ *Payment Verified!*\n\nBooking anda sudah disahkan. Sila rujuk Dashboard atau WhatsApp ini untuk info pengambilan kereta. Terima kasih boss! 🎉";
        
        await fetch(`https://graph.facebook.com/v17.0/${META_PHONE_ID}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: customerPhone,
            type: "text",
            text: { body: confirmationMsg },
          }),
        });

        console.log(`✅ Booking ${lead.id} confirmed and customer notified.`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: any) {
    console.error("❌ Payment Processor Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
