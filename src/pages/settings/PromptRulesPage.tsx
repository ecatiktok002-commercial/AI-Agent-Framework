import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, ShieldAlert, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';
import { cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

export default function PromptRulesPage() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    let query = supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['ai_system_prompt', 'ai_handoff_keywords']);
      
    const { data: settings } = await query;

    if (settings) {
      settings.forEach(s => {
        if (s.key === 'ai_system_prompt') setSystemPrompt(s.value);
        if (s.key === 'ai_handoff_keywords') setHandoffKeywords(s.value);
      });
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'ai_system_prompt', value: systemPrompt },
        { key: 'ai_handoff_keywords', value: handoffKeywords }
      ];

      const { error } = await supabase
        .from('system_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;
      showToast('AI Prompts & Rules updated');
    } catch (error: any) {
      console.error('Error saving rules:', error);
      showToast('Failed to save rules', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Prompts & Rules</h1>
          <p className="text-slate-500">Advanced guardrails and core behavioral logic.</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-tighter">Advanced Mode</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Master System Prompt</h3>
                  <p className="text-[11px] text-slate-400">The core instruction set that governs everything the AI does.</p>
                </div>
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              
              <div className="relative">
                <textarea 
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black min-h-[300px] resize-none transition-all"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter master rules..."
                />
                <div className="absolute top-4 right-4 px-2 py-1 bg-red-100 rounded text-[10px] font-bold text-red-600 border border-red-200">
                  CRITICAL RULES ONLY
                </div>
              </div>
              
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-[11px] text-red-600 leading-relaxed font-medium">
                  <strong>Warning:</strong> Modifying the Master System Prompt changes core AI behavior. Incorrect settings here can cause the AI to malfunction or ignore safety guardrails.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900">Human Handoff Triggers</h3>
                <p className="text-[11px] text-slate-400">Keywords that immediately alert your team and stop AI responses.</p>
              </div>
              
              <textarea 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[120px] resize-none transition-all"
                value={handoffKeywords}
                onChange={(e) => setHandoffKeywords(e.target.value)}
                placeholder="e.g. human, person, agent, angry, refund, complain"
              />
              <p className="text-[11px] text-slate-500">
                Separate words with commas. When any of these appear in a customer message, the ticket is flagged for human intervention.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "px-10 py-4 bg-black text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl",
              isSaving && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Master Settings
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className={cn(
              "px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-3",
              toast.type === 'success' ? "bg-black text-white" : "bg-red-600 text-white"
            )}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
