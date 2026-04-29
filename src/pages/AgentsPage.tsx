import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Shield, 
  User,
  Edit2,
  Smile,
  CheckCircle2,
  AlertCircle,
  X as XIcon,
  Trash2,
  Eye,
  UserX,
  Zap,
  MessageSquare,
  Activity,
  Users
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { cn } from '../utils';
import { EditAgentModal } from '../components/EditAgentModal';
import { Agent } from '../types';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';

export default function AgentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAgents = async () => {
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .order('name');
    
    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      
      // Check if it's a network/fetch error
      if (agentsError.message === 'TypeError: Failed to fetch' || agentsError.message.includes('Failed to fetch')) {
        showToast('Network error: Could not connect to database. Check your connection or ad blocker.', 'error');
      } else {
        showToast('Failed to load agents', 'error');
      }
      
      setLoading(false);
      return;
    }

    // Fetch active tickets count for each agent
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select('assigned_agent_id')
      .in('status', ['ai_handling', 'assigned'])
      .eq('is_deleted', false);

    if (ticketsError) {
      console.error('Error fetching tickets for load:', ticketsError);
    }

    const loadMap = new Map<string, number>();
    if (ticketsData) {
      ticketsData.forEach(t => {
        if (t.assigned_agent_id) {
          loadMap.set(t.assigned_agent_id, (loadMap.get(t.assigned_agent_id) || 0) + 1);
        }
      });
    }

    const agentsWithLoad = (agentsData || []).map(agent => ({
      ...agent,
      active_tickets: loadMap.get(agent.id) || 0
    }));

    setAgents(agentsWithLoad);
    setLoading(false);
  };

  const handleApproveAgent = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ is_approved: true })
        .eq('id', agentId);

      if (error) throw error;
      
      showToast('Agent approved successfully');
      fetchAgents();
    } catch (error: any) {
      console.error('Error approving agent:', error);
      showToast(error.message || 'Failed to approve agent', 'error');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const isRejecting = deletingAgent && !deletingAgent.is_approved;
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);

      if (error) throw error;
      
      showToast(isRejecting ? 'Agent rejected successfully' : 'Agent deleted successfully');
      setDeletingAgent(null);
      fetchAgents();
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      showToast(error.message || 'Failed to delete agent', 'error');
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    try {
      const { error } = await supabase
        .from('agents')
        .update({ status: newStatus })
        .eq('id', agent.id);

      if (error) throw error;
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
      showToast(`Agent is now ${newStatus}`);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleToggleMirroring = async (agent: Agent) => {
    const newValue = !agent.ai_mirroring_enabled;
    try {
      const { error } = await supabase
        .from('agents')
        .update({ ai_mirroring_enabled: newValue })
        .eq('id', agent.id);

      if (error) throw error;
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, ai_mirroring_enabled: newValue } : a));
      showToast(`AI Mirroring ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveAgent = async (updatedAgent: Agent) => {
    try {
      if (isCreating) {
        // Handle Creation
        const { id, active_tickets, ...agentData } = updatedAgent;
        const { data, error } = await supabase
          .from('agents')
          .insert([{
            ...agentData,
            is_approved: true, // Auto-approve if created by admin
            status: 'online'
          }])
          .select()
          .single();

        if (error) throw error;
        
        showToast('New persona created successfully');
        setIsCreating(false);
        fetchAgents();
        return;
      }

      // Handle Update
      // Optimistic update
      const originalAgents = [...agents];
      setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
      setEditingAgent(null);

      const { id, created_at, username, active_tickets, ...agentData } = updatedAgent;
      const { error } = await supabase.functions.invoke('whatsapp-agent-core', {
        body: {
          action: 'update-agent-persona',
          agent_id: id,
          agent_data: agentData
        }
      });

      if (error) {
        const errorData = await error.context?.json().catch(() => ({}));
        setAgents(originalAgents);
        throw new Error(errorData?.error || error.message);
      }
      
      showToast('Agent settings updated');
    } catch (error: any) {
      console.error('Error saving agent:', error);
      showToast(error.message || 'Failed to save changes', 'error');
      fetchAgents(); // Re-sync on error
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading agents...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Team Personas</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">Manage your support agents and their AI mirroring settings.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create New Persona
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search by name or username..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <UserX className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No agents found matching your search</p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <motion.div
              layout
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-white rounded-[2.5rem] border border-slate-200 p-6 hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-white shadow-inner overflow-hidden group-hover:scale-110 transition-transform duration-500">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.username}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{agent.name}</h3>
                    <p className="text-sm text-slate-400 font-medium">@{agent.username}</p>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === agent.id ? null : agent.id);
                    }}
                    className={cn(
                      "p-2 hover:bg-slate-100 rounded-xl transition-colors",
                      activeMenu === agent.id ? "bg-slate-100 text-black" : "text-slate-400"
                    )}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  
                  <AnimatePresence>
                    {activeMenu === agent.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-20 overflow-hidden"
                        >
                          <button
                            onClick={() => { setEditingAgent(agent); setActiveMenu(null); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                            Edit Persona
                          </button>
                          {!agent.is_approved && (
                            <button
                              onClick={() => { handleApproveAgent(agent.id); setActiveMenu(null); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </button>
                          )}
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            onClick={() => { setDeletingAgent(agent); setActiveMenu(null); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Persona Info */}
              <div className="space-y-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {!agent.is_approved && (
                    <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                      Pending Approval
                    </Badge>
                  )}
                  <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                    {agent.tone_style}
                  </Badge>
                  <Badge variant={agent.role === 'admin' ? 'warning' : 'default'} className="px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                    {agent.role}
                  </Badge>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Smile className="w-3 h-3" />
                    Characteristic Preview
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                    {agent.personality_instructions || "No personality instructions set yet..."}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      {(agent.training_notes?.split('\n').filter(l => l.trim()).length || 0)} Snippets
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-bold capitalize">{agent.status}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-bold">{agent.active_tickets || 0} Load</span>
                  </div>
                </div>
              </div>

              {/* Toggles or Approval Actions */}
              {!agent.is_approved ? (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 relative z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleApproveAgent(agent.id); }}
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all font-bold text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeletingAgent(agent); }}
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all font-bold text-xs"
                  >
                    <XIcon className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 relative z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(agent); }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-95",
                      agent.status === 'online' 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                        : "bg-slate-50 border-slate-100 text-slate-500"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full mb-1", agent.status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300")} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Status</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleMirroring(agent); }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-95",
                      agent.ai_mirroring_enabled 
                        ? "bg-violet-50 border-violet-100 text-violet-700" 
                        : "bg-slate-50 border-slate-100 text-slate-500"
                    )}
                  >
                    <Zap className={cn("w-4 h-4 mb-0.5", agent.ai_mirroring_enabled ? "text-violet-600 fill-violet-600" : "text-slate-300")} />
                    <span className="text-[10px] font-black uppercase tracking-wider">AI Mirror</span>
                  </button>
                </div>
              )}

              {/* Edit Overlay on Hover */}
              <div 
                onClick={() => setEditingAgent(agent)}
                className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] cursor-pointer transition-colors z-0" 
              />
            </motion.div>
          ))
        )}
      </div>

      {editingAgent && (
        <EditAgentModal 
          agent={editingAgent}
          isOpen={!!editingAgent}
          isNew={false}
          onClose={() => setEditingAgent(null)}
          onSave={handleSaveAgent}
        />
      )}

      {isCreating && (
        <EditAgentModal 
          agent={{
            name: '',
            username: '',
            role: 'agent',
            tone_style: 'friendly',
            emoji_level: 'medium',
            ai_mirroring_enabled: true,
            response_style_rules: {
              useStructuredReplies: true,
              useShortSentences: false,
              addEmojisAutomatically: true,
              formalLanguageMode: false
            }
          } as any}
          isOpen={isCreating}
          isNew={true}
          onClose={() => setIsCreating(false)}
          onSave={handleSaveAgent}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingAgent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDeletingAgent(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-8">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {deletingAgent.is_approved ? 'Delete Agent?' : 'Reject Agent?'}
                </h3>
                <p className="text-slate-500 mb-8">
                  Are you sure you want to {deletingAgent.is_approved ? 'delete' : 'reject'} <span className="font-bold text-slate-900">{deletingAgent.name}</span>? 
                  This action cannot be undone and they will lose all access.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingAgent(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(deletingAgent.id)}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    {deletingAgent.is_approved ? 'Delete Agent' : 'Reject Agent'}
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
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px]",
              toast.type === 'success' 
                ? "bg-emerald-900 border-emerald-800 text-emerald-50" 
                : "bg-red-900 border-red-800 text-red-50"
            )}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span className="text-sm font-semibold flex-1">{toast.message}</span>
              <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <XIcon className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}  
