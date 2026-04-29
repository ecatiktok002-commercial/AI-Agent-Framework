import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Send, 
  User, 
  Bot, 
  CheckCircle2,
  ChevronDown,
  Paperclip,
  Smile,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../components/Badge';
import { cn } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Ticket, Message, Agent } from '../types';

export default function TicketsPage() {
  const { agent } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'mine' | 'active' | 'end'>('mine');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomerMenu, setShowCustomerMenu] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'clear' | 'full' | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [newMessages, setNewMessages] = useState<Record<string, boolean>>({});
  const [trainingStates, setTrainingStates] = useState<Record<string, 'idle' | 'loading' | 'success'>>({});
  const [notifiedTickets, setNotifiedTickets] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Audio for notifications
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  }, []);

  const playNotificationSound = () => {
    if (notificationSound.current) {
      notificationSound.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Monitor tickets for [NEEDS_AGENT] tag
  useEffect(() => {
    tickets.forEach(ticket => {
      if (ticket.last_message?.includes('[NEEDS_AGENT]') && !notifiedTickets.has(ticket.id)) {
        // Trigger browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Attention: Action Required', {
            body: `A customer (${ticket.customer?.name || ticket.customer_phone}) needs your approval.`,
            icon: '/favicon.ico'
          });
        }
        
        // Mark as notified
        setNotifiedTickets(prev => new Set(prev).add(ticket.id));
      }
    });
  }, [tickets, notifiedTickets]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);
  const isAdmin = agent?.role === 'admin';

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCustomerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Agents (for assignment)
  useEffect(() => {
    if (isAdmin) {
      const fetchAgents = async () => {
        const { data } = await supabase.from('agents').select('*').eq('role', 'agent');
        setAgents(data || []);
      };
      fetchAgents();
    }
  }, [isAdmin]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Tickets
  const fetchTickets = React.useCallback(async () => {
    let query = supabase
      .from('tickets')
      .select(`
        *, 
        customer:customers(*), 
        assigned_agent:agents(*),
        messages(message_text, created_at)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' });
    
    // We fetch everything and handle tab filtering down in the render logic to avoid multiple queries jumping
    // except for 'mine' which forces the database filter for exact fetching.
    if (ticketFilter === 'mine' && agent) {
      query = query.eq('assigned_agent_id', agent.id);
    }

    const { data, error } = await query;

    if (error) console.error('Error fetching tickets:', error);
    else {
      const processedTickets = (data || []).map(ticket => {
        const latestMessage = (ticket.messages as any[])?.[0];
        return {
          ...ticket,
          last_message: latestMessage?.message_text || ticket.last_message,
          last_activity_at: latestMessage?.created_at || ticket.created_at
        };
      });
      
      processedTickets.sort((a: any, b: any) => 
        new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
      );
      
      setTickets(processedTickets);
      setSelectedTicketId(prev => {
        if (!prev && processedTickets.length > 0) {
          return processedTickets[0].id;
        }
        return prev;
      });
    }
    setLoading(false);
  }, [ticketFilter, agent]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Real-time subscription for Tickets and All Messages
  useEffect(() => {
    if (!agent) return;

    // Real-time subscription for Tickets
    const ticketSubscription = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, async (payload) => {
        console.log('Ticket changed:', payload);
        fetchTickets();
        
        if (payload.eventType === 'UPDATE' && payload.new.assigned_agent_id && payload.old.assigned_agent_id !== payload.new.assigned_agent_id) {
          const { data: agentData } = await supabase.from('agents').select('name').eq('id', payload.new.assigned_agent_id).single();
          if (agentData) {
            setToast({ message: `Ticket assigned to ${agentData.name}`, type: 'success' });
          }
        }
      })
      .subscribe();

    // Real-time subscription for Messages (to update last_message and sort)
    const allMessagesSubscription = supabase
      .channel('public:all_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as Message;
        
        // Refresh the entire ticket list to ensure correct ordering and data
        fetchTickets();

        // Mark as new if not selected
        setSelectedTicketId(currentSelectedId => {
          if (newMessage.ticket_id !== currentSelectedId) {
            setNewMessages(prev => ({ ...prev, [newMessage.ticket_id]: true }));
            playNotificationSound();
          }
          return currentSelectedId;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketSubscription);
      supabase.removeChannel(allMessagesSubscription);
    };
  }, [agent, fetchTickets]);

  // Clear new message badge when ticket is selected
  useEffect(() => {
    if (selectedTicketId) {
      setNewMessages(prev => {
        if (!prev[selectedTicketId]) return prev;
        const next = { ...prev };
        delete next[selectedTicketId];
        return next;
      });
    }
  }, [selectedTicketId]);

  // Fetch Messages for Selected Ticket
  const fetchMessages = React.useCallback(async () => {
    if (!selectedTicketId) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('ticket_id', selectedTicketId)
      .order('created_at', { ascending: true });

    if (error) console.error('Error fetching messages:', error);
    else setMessages(data || []);
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) return;

    fetchMessages();

    // Real-time subscription for Messages
    const messageSubscription = supabase
      .channel(`public:messages:${selectedTicketId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `ticket_id=eq.${selectedTicketId}` 
      }, (payload) => {
        console.log('New message received:', payload);
        const newMessage = payload.new as Message;
        
        // Play sound for incoming customer messages
        if (newMessage.sender_type === 'customer') {
          playNotificationSound();
        }

        setMessages(prev => {
          // Prevent duplicates by ID
          if (prev.some(m => m.id === newMessage.id)) return prev;
          
          // Replace optimistic messages
          if (newMessage.sender_type === 'agent') {
            const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.message_text === newMessage.message_text);
            if (tempIndex !== -1) {
              const next = [...prev];
              next[tempIndex] = newMessage;
              return next;
            }
          }
          
          return [...prev, newMessage];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [selectedTicketId, fetchMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedTicketId || !agent || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    // Optimistic Update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      ticket_id: selectedTicketId,
      sender_type: 'agent',
      message_text: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMessage]);

    // Call Edge Function to send message via WhatsApp
    try {
      console.log('Sending message via Supabase Invoke...');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-agent-core', {
        body: {
          action: 'send-message',
          ticket_id: selectedTicketId,
          message_text: text,
          agent_id: agent.id
        }
      });

      if (error || (data && data.success === false)) {
        console.error('Supabase Invoke Error:', error || data?.error);
        let errorMessage = error?.message || data?.error || 'Unknown error';
        
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        // Fallback for preview/testing: insert into database directly if edge function fails
        console.log('Falling back to direct database insert for preview...');
        try {
          const { error: dbError } = await supabase.from('messages').insert({
            ticket_id: selectedTicketId,
            sender_type: 'agent',
            message_text: text
          });
          
          if (dbError) throw dbError;
          
          await supabase.from('tickets').update({
            last_message: text,
            status: agent.role === 'admin' ? 'assigned' : undefined
          }).eq('id', selectedTicketId);

          setToast({ message: 'Message saved locally (WhatsApp delivery failed)', type: 'warning' });
          fetchMessages();
          fetchTickets();
        } catch (fallbackError) {
          console.error('Fallback insert failed:', fallbackError);
          setToast({ message: 'Failed to send message: ' + errorMessage, type: 'error' });
          // Remove optimistic message on error
          setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
          setMessageText(text); 
        }
      } else {
        console.log('Message sent successfully!', data);
        // The real-time subscription will replace the optimistic message with the real one
        // but we can also refresh to be sure
        fetchMessages();
        fetchTickets();
      }
    } catch (error) {
      console.error('Unexpected Error during send:', error);
      setToast({ message: 'Unexpected error sending message', type: 'error' });
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setMessageText(text); 
    } finally {
      setIsSending(false);
    }
  };

  const handleTakeOver = async () => {
    if (!selectedTicketId || !agent) return;

    setIsTakingOver(true);
    try {
      // Insert system message for take-over
      await supabase.from('messages').insert({
        ticket_id: selectedTicketId,
        sender_type: 'system',
        message_text: `Agent ${agent.name} has taken over the conversation.`
      });

      // Update local state status
      await supabase
        .from('tickets')
        .update({ 
          status: 'assigned', 
          assigned_agent_id: agent.id,
          handled_by: 'agent'
        })
        .eq('id', selectedTicketId);
      
      setToast({ message: 'You have taken over the chat', type: 'success' });
      fetchTickets();
    } catch (error) {
      console.error('Error taking over chat:', error);
      setToast({ message: 'Failed to take over chat', type: 'error' });
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleAssignAgent = async (targetAgentId: string) => {
    if (!selectedTicketId) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_agent_id: targetAgentId })
        .eq('id', selectedTicketId);

      if (error) throw error;
      
      const targetAgent = agents.find(a => a.id === targetAgentId);
      setToast({ message: `Ticket assigned to ${targetAgent?.name || 'agent'}`, type: 'success' });
      fetchTickets();
    } catch (error) {
      console.error('Error assigning agent:', error);
      setToast({ message: 'Failed to assign agent', type: 'error' });
    }
  };

  const handleClearConversation = async () => {
    if (!selectedTicketId) return;

    setIsDeleting(true);
    try {
      // Soft delete the ticket to hide it from the active list
      const { error } = await supabase
        .from('tickets')
        .update({ is_deleted: true })
        .eq('id', selectedTicketId);

      if (error) throw error;

      setToast({ message: 'Conversation cleared', type: 'success' });
      setSelectedTicketId(null);
      setDeleteMode(null);
      fetchTickets();
    } catch (error) {
      console.error('Error clearing conversation:', error);
      setToast({ message: 'Failed to clear conversation', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedTicket?.customer_id || !selectedTicketId) return;
    
    setIsDeleting(true);
    try {
      // 1. Delete all messages associated with this ticket
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('ticket_id', selectedTicketId);
        
      if (messagesError) throw messagesError;

      // 2. Delete the ticket itself
      const { error: ticketError } = await supabase
        .from('tickets')
        .delete()
        .eq('id', selectedTicketId);

      if (ticketError) throw ticketError;

      // 3. Attempt to delete the customer (this might fail if they have other tickets, which is fine)
      await supabase
        .from('customers')
        .delete()
        .eq('id', selectedTicket.customer_id);

      setToast({ message: 'Chat and customer record deleted', type: 'success' });
      setSelectedTicketId(null);
      setDeleteMode(null);
      setShowCustomerMenu(false);
      fetchTickets();
    } catch (error) {
      console.error('Error deleting chat:', error);
      setToast({ message: 'Failed to delete chat', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateCustomerName = async () => {
    if (!selectedTicket?.customer_id || !editCustomerName.trim()) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({ name: editCustomerName.trim() })
        .eq('id', selectedTicket.customer_id);

      if (error) throw error;

      setIsEditingCustomer(false);
      setShowCustomerMenu(false);
      fetchTickets();
    } catch (error: any) {
      console.error('Error updating customer name:', error);
      alert('Error updating customer: ' + error.message);
    }
  };

  const handleToggleBot = async () => {
    if (!selectedTicketId || !selectedTicket) return;

    const currentHandledBy = selectedTicket.handled_by || 'ai';
    const newHandledBy = currentHandledBy === 'ai' ? 'agent' : 'ai';
    
    try {
      const updateData: any = { handled_by: newHandledBy };
      
      // If handing back to AI, also update the status to ai_handling
      if (newHandledBy === 'ai') {
        updateData.status = 'ai_handling';
      }

      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', selectedTicketId);

      if (error) throw error;

      setToast({ message: `Chat handed over to ${newHandledBy === 'ai' ? 'AI' : 'Agent'}`, type: 'success' });
    } catch (error) {
      console.error('Error toggling bot status:', error);
      setToast({ message: 'Failed to toggle bot status', type: 'error' });
    }
  };

  const handleTrainAI = async (msgIndex: number, msg: Message) => {
    if (!agent) return;
    
    // Find the immediately preceding message sent by the customer
    let customerMsg: Message | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].sender_type === 'customer') {
        customerMsg = messages[i];
        break;
      }
    }

    if (!customerMsg) {
      setToast({ message: 'No preceding customer message found to train on.', type: 'error' });
      return;
    }

    const newSnippet = `[INTENT: Learned via Golden Reply]\nCustomer: ${customerMsg.message_text}\nAgent: ${msg.message_text}`;

    setTrainingStates(prev => ({ ...prev, [msg.id]: 'loading' }));

    try {
      // Get current snippets
      const { data: agentData, error: fetchError } = await supabase
        .from('agents')
        .select('training_notes')
        .eq('id', agent.id)
        .single();

      if (fetchError) throw fetchError;

      const currentSnippets = agentData.training_notes || '';
      const updatedSnippets = currentSnippets ? `${currentSnippets}\n\n${newSnippet}` : newSnippet;

      const { error: updateError } = await supabase
        .from('agents')
        .update({ training_notes: updatedSnippets })
        .eq('id', agent.id);

      if (updateError) throw updateError;

      setTrainingStates(prev => ({ ...prev, [msg.id]: 'success' }));
      setToast({ message: `Added to ${agent.name}'s Training Snippets.`, type: 'success' });
    } catch (error) {
      console.error('Error training AI:', error);
      setTrainingStates(prev => ({ ...prev, [msg.id]: 'idle' }));
      setToast({ message: 'Failed to train AI.', type: 'error' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-400">Loading tickets...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-white">
        {/* Left: Ticket List */}
      <div className={cn(
        "border-r border-slate-200 flex-col bg-slate-50/30 transition-all",
        "w-full md:w-80",
        selectedTicketId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Tickets</h2>
            <Badge variant="info">{tickets.length} Open</Badge>
          </div>

          {/* Ticket Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setTicketFilter('mine')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                ticketFilter === 'mine' 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              My Tickets
            </button>
            <button
              onClick={() => setTicketFilter('active')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                ticketFilter === 'active' 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Active Tickets
            </button>
            <button
              onClick={() => setTicketFilter('end')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                ticketFilter === 'end' 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              End Tickets
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(() => {
            const displayedTickets = tickets.filter(t => {
              if (ticketFilter === 'mine') return t.tag !== 'Done'; // My active tickets
              if (ticketFilter === 'active') return t.tag !== 'Done';
              if (ticketFilter === 'end') return t.tag === 'Done';
              return true;
            });
            
            if (displayedTickets.length === 0) {
              return <div className="p-8 text-center text-slate-400 text-sm">No tickets found in this tab.</div>;
            }

            return displayedTickets.map((ticket) => {
              const needsAction = ticket.last_message?.includes('[NEEDS_AGENT]') && ticket.status === 'waiting_assignment';
              const displayLastMessage = (ticket.last_message || 'No messages yet').replace(/\[NEEDS_AGENT\]/g, '').trim();

              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "w-full p-4 text-left border-b border-slate-100 transition-all hover:bg-white flex flex-col gap-2",
                    selectedTicketId === ticket.id 
                      ? ticket.status === 'ai_handling'
                        ? "bg-gradient-to-br from-blue-50 to-purple-50 shadow-sm ring-1 ring-blue-200 z-10"
                        : ticket.status === 'assigned' || ticket.status === 'waiting_assignment'
                          ? "bg-gradient-to-br from-emerald-50 to-blue-50 shadow-sm ring-1 ring-emerald-200 z-10"
                          : "bg-white shadow-sm ring-1 ring-slate-200 z-10"
                      : "",
                    needsAction && "animate-pulsate-red border-red-200"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5 flex-1 truncate">
                      <p className="font-semibold text-slate-900 text-sm truncate">{ticket.customer?.name || 'Unknown Customer'}</p>
                      {needsAction && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase tracking-tighter">
                          <AlertCircle className="w-3 h-3" />
                          NEEDS ACTION
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {newMessages[ticket.id] && (
                        <Badge variant="info" className="px-1.5 py-0 text-[8px] animate-pulse">New</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{displayLastMessage}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={
                      ticket.status === 'ai_handling' ? 'ai' : 
                      ticket.status === 'waiting_assignment' ? 'warning' : 'success'
                    }>
                      {ticket.status === 'ai_handling' 
                        ? `AI ${ticket.assigned_agent?.name?.split(' ')[0] || 'Agent'}` 
                        : ticket.status === 'waiting_assignment'
                          ? `Needs Assignment`
                          : `Agent ${ticket.assigned_agent?.name?.split(' ')[0] || 'Agent'}`}
                    </Badge>
                    {ticket.tag && (
                      <Badge variant="default" className="bg-slate-200/50 border-transparent text-slate-600">
                        {ticket.tag}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Right: Chat Panel */}
      {selectedTicket ? (
        <div className={cn(
          "flex-1 flex-col min-w-0 bg-white transition-all",
          selectedTicketId ? "flex" : "hidden md:flex"
        )}>
          {/* Chat Header */}
          <div className="h-16 border-b border-slate-200 px-4 md:px-6 flex items-center justify-between bg-white/80 backdrop-blur-sm z-10 shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setSelectedTicketId(null)}
                className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTicket.customer?.phone_number}`} 
                  alt="Customer" 
                />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{selectedTicket.customer?.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{selectedTicket.customer?.phone_number}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <Badge variant={selectedTicket.status === 'ai_handling' ? 'ai' : selectedTicket.status === 'waiting_assignment' ? 'warning' : 'success'}>
                    {selectedTicket.status === 'ai_handling' 
                      ? `Chat active: AI ${selectedTicket.assigned_agent?.name?.split(' ')[0] || 'Agent'}` 
                      : selectedTicket.status === 'waiting_assignment'
                        ? `Needs Manual Assignment`
                        : `Chat active: Agent ${selectedTicket.assigned_agent?.name?.split(' ')[0] || 'Agent'}`}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-2 mr-1 md:mr-4 bg-slate-50 px-2 md:px-3 py-1 md:py-1.5 rounded-xl border border-slate-200">
                <span 
                  className="hidden sm:inline-block text-[10px] md:text-xs font-semibold text-slate-600"
                  title={(selectedTicket.handled_by || 'ai') === 'ai' ? 'Bot is active' : 'Bot is paused'}
                >
                  {(selectedTicket.handled_by || 'ai') === 'ai' ? 'AI Handling' : 'Agent Handling'}
                </span>
                <button
                  onClick={handleToggleBot}
                  className={cn(
                    "relative inline-flex h-4 w-7 md:h-5 md:w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shrink-0",
                    (selectedTicket.handled_by || 'ai') === 'ai' ? 'bg-emerald-500' : 'bg-slate-300'
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      (selectedTicket.handled_by || 'ai') === 'ai' ? 'translate-x-4' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              {(selectedTicket.status === 'ai_handling' || selectedTicket.status === 'waiting_assignment') && (
                <button 
                  onClick={handleTakeOver}
                  disabled={isTakingOver}
                  className="px-2 md:px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] md:text-xs font-semibold hover:bg-indigo-100 transition-all flex items-center gap-1 md:gap-2 disabled:opacity-50 shrink-0"
                >
                  {isTakingOver ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="hidden sm:inline">Taking Over...</span>
                    </>
                  ) : (
                    'Take Over'
                  )}
                </button>
              )}
              
              {isAdmin && (
                <div className="relative group">
                  <button 
                    onClick={() => {
                      // Toggle reassign menu
                      const menu = document.getElementById('reassign-menu');
                      if (menu) menu.classList.toggle('hidden');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all text-xs font-semibold text-slate-700"
                  >
                    Reassign
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  
                  <div id="reassign-menu" className="hidden absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emergency Reassign</div>
                    {agents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => {
                          handleAssignAgent(a.id);
                          document.getElementById('reassign-menu')?.classList.add('hidden');
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        {a.name}
                        {selectedTicket.assigned_agent_id === a.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => {
                    setShowCustomerMenu(!showCustomerMenu);
                    setEditCustomerName(selectedTicket.customer?.name || '');
                    setIsEditingCustomer(false);
                  }}
                  className={cn(
                    "p-2 hover:bg-slate-100 rounded-xl transition-all",
                    showCustomerMenu && "bg-slate-100"
                  )}
                >
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>

                {showCustomerMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Customer Details</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                          {isEditingCustomer ? (
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                value={editCustomerName}
                                onChange={(e) => setEditCustomerName(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                                autoFocus
                              />
                              <button 
                                onClick={handleUpdateCustomerName}
                                className="p-1 bg-black text-white rounded-lg hover:bg-slate-800"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-slate-900">{selectedTicket.customer?.name || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                          <p className="text-sm font-mono text-slate-600">{selectedTicket.customer?.phone_number}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => setIsEditingCustomer(!isEditingCustomer)}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5" />
                        {isEditingCustomer ? 'Cancel Editing' : 'Edit Customer Name'}
                      </button>

                      <div className="h-px bg-slate-100 my-1" />

                      <button 
                        onClick={() => {
                          setDeleteMode('clear');
                          setShowCustomerMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Conversation
                      </button>

                      <button 
                        onClick={() => {
                          setDeleteMode('full');
                          setShowCustomerMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 opacity-50" />
                        Delete Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
            {messages.map((msg, index) => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {msg.message_text.replace(/\[NEEDS_AGENT\]/g, '').trim()}
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[70%]",
                    msg.sender_type === 'customer' ? "mr-auto items-start" : "ml-auto items-end"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {msg.sender_type === 'ai' && <Badge variant="ai" className="h-4 flex items-center">AI BOT</Badge>}
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {msg.sender_type === 'customer' ? selectedTicket.customer?.name : msg.sender_type}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.sender_type === 'agent' && (
                      <button
                        onClick={() => handleTrainAI(index, msg)}
                        disabled={trainingStates[msg.id] === 'loading' || trainingStates[msg.id] === 'success'}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
                          trainingStates[msg.id] === 'success' 
                            ? "bg-yellow-400 text-yellow-900" 
                            : "bg-slate-100 text-slate-500 hover:bg-yellow-100 hover:text-yellow-700"
                        )}
                      >
                        {trainingStates[msg.id] === 'loading' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Star className={cn("w-3 h-3", trainingStates[msg.id] === 'success' && "fill-current")} />
                        )}
                        Train AI
                      </button>
                    )}
                  </div>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm shadow-sm border",
                    msg.sender_type === 'customer' 
                      ? "bg-white border-slate-200 text-slate-800 rounded-tl-none" 
                      : msg.sender_type === 'ai'
                        ? "bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-50 border-indigo-100 text-indigo-900 rounded-tr-none"
                        : "bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border-emerald-100 text-emerald-900 rounded-tr-none"
                  )}>
                    {(() => {
                      const cleanText = msg.message_text.replace(/\[NEEDS_AGENT\]/g, '').trim();
                      const imageMatch = cleanText.match(/\[IMAGE_RECEIPT:\s*(.+?)\]/);
                      
                      if (imageMatch) {
                        return (
                          <div className="flex flex-col gap-2">
                            <a href={imageMatch[1]} target="_blank" rel="noreferrer">
                              <img src={imageMatch[1]} alt="Customer Upload" className="max-w-[200px] rounded-lg border border-slate-200 hover:opacity-90 transition-opacity" />
                            </a>
                            <span className="text-[10px] italic text-slate-400">Customer sent an image</span>
                          </div>
                        );
                      }
                      return cleanText;
                    })()}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="max-w-4xl mx-auto relative bg-slate-50 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
              <textarea
                rows={1}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  (selectedTicket.handled_by || 'ai') === 'ai' || selectedTicket.status === 'ai_handling'
                    ? "AI is handling this... Click 'Take Over' to reply." 
                    : selectedTicket.status === 'waiting_assignment'
                      ? "Needs Assignment. Admin must assign manually or take over."
                      : "Type your reply..."
                }
                disabled={
                  isSending ||
                  (selectedTicket.handled_by || 'ai') === 'ai' || 
                  selectedTicket.status === 'ai_handling' ||
                  (selectedTicket.status === 'waiting_assignment' && !isAdmin)
                }
                className={cn(
                  "w-full bg-transparent px-4 py-4 pr-32 text-sm focus:outline-none resize-none",
                  (isSending || (selectedTicket.handled_by || 'ai') === 'ai' || selectedTicket.status === 'ai_handling' || (selectedTicket.status === 'waiting_assignment' && !isAdmin)) && "opacity-50 cursor-not-allowed"
                )}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleSendMessage}
                  className="ml-2 bg-black text-white p-2.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 shadow-md"
                  disabled={
                    isSending ||
                    !messageText.trim() || 
                    (selectedTicket.handled_by || 'ai') === 'ai' || 
                    selectedTicket.status === 'ai_handling' ||
                    (selectedTicket.status === 'waiting_assignment' && !isAdmin)
                  }
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 uppercase tracking-widest font-medium">
              Press Enter to send • Shift + Enter for new line
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50/30 text-slate-400 text-sm">
          Select a ticket to view conversation
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteMode(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6",
                  deleteMode === 'clear' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                )}>
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {deleteMode === 'clear' ? 'Clear Conversation?' : 'Delete Chat?'}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">
                  {deleteMode === 'clear' 
                    ? "Are you sure you want to clear this conversation? This will archive the chat and it will no longer appear in your active list."
                    : "Are you sure you want to delete this chat? This will permanently remove the customer record and all associated history. This cannot be undone."
                  }
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteMode(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={deleteMode === 'clear' ? handleClearConversation : handleDeleteChat}
                    disabled={isDeleting}
                    className={cn(
                      "flex-1 px-6 py-3 text-white rounded-2xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50",
                      deleteMode === 'clear' 
                        ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" 
                        : "bg-red-600 hover:bg-red-700 shadow-red-200"
                    )}
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : (deleteMode === 'clear' ? 'Clear Chat' : 'Delete All')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110]"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-500/90 text-white border-emerald-400" 
                : "bg-red-500/90 text-white border-red-400"
            )}>
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-bold tracking-tight">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
