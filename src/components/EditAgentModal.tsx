import React, { useState } from 'react';
import { X, Shield, User, Info, MessageSquare, Smile, Zap, Save, Bot, Play, Loader2 } from 'lucide-react';
import { Agent, ToneStyle, EmojiLevel } from '../types';
import { Badge } from './Badge';
import { cn } from '../utils';
import { supabase } from '../supabase';

import { GoogleGenAI } from "@google/genai";

interface EditAgentModalProps {
  agent: Agent | Partial<Agent>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAgent: Agent) => void;
  isNew?: boolean;
}

export const EditAgentModal: React.FC<EditAgentModalProps> = ({ agent, isOpen, onClose, onSave, isNew = false }) => {
  const [formData, setFormData] = useState<Agent>({
    id: '',
    name: '',
    username: '',
    role: 'agent',
    status: 'online',
    is_approved: true,
    tone_style: 'professional',
    greeting_template: '',
    signature: '',
    emoji_level: 'low',
    response_style_rules: {
      useStructuredReplies: true,
      useShortSentences: false,
      addEmojisAutomatically: false,
      formalLanguageMode: true
    },
    personality_instructions: '',
    training_notes: '',
    ai_mirroring_enabled: true,
    created_at: new Date().toISOString(),
    ...agent
  });

  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof Agent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRuleToggle = (rule: keyof Agent['response_style_rules']) => {
    setFormData(prev => ({
      ...prev,
      response_style_rules: {
        ...prev.response_style_rules,
        [rule]: !prev.response_style_rules[rule]
      }
    }));
  };

  const handleTestPersona = async () => {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestResponse('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const knowledgeBaseBlock = `COMPANY KNOWLEDGE BASE: (Simulated for testing)`;
      const conversationFlowRule = `
CONVERSATION RULES (STRICT):
* Start with a warm greeting ONLY if this is the first message.
* BE CONCISE. WhatsApp users prefer short, direct messages.
* ONLY answer what the customer asked.
* Never repeat greetings in the middle of a chat.`;

      const basePrompt = `${knowledgeBaseBlock}
${conversationFlowRule}

You are the AI First-Responder for ${formData.name}. 
* You MUST reply using their exact tone, vocabulary, and style.
* Do NOT prefix your response with your name. 
* Do not announce yourself as an AI. 

AGENT PERSONALITY GUIDE:
${formData.personality_instructions || "You are a helpful assistant."}

${formData.training_notes ? `STYLE REFERENCE (Mimic this tone/vocabulary):\n${formData.training_notes}\n` : ''}
Reply to the customer message as if you are ${formData.name}.

IMPORTANT: Be concise. Stay on topic. Strictly follow the agent's style.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: basePrompt,
        },
        contents: [{ role: 'user', parts: [{ text: testMessage }] }],
      });

      setTestResponse(response.text || "No response generated.");
    } catch (error: any) {
      console.error("Test Persona Error:", error);
      setTestResponse("Error: Could not connect to AI. Please ensure your GEMINI_API_KEY is set correctly.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isNew ? 'Add New Agent' : 'Edit Agent Personality'}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isNew ? 'Create a new support agent profile.' : `Configure how ${agent.name} interacts with customers.`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Section: Basic Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
              <Info className="w-4 h-4 text-blue-500" />
              Basic Info
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1">Agent Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1">Username</label>
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="username"
                  disabled={!isNew}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all disabled:opacity-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1">Role</label>
                <select 
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", formData.status === 'online' ? "bg-emerald-500" : "bg-slate-300")} />
                  <span className="text-sm font-medium text-slate-700">Status</span>
                </div>
                <button 
                  onClick={() => handleChange('status', formData.status === 'online' ? 'offline' : 'online')}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-all",
                    formData.status === 'online' ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    formData.status === 'online' ? "right-1" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Section: Personality Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
              <Smile className="w-4 h-4 text-purple-500" />
              Personality Settings
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1">Tone Style</label>
                <select 
                  value={formData.tone_style}
                  onChange={(e) => handleChange('tone_style', e.target.value as ToneStyle)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="energetic">Energetic</option>
                  <option value="concise">Concise</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 ml-1">Emoji Level</label>
                <select 
                  value={formData.emoji_level}
                  onChange={(e) => handleChange('emoji_level', e.target.value as EmojiLevel)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
                >
                  <option value="none">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Greeting Template</label>
              <textarea 
                value={formData.greeting_template}
                onChange={(e) => handleChange('greeting_template', e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                placeholder="e.g. Hi! I'm Mahira 👋"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Signature</label>
              <textarea 
                value={formData.signature}
                onChange={(e) => handleChange('signature', e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                placeholder="e.g. — Mahira 😊"
              />
            </div>
          </section>

          {/* Section: Response Style */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-500" />
              Response Style Options
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Use structured replies', key: 'useStructuredReplies' },
                { label: 'Use short sentences', key: 'useShortSentences' },
                { label: 'Add emojis automatically', key: 'addEmojisAutomatically' },
                { label: 'Formal language mode', key: 'formalLanguageMode' },
              ].map((rule) => (
                <div key={rule.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-700">{rule.label}</span>
                  <button 
                    onClick={() => handleRuleToggle(rule.key as keyof Agent['response_style_rules'])}
                    className={cn(
                      "w-8 h-4 rounded-full relative transition-all",
                      formData.response_style_rules[rule.key as keyof Agent['response_style_rules']] ? "bg-black" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                      formData.response_style_rules[rule.key as keyof Agent['response_style_rules']] ? "right-0.5" : "left-0.5"
                    )} />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Zap className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-violet-900">AI Mirroring</p>
                  <p className="text-[10px] text-violet-600">Enable AI to mimic this agent's persona</p>
                </div>
              </div>
              <button 
                onClick={() => handleChange('ai_mirroring_enabled', !formData.ai_mirroring_enabled)}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all",
                  formData.ai_mirroring_enabled ? "bg-violet-600" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                  formData.ai_mirroring_enabled ? "right-1" : "left-1"
                )} />
              </button>
            </div>
          </section>

          {/* Section: Persona Management */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
              <Bot className="w-4 h-4 text-violet-500" />
              Persona Management
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">AI Personality Instructions</label>
              <textarea 
                value={formData.personality_instructions || ''}
                onChange={(e) => handleChange('personality_instructions', e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                placeholder="e.g. Use softened speech like 'bolehh', always reply wa'alaikumussalam. Keep answers short and sweet."
              />
              <p className="text-[10px] text-slate-400 ml-1">Describe the agent's vibe. Note: AI is instructed to be concise by default.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Reference Conversation Snippets</label>
              <textarea 
                value={formData.training_notes || ''}
                onChange={(e) => handleChange('training_notes', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                placeholder="Paste actual chat logs for the AI to analyze and mimic..."
              />
            </div>

            {/* Test Persona Tool */}
            <div className="bg-violet-50/50 rounded-3xl p-6 border border-violet-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-violet-900">Test Persona</h4>
                <Badge variant="ai">Preview</Badge>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type a message to test the AI..."
                  className="flex-1 px-4 py-2 bg-white border border-violet-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button 
                  onClick={handleTestPersona}
                  disabled={isTesting || !testMessage.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Test
                </button>
              </div>
              {testResponse && (
                <div className="p-4 bg-white rounded-2xl border border-violet-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">AI Response</p>
                  <p className="text-sm text-slate-700 leading-relaxed italic">"{testResponse}"</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-8 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isNew ? 'Create Agent' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
