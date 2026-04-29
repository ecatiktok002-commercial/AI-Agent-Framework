import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI, Type, FunctionDeclaration } from "npm:@google/genai";
import postgres from "https://deno.land/x/postgresjs/mod.js";

// Initialize environment variables
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_PHONE_ID = Deno.env.get("META_PHONE_ID");
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "ECA_SECURE_Tiktok003_2026";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_BACKUP_KEY = Deno.env.get("GEMINI_BACKUP_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");



// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const ENABLE_SELF_LEARNING = true; // Set to false to instantly disable this feature

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ==========================================
  // 1. GET Request: Meta Webhook Verification
  // ==========================================
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ==========================================
  // 2. POST Request: Unified Router
  // ==========================================
  if (req.method === "POST") {
    try {
      // Validate Environment Variables
      const missingVars = [];
      if (!META_ACCESS_TOKEN) missingVars.push("META_ACCESS_TOKEN");
      if (!META_PHONE_ID) missingVars.push("META_PHONE_ID");
      if (!GEMINI_API_KEY) missingVars.push("GEMINI_API_KEY");
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
      }

      const body = await req.json();
      console.log("📩 Payload Received:", JSON.stringify(body));

      // ------------------------------------------
      // ROUTE A: Dashboard Manual Reply (action: "send-message")
      // ------------------------------------------
      if (body.action === "send-message") {
        const { ticket_id, message_text, agent_id } = body;
        let activeAccessToken = META_ACCESS_TOKEN;
        let activePhoneId = META_PHONE_ID;
        // In a real multi-tenant app, fetch business credentials here using the ticket_id or agent_id

        if (!ticket_id || !message_text || !agent_id) {
          throw new Error("Missing ticket_id, message_text, or agent_id");
        }

        // 1. Get Ticket & Customer Details
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .select("*, customer:customers(*)")
          .eq("id", ticket_id)
          .single();

        if (ticketError) {
          console.error("❌ Ticket Fetch Error:", ticketError);
          throw new Error(`Ticket not found: ${ticketError.message}`);
        }
        if (!ticket) throw new Error("Ticket not found");

        const customerPhone = ticket.customer?.phone_number;
        if (!customerPhone) throw new Error("Customer phone number not found");

        // 2. Get Agent Details (for signature)
        const { data: agent, error: agentError } = await supabase
          .from("agents")
          .select("*")
          .eq("id", agent_id)
          .single();
        
        if (agentError) console.warn("⚠️ Agent not found, sending without signature");

        // 3. Admin Takeover Logic: If Admin sends a message, they take over.
        // Update status to 'assigned' and set assigned_agent_id to Admin's ID.
        if (agent && agent.role === 'admin') {
          const { error: updateError } = await supabase
            .from("tickets")
            .update({ 
              status: "assigned", 
              assigned_agent_id: agent_id,
              handled_by: "agent"
            })
            .eq("id", ticket_id);
          
          if (updateError) console.error("❌ Admin Takeover Update Error:", updateError);
        }

        // 4. Format Message
        let finalMessage = message_text;
        if (agent && agent.signature) {
          finalMessage += `\n\n${agent.signature}`;
        }

        // 5. Send to WhatsApp
        console.log(`📤 Sending Agent Reply to ${customerPhone}`);
        const waResponse = await sendWhatsAppMessage(customerPhone, finalMessage, activeAccessToken, activePhoneId);
        
        if (waResponse.error) {
          console.error("❌ WhatsApp API Error:", JSON.stringify(waResponse.error));
          throw new Error(`WhatsApp API Error: ${waResponse.error.message || "Unknown error"}`);
        }

        // 6. Save to Database
        const { data: message, error: msgError } = await supabase
          .from("messages")
          .insert([{
            ticket_id: ticket_id,
            sender_type: "agent",
            message_text: finalMessage
          }])
          .select()
          .single();

        if (msgError) {
          console.error("❌ Message Insert Error:", msgError);
          throw new Error(`Failed to save message: ${msgError.message}`);
        }

        // 7. Update Ticket's last_message and touch it for real-time updates
        await supabase
          .from("tickets")
          .update({ 
            last_message: finalMessage,
            status: agent && agent.role === 'admin' ? 'assigned' : ticket.status
          })
          .eq("id", ticket_id);

        return new Response(JSON.stringify({ success: true, message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE D: Admin Manual Assignment (action: "assign-agent")
      // ------------------------------------------
      if (body.action === "assign-agent") {
        const { ticket_id, agent_id } = body;
        let activeAccessToken = META_ACCESS_TOKEN;
        let activePhoneId = META_PHONE_ID;

        if (!ticket_id || !agent_id) {
          throw new Error("Missing ticket_id or agent_id");
        }

        // 1. Get Ticket & Customer Details
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .select("*, customer:customers(*)")
          .eq("id", ticket_id)
          .single();

        if (ticketError || !ticket) throw new Error("Ticket not found");

        // 2. Update Ticket: Set to 'waiting_assignment' and assign to the chosen agent.
        const { error: updateError } = await supabase
          .from("tickets")
          .update({ 
            status: "waiting_assignment", 
            assigned_agent_id: agent_id 
          })
          .eq("id", ticket_id);

        if (updateError) throw updateError;

        // 3. Notify Customer
        const notification = "An agent has been assigned to your request. Please wait a moment while they review your case.";
        await sendWhatsAppMessage(ticket.customer.phone_number, notification, activeAccessToken, activePhoneId);

        // 4. Log System Messages
        await supabase.from("messages").insert([
          {
            ticket_id: ticket_id,
            sender_type: "system",
            message_text: `Ticket assigned to agent.`
          },
          {
            ticket_id: ticket_id,
            sender_type: "ai", 
            message_text: notification
          }
        ]);

        // 5. Update Ticket's last_message
        // await supabase
        //   .from("tickets")
        //   .update({ last_message: notification })
        //   .eq("id", ticket_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE E: Agent Take Over (action: "take-over")
      // ------------------------------------------
      if (body.action === "take-over") {
        const { ticket_id, agent_id } = body;
        let activeAccessToken = META_ACCESS_TOKEN;
        let activePhoneId = META_PHONE_ID;

        if (!ticket_id || !agent_id) {
          throw new Error("Missing ticket_id or agent_id");
        }

        // 1. Get Agent Details
        const { data: agent } = await supabase
          .from("agents")
          .select("name")
          .eq("id", agent_id)
          .single();

        // 2. Update Ticket Status to 'assigned'
        await supabase
          .from("tickets")
          .update({ status: "assigned", handled_by: "agent" })
          .eq("id", ticket_id);

        // 3. Log internal message
        const takeoverMsg = `Agent ${agent?.name || 'Unknown'} has taken over the chat.`;
        await supabase.from("messages").insert([{
          ticket_id: ticket_id,
          sender_type: "system",
          message_text: takeoverMsg
        }]);

        // 4. Update Ticket's last_message
        // await supabase
        //   .from("tickets")
        //   .update({ last_message: takeoverMsg })
        //   .eq("id", ticket_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE F: Update Customer (action: "update-customer")
      // ------------------------------------------
      if (body.action === "update-customer") {
        const { customer_id, name } = body;

        if (!customer_id || !name) {
          throw new Error("Missing customer_id or name");
        }

        const { error } = await supabase
          .from("customers")
          .update({ name: name.trim() })
          .eq("id", customer_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE G: Delete Customer (action: "delete-customer")
      // ------------------------------------------
      if (body.action === "delete-customer") {
        const { customer_id } = body;

        if (!customer_id) {
          throw new Error("Missing customer_id");
        }

        // Supabase foreign keys should handle cascading deletes if configured,
        // but let's be explicit if needed. Assuming cascade is on.
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", customer_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE H: Delete Ticket (action: "delete-ticket")
      // ------------------------------------------
      if (body.action === "delete-ticket") {
        const { ticket_id } = body;

        if (!ticket_id) {
          throw new Error("Missing ticket_id");
        }

        const { error } = await supabase
          .from("tickets")
          .update({ is_deleted: true, is_closed: true, closed_at: new Date().toISOString() })
          .eq("id", ticket_id);

        if (error) {
          console.error("❌ Ticket Delete Error:", error);
          throw new Error(`Failed to delete ticket: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE I: Add Agent (action: "add-agent")
      // ------------------------------------------
      if (body.action === "add-agent") {
        const { agent_data } = body;

        if (!agent_data || !agent_data.username || !agent_data.name) {
          throw new Error("Missing agent username or name");
        }

        const { active_tickets, ...cleanData } = agent_data;
        
        // Ensure a password is set to bypass not-null constraint for AI agents
        if (!cleanData.password) {
          cleanData.password = "AIAgent123!";
        }

        const { data, error } = await supabase
          .from("agents")
          .insert([cleanData])
          .select()
          .single();

        if (error) {
          console.error("❌ Add Agent Error:", error);
          throw new Error(`Failed to add agent: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE J: Update Agent (action: "update-agent")
      // ------------------------------------------
      if (body.action === "update-agent" || body.action === "update-agent-persona") {
        const { agent_id, agent_data } = body;

        if (!agent_id || !agent_data) {
          throw new Error("Missing agent_id or agent_data");
        }

        // Ensure we don't accidentally update restricted fields
        const { id, created_at, username, active_tickets, ...cleanData } = agent_data;

        const { data, error } = await supabase
          .from("agents")
          .update(cleanData)
          .eq("id", agent_id)
          .select();

        if (error) {
          console.error("❌ Update Agent Error:", error);
          throw new Error(`Failed to update agent: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error(`No agent found with ID: ${agent_id}`);
        }

        return new Response(JSON.stringify({ success: true, agent: data[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE K: Test Persona (action: "test-persona")
      // ------------------------------------------
      if (body.action === "test-persona") {
        const { message, personality_instructions, agent_name } = body;
        
        try {
          const response = await generateAIResponse(message, "Test Customer", "Test Phone", "test-ticket-id", personality_instructions, agent_name);
          return new Response(JSON.stringify({ success: true, response }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ success: false, error: error.message, stack: error.stack }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ------------------------------------------
      // ROUTE L: Delete Fact (action: "delete-fact")
      // ------------------------------------------
      if (body.action === "delete-fact") {
        const { fact_id } = body;

        if (!fact_id) {
          throw new Error("Missing fact_id");
        }

        const { error } = await supabase
          .from("company_knowledge")
          .delete()
          .eq("id", fact_id);

        if (error) {
          console.error("❌ Fact Delete Error:", error);
          throw new Error(`Failed to delete fact: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ------------------------------------------
      // ROUTE M: Test DB Bridge (action: "test-bridge")
      // ------------------------------------------
      if (body.action === "test-bridge") {
        try {
          const externalDbUrl = Deno.env.get("EXTERNAL_DB_URL");
          if (!externalDbUrl) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "EXTERNAL_DB_URL is not set in Edge Function secrets." 
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          // Attempt to connect to the external database
          const sql = postgres(externalDbUrl);
          const result = await sql`SELECT NOW() as current_time, current_user as connected_user`;
          await sql.end();
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Bridge connection successful!", 
            data: result 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("❌ Bridge Connection Error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Bridge connection failed", 
            details: error.message 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ------------------------------------------
      // ROUTE B: Inbound Customer Webhook
      // ------------------------------------------
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];
        const phoneNumberId = value?.metadata?.phone_number_id;

        let targetBusinessId = null;
        let activeAccessToken = META_ACCESS_TOKEN;
        let activePhoneId = META_PHONE_ID;

        if (phoneNumberId) {
          const { data: business } = await supabase
            .from("businesses")
            .select("id, meta_access_token, whatsapp_phone_number_id")
            .eq("whatsapp_phone_number_id", phoneNumberId)
            .single();

          if (business) {
            targetBusinessId = business.id;
            activeAccessToken = business.meta_access_token;
            activePhoneId = business.whatsapp_phone_number_id;
          }
        }

        if (message) {
          const from = message.from; // Customer phone number
          let text = message.text?.body;
          const customerName = value?.contacts?.[0]?.profile?.name || "Customer";
          const whatsappMessageId = message.id;

          const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE_NUMBER");

          // --- ADMIN INTERCEPTOR ---
          // If the message is from the Admin and starts with APPROVE
          if (from === ADMIN_PHONE && text && text.toUpperCase().startsWith("APPROVE ")) {
            const customerPhoneToApprove = text.split(" ")[1].trim(); 
            
            // NEW APPROVAL MESSAGE (No longer asks for IC because AI already got it)
            const approvalMsg = "✅ *Booking Confirmed!*\n\nTerima kasih boss! Payment and dokumen semua dah lepas verify. payment ca mintak? Booking awak dah berjaya di-lock. Jumpa masa hari pickup nanti! 🎉";
            await sendWhatsAppMessage(customerPhoneToApprove, approvalMsg, activeAccessToken, activePhoneId);

            await sendWhatsAppMessage(ADMIN_PHONE, `✅ Approval sent to ${customerPhoneToApprove}. Booking is now confirmed.`, activeAccessToken, activePhoneId); // to ${customerPhoneToApprove}. Booking is now confirmed.`);
            
            return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
          }
          
          // If the message is from the Admin and starts with REJECT
          if (from === ADMIN_PHONE && text && text.toUpperCase().startsWith("REJECT ")) {
            const customerPhoneToReject = text.split(" ")[1].trim();
            await sendWhatsAppMessage(customerPhoneToReject, "❌ *Payment Failed*\n\nMaaf boss, admin check payment tak masuk lagi. Boleh try check balik bank history atau resit tak?", activeAccessToken, activePhoneId); // "❌ *Payment Failed*\n\nMaaf boss, admin check payment tak masuk lagi. Boleh try check balik bank history atau resit tak?");
            await sendWhatsAppMessage(ADMIN_PHONE, `❌ Rejection sent to ${customerPhoneToReject}.`, activeAccessToken, activePhoneId); // to ${customerPhoneToReject}.`);
            return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
          }
          // -------------------------

          if (!text && message.type !== 'image' && message.type !== 'document') {
            return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
          }

          // 1. Check if this message ID has already been processed
          const { data: existingMsg } = await supabase
            .from("messages")
            .select("id")
            .eq("whatsapp_message_id", whatsappMessageId)
            .maybeSingle();

          if (existingMsg) {
            console.log(`♻️ Skipping duplicate message: ${whatsappMessageId}`);
            return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
          }

          // 2. Respond to Meta immediately to prevent retries
          // We'll continue processing in the background
          (async () => {
            try {
              // 1. Customer Lookup/Creation
              let { data: customer } = await supabase
                .from("customers")
                .select("*")
                .eq("phone_number", from)
                .single();

              if (!customer) {
                const { data: newCustomer, error: customerInsertError } = await supabase
                  .from("customers")
                  .insert([{ phone_number: from, name: customerName, business_id: targetBusinessId }])
                  .select()
                  .single();
                
                if (customerInsertError) throw customerInsertError;
                customer = newCustomer;
              }

              // 2. Ticket Logic (Find open ticket)
              let { data: ticket } = await supabase
                .from("tickets")
                .select("*")
                .eq("customer_id", customer.id)
                .eq("is_closed", false)
                .eq("is_deleted", false)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              // --- NEW SESSION TIMEOUT LOGIC ---
              // If we found an open ticket, check how old the last message is.
              if (ticket) {
                const { data: lastMsg } = await supabase
                  .from("messages")
                  .select("created_at")
                  .eq("ticket_id", ticket.id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();

                if (lastMsg) {
                  const lastActivity = new Date(lastMsg.created_at).getTime();
                  const now = new Date().getTime();
                  const hoursDiff = (now - lastActivity) / (1000 * 60 * 60);

                  // If inactive for > 12 hours, OR if it was a completed booking left pending for > 2 hours
                  if (hoursDiff > 12 || (ticket.tag === 'Booking Pending' && hoursDiff > 2)) {
                    console.log(`🎫 Auto-closing stale ticket ${ticket.id} for returning customer.`);
                    await supabase
                      .from("tickets")
                      .update({ is_closed: true, closed_at: new Date().toISOString() })
                      .eq("id", ticket.id);
                    
                    ticket = null; // This forces the code below to create a fresh ticket
                  }
                }
              }
              // -----------------------------

              if (ticket && ticket.tag === 'Done') {
                // Customer wrote back after booking was marked 'Done'. Switch ticket back to 'Active' by clearing the tag.
                await supabase.from("tickets").update({ tag: null }).eq("id", ticket.id);
                ticket.tag = null;
              }

              if (!ticket) {
                // 1. Fetch all active agents for round-robin
                const { data: activeAgents } = await supabase
                  .from("agents")
                  .select("id")
                  .eq("status", "online")
                  .order("created_at", { ascending: true });

                let assignedAgentId = null;

                if (activeAgents && activeAgents.length > 0) {
                  // PRIORITY: Keep the same AI Persona for repeat customers
                  const { data: customerPastTicket } = await supabase
                    .from("tickets")
                    .select("assigned_agent_id")
                    .eq("customer_id", customer.id)
                    .not("assigned_agent_id", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (customerPastTicket && customerPastTicket.assigned_agent_id) {
                    // Check if their previous agent is still online/active
                    const isStillActive = activeAgents.some(a => a.id === customerPastTicket.assigned_agent_id);
                    if (isStillActive) {
                      assignedAgentId = customerPastTicket.assigned_agent_id;
                      console.log(`Retaining previous agent ${assignedAgentId} for returning customer ${customer.id}`);
                    }
                  }

                  // FALLBACK: Global Round-Robin strictly for NEW customers
                  if (!assignedAgentId) {
                    const { data: lastTicket } = await supabase
                      .from("tickets")
                      .select("assigned_agent_id")
                      .not("assigned_agent_id", "is", null)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (lastTicket && lastTicket.assigned_agent_id) {
                      const lastAgentIndex = activeAgents.findIndex(a => a.id === lastTicket.assigned_agent_id);
                      const nextAgentIndex = lastAgentIndex !== -1 ? (lastAgentIndex + 1) % activeAgents.length : 0;
                      assignedAgentId = activeAgents[nextAgentIndex].id;
                    } else {
                      // If no previous ticket, assign to the first agent
                      assignedAgentId = activeAgents[0].id;
                    }
                  }
                }

                // Every new message from a customer must start with status: 'ai_handling'
                const { data: newTicket, error: ticketInsertError } = await supabase
                  .from("tickets")
                  .insert([{ 
                    customer_id: customer.id, 
                    business_id: targetBusinessId,
                    status: "ai_handling",
                    assigned_agent_id: assignedAgentId
                  }])
                  .select()
                  .single();
                
                if (ticketInsertError) throw ticketInsertError;
                ticket = newTicket;
              }

              // Download media if the customer sent an image or document
              if (message.type === 'image' && message.image?.id) {
                const mediaUrl = await processWhatsAppMedia(message.image.id, ticket.id, supabase, META_ACCESS_TOKEN);
                text = mediaUrl ? `[UPLOADED_IMAGE: ${mediaUrl}]` : `[Customer sent an image, but it failed to download]`;
              } else if (message.type === 'document' && message.document?.id) {
                const mediaUrl = await processWhatsAppMedia(message.document.id, ticket.id, supabase, META_ACCESS_TOKEN);
                text = mediaUrl ? `[UPLOADED_DOCUMENT: ${mediaUrl}]` : `[Customer sent a document, but it failed to download]`;
              }
              
              if (!text) return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });

              // 3. Save Inbound Message with WhatsApp ID
              const { data: msgInsertData, error: msgInsertError } = await supabase.from("messages").insert([{
                ticket_id: ticket.id,
                sender_type: "customer",
                message_text: text,
                whatsapp_message_id: whatsappMessageId
              }]).select().single();

              if (msgInsertError) {
                if (msgInsertError.code === '23505') {
                  console.log(`♻️ Duplicate message ID caught during insert: ${whatsappMessageId}`);
                  return;
                }
                throw msgInsertError;
              }

              // Update Ticket's last_message to trigger real-time refresh in dashboard
              await supabase
                .from("tickets")
                .update({ last_message: text })
                .eq("id", ticket.id);

              // --- DEBOUNCE LOGIC START ---
              // Wait for 5 seconds to see if the customer sends more messages
              console.log(`⏳ Waiting 5s for potential follow-up messages from ${from}...`);
              await new Promise(resolve => setTimeout(resolve, 5000));

              // Check if this is still the LATEST message from the customer
              const { data: latestMsg } = await supabase
                .from("messages")
                .select("id")
                .eq("ticket_id", ticket.id)
                .eq("sender_type", "customer")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (latestMsg && latestMsg.id !== msgInsertData.id) {
                console.log(`⏭️ Newer message detected for ticket ${ticket.id}. This instance will exit.`);
                return;
              }

              // Re-fetch ticket to check for status changes (e.g., agent takeover during the wait)
              const { data: freshTicket } = await supabase
                .from("tickets")
                .select("status, assigned_agent_id, handled_by")
                .eq("id", ticket.id)
                .single();
              
              if (!freshTicket || (freshTicket.status !== "ai_handling" && freshTicket.status !== "waiting_assignment")) {
                console.log(`🛑 Ticket status changed to ${freshTicket?.status}. AI response cancelled.`);
                return;
              }

              if (freshTicket.handled_by === 'agent') {
                console.log(`🛑 Ticket handled_by is agent. AI response cancelled.`);
                return new Response('Ignored - Agent handling', { status: 200, headers: corsHeaders });
              }
              // --- DEBOUNCE LOGIC END ---

              // --- KEYWORD HANDOFF LOGIC ---
              const { data: handoffSettings } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'ai_handoff_keywords')
                .eq('business_id', targetBusinessId)
                .maybeSingle();

              const handoffKeywordsStr = handoffSettings?.value || "doctor, pacemaker, pregnant, broken machine, repair, human";
              const handoffKeywords = handoffKeywordsStr.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
              const messageTextLower = text.toLowerCase();
              let shouldHandoff = false;
              for (const keyword of handoffKeywords) {
                if (messageTextLower.includes(keyword)) {
                  shouldHandoff = true;
                  break;
                }
              }

              if (shouldHandoff) {
                console.log(`⚠️ Handoff keyword detected in ticket ${ticket.id}. Passing to human.`);
                await supabase
                  .from("tickets")
                  .update({ status: "waiting_assignment" })
                  .eq("id", ticket.id);
                  
                const handoffMessage = "I understand you have a specific request. Let me transfer you to our human team to assist you further. They will contact you shortly.";
                await supabase.from("messages").insert([{
                  ticket_id: ticket.id,
                  sender_type: "ai",
                  message_text: handoffMessage
                }]);
                await supabase.from("tickets").update({ last_message: handoffMessage }).eq("id", ticket.id);
                await sendWhatsAppMessage(from, handoffMessage, activeAccessToken, activePhoneId);
                return new Response('Handoff executed', { status: 200, headers: corsHeaders });
              }
              // -----------------------------

              // 4. AI Logic
              if (freshTicket.status === "waiting_assignment") {
                console.log(`🛑 Ticket is waiting for human agent. Muting AI response.`);
                return new Response('Ignored - Waiting for agent', { status: 200, headers: corsHeaders });
              }

              if (freshTicket.status === "ai_handling") {
                let personaInstructions = null;
                let agentName = "AI Assistant";
                let referenceSnippets = null;
                
                // Fetch default identity from settings if no specific agent is assigned or mirroring is off
                let identitySettings: any = null;
                if (targetBusinessId) {
                  const { data, error } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['ai_agent_name', 'ai_tone_style', 'ai_personality_instructions', 'ai_emoji_usage'])
                    .eq('business_id', targetBusinessId);
                  
                  if (!error && data) {
                    identitySettings = data;
                  }
                }
                
                if (!identitySettings || identitySettings.length === 0) {
                  const { data } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['ai_agent_name', 'ai_tone_style', 'ai_personality_instructions', 'ai_emoji_usage'])
                    .is('business_id', null);
                  identitySettings = data;
                }
                
                let defaultAgentName = "AI Assistant";
                let defaultTone = "";
                let defaultEmoji = "Low";
                let defaultInstructions = "";

                if (identitySettings) {
                  identitySettings.forEach(s => {
                    if (s.key === 'ai_agent_name') defaultAgentName = s.value;
                    if (s.key === 'ai_tone_style') defaultTone = s.value;
                    if (s.key === 'ai_emoji_usage') defaultEmoji = s.value;
                    if (s.key === 'ai_personality_instructions') defaultInstructions = s.value;
                  });
                }

                agentName = defaultAgentName;
                personaInstructions = `${defaultTone ? `Tone: ${defaultTone}\n` : ''}${defaultEmoji ? `Emoji Usage Level: ${defaultEmoji}\n` : ''}${defaultInstructions}`;

                // If ticket is assigned, try to get the agent's persona (overrides default)
                if (freshTicket.assigned_agent_id) {
                  const { data: agent } = await supabase
                    .from("agents")
                    .select("name, personality_instructions, training_notes, ai_mirroring_enabled")
                    .eq("id", freshTicket.assigned_agent_id)
                    .single();
                  
                  if (agent?.ai_mirroring_enabled && agent?.personality_instructions) {
                    personaInstructions = agent.personality_instructions;
                    agentName = agent.name;
                    referenceSnippets = agent.training_notes;
                  }
                }

                // Repeat Customer check removed for generic AI
                let isRepeatCustomer = false;
                let pastIcUrl = null;
                let pastLicenseUrl = null;

                // Fetch customer's all tickets to grab full historical context
                const { data: allCustomerTickets } = await supabase
                  .from("tickets")
                  .select("id")
                  .eq("customer_id", customer.id);
                
                const ticketIds = allCustomerTickets?.map(t => t.id) || [ticket.id];

                // Fetch last 15 messages cross-ticket for memory
                const { data: history } = await supabase
                  .from("messages")
                  .select("sender_type, message_text, created_at")
                  .in("ticket_id", ticketIds)
                  .order("created_at", { ascending: false })
                  .limit(15);

                // Fetch handoff keywords from settings
                let keywordQ = supabase.from('system_settings').select('value').eq('key', 'ai_handoff_keywords');
                if (targetBusinessId) keywordQ = keywordQ.eq('business_id', targetBusinessId);
                const { data: keywordSettings } = await keywordQ.single();
                
                const customKeywords = keywordSettings?.value 
                  ? keywordSettings.value.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0)
                  : [];

                const aiResponse = await generateAIResponse(text, customerName, from, ticket.id, personaInstructions, agentName, history?.reverse().slice(0, -1), referenceSnippets, isRepeatCustomer, pastIcUrl, pastLicenseUrl, targetBusinessId);
                
                // Check for handover intent or AI-triggered escalation
                const defaultKeywords = ["human", "agent", "person", "staff", "speak to someone", "talk to someone", "orang", "staf", "admin", "bantuan"];
                const allKeywords = [...new Set([...defaultKeywords, ...customKeywords])];
                
                const needsHandover = allKeywords.some(keyword => text.toLowerCase().includes(keyword)) || aiResponse.includes("[NEEDS_AGENT]");

                if (needsHandover && freshTicket.status === "ai_handling") {
                  await supabase
                    .from("tickets")
                    .update({ status: "waiting_assignment" })
                    .eq("id", ticket.id);
                  
                  const systemMsg = aiResponse.includes("[NEEDS_AGENT]") 
                    ? "AI triggered escalation protocol. Ticket moved to 'Waiting Assignment'."
                    : "AI detected handover request. Ticket moved to 'Waiting Assignment'.";

                  await supabase.from("messages").insert([{
                    ticket_id: ticket.id,
                    sender_type: "system",
                    message_text: systemMsg
                  }]);
                }

                await supabase.from("messages").insert([{
                  ticket_id: ticket.id,
                  sender_type: "ai",
                  message_text: aiResponse
                }]);

                // Update Ticket's last_message for AI response
                await supabase
                  .from("tickets")
                  .update({ last_message: aiResponse })
                  .eq("id", ticket.id);

                console.log(`🤖 Raw AI Response: ${aiResponse}`);
                
                // Clean the message before it hits WhatsApp
                let finalMessage = aiResponse.replace(/\[NEEDS_AGENT\]/g, '').trim();
                
                // Extract images
                const imageParamsRegex = /\[SEND_IMAGE:\s*(https?:\/\/[^\]]+)\]/g;
                const matchedImages = [];
                let matchObj;
                while ((matchObj = imageParamsRegex.exec(finalMessage)) !== null) {
                  matchedImages.push(matchObj[1]);
                }
                finalMessage = finalMessage.replace(/\[SEND_IMAGE:\s*(https?:\/\/[^\]]+)\]/g, '').trim();

                const needsQR = finalMessage.includes('[SEND_QR]');
                finalMessage = finalMessage.replace(/\[SEND_QR\]/g, '').trim();

                // Send images FIRST
                for (const imgUrl of matchedImages) {
                  await sendWhatsAppImage(from, imgUrl, activeAccessToken, activePhoneId);
                }

                console.log(`📤 Sending AI response to ${from} (${finalMessage.length} chars)`);
                await sendWhatsAppMessage(from, finalMessage, activeAccessToken, activePhoneId);

                // If AI decided to send bank details, send the QR image immediately after the text
                if (needsQR) {
                  const qrUrl = "https://tnvhriiyuzjhtdqfufmh.supabase.co/storage/v1/object/public/public-assets/ECA%20RHB%20QR.jpeg";
                  await sendWhatsAppImage(from, qrUrl, activeAccessToken, activePhoneId);
                }
              }
            } catch (err) {
              console.error("❌ Background Processing Error:", err);
            }
          })();

          if (from === "1234567890") {
            // We can't return from inside the IIFE, but we can just let it run.
            // Actually, the IIFE is not awaited, so we can't return the result here easily.
          }

          return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
        }
        
        // Always return 200 for WhatsApp events to prevent Meta from retrying/disabling the webhook
        return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
      }
      
      // ------------------------------------------
      // ROUTE C: Agent Management (Legacy/Optional)
      // ------------------------------------------
      // If needed, we can add 'action: "add-agent"' here.

      return new Response("Unknown Action or Event", { status: 400, headers: corsHeaders });

    } catch (err: any) {
      console.error("❌ Error:", err.message);
      // Return 200 with success: false so the client can read the actual error message
      // instead of getting a generic "Failed to send a request" error from Supabase client
      return new Response(JSON.stringify({ success: false, error: err.message }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});

// Helper: Send WhatsApp Message
async function sendWhatsAppMessage(to: string, text: string, token: string = META_ACCESS_TOKEN!, phoneId: string = META_PHONE_ID!) {
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text },
    }),
  });
  return response.json();
}

// Helper: Generate AI Response using Gemini
async function generateAIResponse(userInput: string, customerName: string, customerPhone: string, ticketId: string, customPersona?: string, agentName?: string, history: any[] = [], referenceSnippets?: string, isRepeatCustomer: boolean = false, pastIcUrl?: string | null, pastLicenseUrl?: string | null, targetBusinessId?: string | null) {
  let currentKey = GEMINI_API_KEY || '';
  let attempts = 0;
  const maxAttempts = GEMINI_BACKUP_KEY ? 2 : 1;
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      // 1. Fetch Company Knowledge Base Facts (RAG)
      let facts: any = null;
      if (targetBusinessId) {
        const { data } = await supabase.from('company_knowledge').select('category, topic, fact, image_url').eq('is_active', true).eq('business_id', targetBusinessId);
        facts = data;
      }
      if (!facts || facts.length === 0) {
        const { data } = await supabase.from('company_knowledge').select('category, topic, fact, image_url').eq('is_active', true).is('business_id', null);
        facts = data;
      }

      const formattedFacts = facts && facts.length > 0 
        ? facts.map(f => `[${f.category} - ${f.topic}]: ${f.fact}${f.image_url ? ` (IMAGE_URL: ${f.image_url})` : ''}`).join('\n')
        : "No specific company facts available.";

      const knowledgeBaseBlock = `COMPANY KNOWLEDGE BASE: You must strictly adhere to the following company facts. 
* If a customer asks a question related to these topics, use this information as your ONLY source of truth.
* Do not invent policies, prices, or services not listed here.
* If the information is not in the knowledge base, politely inform the customer that you need a moment to check or double-check with the team.
* CRITICAL: NEVER mention that you are an AI, a bot, or that you are passing them to a "human agent". You MUST act as a real human staff member at all times.
* IMAGE INSTRUCTION: If your knowledge base fact provides an IMAGE_URL, you MUST include exactly "[SEND_IMAGE: <image_url>]" in your response so the system can send the diagram to the customer. Put it anywhere in your message.
${formattedFacts}`;

      const isFirstMessage = !history || history.length === 0;
      const greetingRule = isFirstMessage 
        ? "* This is the FIRST message. Start with a warm greeting (e.g., 'Hii!', 'Salam', 'hi awak!')."
        : "* This is an ONGOING conversation. DO NOT greet the customer again. Jump straight to the answer.";

      // Helper function to automatically switch models on failure
      const callGeminiWithFallback = async (requestParams: any) => {
        try {
          return await ai.models.generateContent({
            ...requestParams,
            model: "gemini-2.5-flash"
          });
        } catch (error: any) {
          console.warn(`⚠️ Model gemini-2.5-flash failed: ${error.message}.`);
          throw error;
        }
      };

      // Helper function to fetch image and convert to inlineData for Gemini
      const fetchImageForGemini = async (url: string) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          const base64 = base64Encode(new Uint8Array(arrayBuffer));
          const mimeType = response.headers.get('content-type') || 'image/jpeg';
          return {
            inlineData: {
              data: base64,
              mimeType: mimeType
            }
          };
        } catch (e) {
          console.error("Failed to fetch image for Gemini:", e);
          return null;
        }
      };

      const conversationFlowRule = `
CONVERSATION RULES (STRICT):
${greetingRule}
* BE CONCISE. WhatsApp users prefer short, direct messages.
* ONLY answer what the customer asked. Do not provide extra information or "fun facts" unless directly relevant.
* If providing a list (like prices), keep it brief and well-formatted.
* Never repeat greetings in the middle of a chat.
`;

      
      // 2. Fetch Global System Prompt from Database
      let settings: any = null;
      if (targetBusinessId) {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_system_prompt').eq('business_id', targetBusinessId).maybeSingle();
        settings = data;
      }
      if (!settings) {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_system_prompt').is('business_id', null).maybeSingle();
        settings = data;
      }

      const globalPrompt = settings?.value || "You are an AI Support Assistant. Your goal is to provide fast, accurate, and helpful support. If you don't know the answer, tell the customer kindly and use [NEEDS_AGENT].";

      const assignedName = agentName || "AI Support";
      const assignedPersona = customPersona || "Professional and polite";

      const safetyRules = `SAFETY GUARDRAILS (STRICT):
* You are a Technical Wellness Consultant for a Health Equipment Retailer.
* Never guarantee medical cures.
* You must clearly state that this is a wellness device, not a medical cure.
* If the user mentions pregnancy, pacemakers, or severe heart conditions, immediately halt recommendations and advise them to consult a doctor.
* You must retrieve device specifications, therapy benefits (e.g., cellular vitality, circulation), warranty info, and pricing EXCLUSIVELY from the COMPANY KNOWLEDGE BASE.`;

      const dynamicPersonaContext = `=== YOUR ASSIGNED IDENTITY ===\nYour Name: ${assignedName}\nYour Specific Personality & Tone: ${assignedPersona}\n\nYou MUST speak exactly like ${assignedName} using the tone described above.\n${referenceSnippets ? `STYLE REFERENCE (Mimic this tone/vocabulary):\n${referenceSnippets}\n` : ''}==============================`;

      let basePrompt = `${dynamicPersonaContext}\n\n${globalPrompt}\n\n${safetyRules}\n\n${knowledgeBaseBlock}\n${conversationFlowRule}`;


      // Format history for Gemini contents array
      const rawContents: { role: string, text: string }[] = [];
      
      // Add history messages
      if (history && history.length > 0) {
        for (const msg of history) {
          const text = msg.message_text || "";
          if (!text.trim()) continue;
          
          if (msg.sender_type === 'system') {
            rawContents.push({ role: 'user', text: `[SYSTEM STATUS UPDATE: ${text.trim()}]` });
          } else {
            const role = msg.sender_type === 'customer' ? 'user' : 'model';
            rawContents.push({ role, text: text.trim() });
          }
        }
      }

      // Add the current user input
      if (userInput && userInput.trim()) {
        rawContents.push({ role: 'user', text: userInput.trim() });
      }

      // Merge consecutive roles and ensure first role is 'user'
      const contents: any[] = [];
      for (const msg of rawContents) {
        let parts: any[] = [];
        
        // Check for images in the text
        const imageRegex = /\[(?:IMAGE_RECEIPT|UPLOADED_IMAGE):\s*(https?:\/\/[^\]]+)\]/g;
        let lastIndex = 0;
        let match;
        while ((match = imageRegex.exec(msg.text)) !== null) {
          // Add text before the image
          if (match.index > lastIndex) {
            parts.push({ text: msg.text.substring(lastIndex, match.index) });
          }
          
          // Add the image URL as text so the AI still has the reference
          parts.push({ text: `[UPLOADED_IMAGE: ${match[1]}]` });
          
          // Fetch the image and add as inlineData
          const imageData = await fetchImageForGemini(match[1]);
          if (imageData) {
            parts.push(imageData);
          }
          
          lastIndex = imageRegex.lastIndex;
        }
        
        // Add remaining text
        if (lastIndex < msg.text.length) {
          parts.push({ text: msg.text.substring(lastIndex) });
        }

        if (contents.length === 0) {
          if (msg.role === 'user') {
            contents.push({ role: msg.role, parts: parts });
          }
        } else {
          if (contents[contents.length - 1].role === msg.role) {
            contents[contents.length - 1].parts.push(...parts);
          } else {
            contents.push({ role: msg.role, parts: parts });
          }
        }
      }

      if (contents.length === 0) {
        // Fallback if somehow contents is empty
        contents.push({ role: 'user', parts: [{ text: "Hello" }] });
      }

      // Add a final instruction to the basePrompt to ensure completion
      const nowUtC = new Date();
      const mytDateObj = new Date(nowUtC.getTime() + 8 * 3600 * 1000);
      const todayDate = mytDateObj.toISOString().split('T')[0];
      const currentTimeMYT = mytDateObj.toISOString().split('T')[1].substring(0, 5);
      
      const finalBasePrompt = `${basePrompt}\n\nIMPORTANT: Be concise. Stay on topic.\n\nTIMEZONE RULE:\nYou are operating in Malaysia Time (GMT+8). The current local date is ${todayDate} and the current local time is ${currentTimeMYT}.\n`;

      
      const captureLeadDeclaration = {
        name: "capture_customer_lead",
        description: "Save customer details when they provide information like interest, email, order details, etc.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            lead_type: { type: Type.STRING, description: "Type of lead (e.g., 'showroom_demo', 'pricing_inquiry', 'technical_support', 'warranty_claim')" },
            health_focus: { type: Type.STRING, description: "Customer's focus (e.g., 'sleep', 'circulation', 'fatigue')" },
            delivery_location: { type: Type.STRING, description: "City/State for setup logistics" },
            data: { type: Type.STRING, description: "JSON string containing any other extracted fields from the conversation" }
          },
          required: ["lead_type", "health_focus", "delivery_location", "data"],
        },
      };

      const suggestKnowledgeTool = {
        name: "suggest_knowledge_update",
        description: "Suggest a new topic and answer for the company knowledge base if the current one is missing or outdated.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "The customer's question" },
            best_answer: { type: Type.STRING, description: "The correct answer based on context or team confirmation" },
            category: { type: Type.STRING, description: "The category of this information (e.g., pricing, policy, general)" }
          },
          required: ["question", "best_answer", "category"],
        },
      };

      const activeTools = [captureLeadDeclaration];
      
      if (ENABLE_SELF_LEARNING && agentName && agentName.toLowerCase() === "laila") {
        activeTools.push(suggestKnowledgeTool);
      }

      // 1. First AI Call
      let response = await callGeminiWithFallback({
        contents: contents,
        config: {
          systemInstruction: finalBasePrompt,
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          tools: [{ functionDeclarations: activeTools }],
        }
      });

      let loopCount = 0;
      while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && loopCount < 5) {
        loopCount++;
        
        // Essential: Append the model's function call message to history before appending the response!
        contents.push(response.candidates[0].content);
        
        const functionResponseParts = [];
        let anyToolCalled = false;

        for (const part of response.candidates[0].content.parts) {
          if (!part.functionCall) continue;
          const call = part.functionCall;
          let toolResult = {};
          let toolCalled = false;

          if (call.name === "capture_customer_lead") {
            toolCalled = true;
            const args = call.args;
            try {
              const dataObj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
              await supabase.from('leads').insert([{
                ticket_id: ticketId,
                business_id: targetBusinessId,
                customer_phone: customerPhone,
                lead_type: args.lead_type || 'general',
                data: {
                  ...dataObj,
                  health_focus: args.health_focus,
                  delivery_location: args.delivery_location
                },
                status: 'New'
              }]);
              toolResult = { success: true, message: "Lead captured successfully." };
            } catch (err) {
              toolResult = { error: err.message };
            }
          } else if (call.name === "suggest_knowledge_update") {
            toolCalled = true;
            const args = call.args;
            try {
              await supabase.from('company_knowledge').insert([{ 
                business_id: targetBusinessId,
                topic: args.question, 
                fact: args.best_answer, 
                category: args.category, 
                is_active: false 
              }]);
              toolResult = { success: true, message: "Draft saved for admin review." };
            } catch (err) {
              console.warn("Silent failure on knowledge suggestion:", err.message);
              toolResult = { success: true, message: "Draft saved for admin review." };
            }
          }

          if (toolCalled) {
            anyToolCalled = true;
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            });
          }
        }

        if (anyToolCalled) {
          if (response.candidates && response.candidates[0] && response.candidates[0].content) {
            contents.push(response.candidates[0].content);
          }
          contents.push({
            role: "user",
            parts: functionResponseParts
          });

          response = await callGeminiWithFallback({
            contents: contents,
            config: {
              systemInstruction: finalBasePrompt,
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              tools: [{ functionDeclarations: activeTools }],
            }
          });
        } else {
          break;
        }
      }

      let aiResponseText = '';
      try {
        aiResponseText = response.text || '';
      } catch (e: any) {
        console.error("Error getting response.text:", e);
        return "Kejap ya, I check dulu... [NEEDS_AGENT]";
      }
      
      if (!aiResponseText) {
         console.error("Gemini API returned no text. Full response:", JSON.stringify(response));
         return "Kejap ya, I check dulu... [NEEDS_AGENT]";
      }
      
      if (agentName) {
        const prefixRegex = new RegExp(`^\\*?\\*?${agentName}\\*?\\*?\\s*:\\s*`, 'i');
        aiResponseText = aiResponseText.replace(prefixRegex, '').trim();
      }
      aiResponseText = aiResponseText.replace(/^\*?\*?Assistant\*?\*?\s*:\s*/i, '').trim();

      const lowerResponse = aiResponseText.toLowerCase();
      return aiResponseText;

    } catch (error: any) {
      lastError = error;
      const isQuotaOrAuthError = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED") || (error.status === 429) || error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || (error.status === 403) || error.message?.includes("404") || error.message?.includes("NOT_FOUND");
      
      if (isQuotaOrAuthError && attempts < maxAttempts && GEMINI_BACKUP_KEY) {
        console.log("⚠️ Primary Key Failed (Quota/Auth/404). Retrying with Backup Key...");
        currentKey = GEMINI_BACKUP_KEY;
        continue;
      }
      
      console.error("Gemini Fetch Error:", error);
      return `Kejap ya boss, line sistem tengah sangkut jap. I check manual jap ya. [NEEDS_AGENT] (System Error: ${error.message})`;
    }
  }
  
  return `Kejap ya boss, line sistem tengah sangkut jap. I check manual jap ya. [NEEDS_AGENT] (Attempts exhausted. Last Error: ${lastError?.message})`;
}

async function sendWhatsAppImage(to: string, imageUrl: string, token: string = META_ACCESS_TOKEN!, phoneId: string = META_PHONE_ID!) {
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: { link: imageUrl },
    }),
  });
}

// Helper: Download Media from WhatsApp and Upload to Supabase Storage
async function processWhatsAppMedia(mediaId: string, ticketId: string, supabaseClient: any, token: string) {
  try {
    // 1. Get the media URL from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const metaData = await metaRes.json();
    if (!metaData.url) return null;

    // 2. Download the actual binary file
    const fileRes = await fetch(metaData.url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const blob = await fileRes.blob();

    // 3. Upload to Supabase Storage (Bucket must be named 'chat_media' and public)
    const fileExt = metaData.mime_type?.split('/')[1] || 'bin';
    const fileName = `${ticketId}/${Date.now()}_${mediaId}.${fileExt}`;
    
    const { error } = await supabaseClient.storage
      .from('chat_media')
      .upload(fileName, blob, {
        contentType: metaData.mime_type,
        upsert: false
      });

    if (error) throw error;

    // 4. Get the Public URL
    const { data: publicUrlData } = supabaseClient.storage.from('chat_media').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  } catch (e) {
    console.error("Error processing media:", e);
    return null;
  }
} 
