export type Role = 'admin' | 'agent';
export type AgentStatus = 'online' | 'offline';
export type TicketStatus = 'ai_handling' | 'waiting_assignment' | 'waiting_assignment' | 'assigned';
export type SenderType = 'customer' | 'agent' | 'ai' | 'system';
export type ToneStyle = 'professional' | 'friendly' | 'energetic' | 'concise';
export type EmojiLevel = 'none' | 'low' | 'medium' | 'high';

export interface ResponseStyleRules {
  useStructuredReplies: boolean;
  useShortSentences: boolean;
  addEmojisAutomatically: boolean;
  formalLanguageMode: boolean;
}

export interface Business {
  id: string;
  name: string;
  whatsapp_phone_number_id: string;
  meta_access_token: string;
  created_at?: string;
}

export interface PdfDocument {
  id: string;
  file_name: string;
  content_markdown: string;
  status: 'pending' | 'exported' | 'rejected';
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  username: string;
  role: Role;
  status: AgentStatus;
  is_approved: boolean;
  tone_style: ToneStyle;
  greeting_template: string;
  signature: string;
  emoji_level: EmojiLevel;
  response_style_rules: ResponseStyleRules;
  personality_instructions?: string;
  training_notes?: string;
  active_tickets?: number;
  ai_mirroring_enabled: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  phone_number: string;
  name: string;
}

export interface Ticket {
  id: string;
  customer_id: string;
  customer?: Customer;
  status: TicketStatus;
  assigned_agent_id: string | null;
  assigned_agent?: Partial<Agent>;
  handled_by: 'ai' | 'agent';
  tag: string;
  is_closed: boolean;
  is_deleted: boolean;
  created_at: string;
  closed_at: string | null;
  last_message?: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  message_text: string;
  created_at: string;
}

export interface RoutingRule {
  id: string;
  keyword: string;
  agent_id: string;
  agent?: Agent;
  created_at: string;
}

export interface KnowledgeFact {
  id: string;
  product_name: string;
  category: string;
  topic: string;
  fact: string;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GenericLead {
  id: string;
  ticket_id?: string;
  customer_phone: string;
  lead_type: string;
  data: Record<string, any>;
  status: 'New' | 'InProgress' | 'Done' | 'Rejected';
  created_at: string;
}

export interface BookingLead {
  id: string;
  ticket_id?: string;
  customer_phone: string;
  lead_type: string;
  data: Record<string, any>;
  status: 'New' | 'InProgress' | 'Done' | 'Rejected';
  created_at: string;
}
