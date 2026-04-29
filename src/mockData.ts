import { Agent, Customer, Ticket, Message } from './types';

export const MOCK_AGENTS: Agent[] = [
  { 
    id: '1', 
    name: 'Seri Admin', 
    username: 'seri', 
    role: 'admin', 
    status: 'online', 
    is_approved: true,
    tone_style: 'professional',
    greeting_template: "Hello! I'm Seri, how can I assist you today?",
    signature: "Best regards, Seri",
    emoji_level: 'low',
    response_style_rules: {
      useStructuredReplies: true,
      useShortSentences: false,
      addEmojisAutomatically: false,
      formalLanguageMode: true
    },
    ai_mirroring_enabled: true,
    created_at: new Date().toISOString() 
  },
  { 
    id: '2', 
    name: 'Qila Agent', 
    username: 'qila', 
    role: 'agent', 
    status: 'online', 
    is_approved: true,
    tone_style: 'friendly',
    greeting_template: "Hi! I'm Qila 👋 How's your day going?",
    signature: "— Qila 😊",
    emoji_level: 'high',
    response_style_rules: {
      useStructuredReplies: false,
      useShortSentences: true,
      addEmojisAutomatically: true,
      formalLanguageMode: false
    },
    ai_mirroring_enabled: true,
    created_at: new Date().toISOString() 
  },
  { 
    id: '3', 
    name: 'Budi Agent', 
    username: 'budi', 
    role: 'agent', 
    status: 'offline', 
    is_approved: true,
    tone_style: 'concise',
    greeting_template: "Budi here. What do you need?",
    signature: "Budi.",
    emoji_level: 'none',
    response_style_rules: {
      useStructuredReplies: true,
      useShortSentences: true,
      addEmojisAutomatically: false,
      formalLanguageMode: false
    },
    ai_mirroring_enabled: false,
    created_at: new Date().toISOString() 
  },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', phone_number: '+628123456789', name: 'John Doe' },
  { id: 'c2', phone_number: '+628987654321', name: 'Sarah Wilson' },
  { id: 'c3', phone_number: '+628555555555', name: 'Michael Chen' },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1',
    customer_id: 'c1',
    customer: MOCK_CUSTOMERS[0],
    status: 'assigned',
    assigned_agent_id: '2',
    assigned_agent: { name: 'Qila Agent' },
    handled_by: 'agent',
    tag: 'Billing',
    is_closed: false,
    is_deleted: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    closed_at: null,
    last_message: 'I have a question about my last invoice.'
  },
  {
    id: 't2',
    customer_id: 'c2',
    customer: MOCK_CUSTOMERS[1],
    status: 'ai_handling',
    assigned_agent_id: null,
    handled_by: 'ai',
    tag: 'Support',
    is_closed: false,
    is_deleted: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    closed_at: null,
    last_message: 'How do I reset my password?'
  },
  {
    id: 't3',
    customer_id: 'c3',
    customer: MOCK_CUSTOMERS[2],
    status: 'waiting_assignment',
    assigned_agent_id: null,
    handled_by: 'agent',
    tag: 'Sales',
    is_closed: false,
    is_deleted: false,
    created_at: new Date(Date.now() - 10800000).toISOString(),
    closed_at: null,
    last_message: 'I want to upgrade my plan.'
  }
];

export const MOCK_MESSAGES: Message[] = [
  { id: 'm1', ticket_id: 't1', sender_type: 'customer', message_text: 'Hello, I have a question about my last invoice.', created_at: new Date(Date.now() - 3500000).toISOString() },
  { id: 'm2', ticket_id: 't1', sender_type: 'agent', message_text: 'Hi John! I can help you with that. Which invoice are you referring to?', created_at: new Date(Date.now() - 3400000).toISOString() },
  { id: 'm3', ticket_id: 't2', sender_type: 'customer', message_text: 'How do I reset my password?', created_at: new Date(Date.now() - 7100000).toISOString() },
  { id: 'm4', ticket_id: 't2', sender_type: 'ai', message_text: 'You can reset your password by clicking the "Forgot Password" link on the login page.', created_at: new Date(Date.now() - 7000000).toISOString() },
];
