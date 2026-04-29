import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search,
  Edit2,
  Trash2,
  Save,
  X as XIcon,
  CheckCircle2,
  AlertCircle,
  Filter,
  Bot,
  Zap,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { supabase } from '../supabase';
import { KnowledgeFact } from '../types';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export default function KnowledgeBase() {
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<KnowledgeFact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isSavingKeywords, setIsSavingKeywords] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    topic: '',
    fact: '',
    is_active: true
  });

  useEffect(() => {
    fetchFacts();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data: promptData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_system_prompt')
      .single();
    
    if (promptData) setSystemPrompt(promptData.value);

    const { data: keywordsData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_handoff_keywords')
      .single();
    
    if (keywordsData) setHandoffKeywords(keywordsData.value);
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'ai_system_prompt', value: systemPrompt }, { onConflict: 'key' });

      if (error) throw error;
      showToast('AI System Prompt updated');
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      showToast('Failed to save prompt', 'error');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSaveKeywords = async () => {
    setIsSavingKeywords(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'ai_handoff_keywords', value: handoffKeywords }, { onConflict: 'key' });

      if (error) throw error;
      showToast('Handoff keywords updated');
    } catch (error: any) {
      console.error('Error saving keywords:', error);
      showToast('Failed to save keywords', 'error');
    } finally {
      setIsSavingKeywords(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFacts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase
      .from('company_knowledge')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching facts:', error);
      showToast('Failed to load knowledge base', 'error');
    } else {
      setFacts(data || []);
    }
    if (showLoading) setLoading(false);
  };

  const handleOpenModal = (fact?: KnowledgeFact) => {
    if (fact) {
      setEditingFact(fact);
      setFormData({
        category: fact.category,
        topic: fact.topic,
        fact: fact.fact,
        is_active: fact.is_active
      });
    } else {
      setEditingFact(null);
      setFormData({
        category: '',
        topic: '',
        fact: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.category || !formData.topic || !formData.fact) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingFact) {
        const { error } = await supabase
          .from('company_knowledge')
          .update({
            category: formData.category,
            topic: formData.topic,
            fact: formData.fact,
            is_active: formData.is_active
          })
          .eq('id', editingFact.id);

        if (error) throw error;
        showToast('Fact updated successfully');
      } else {
        const { error } = await supabase
          .from('company_knowledge')
          .insert([formData]);

        if (error) throw error;
        showToast('New fact added successfully');
      }
      setIsModalOpen(false);
      fetchFacts(false);
    } catch (error: any) {
      console.error('Error saving fact:', error);
      showToast('Failed to save fact', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('company_knowledge')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;
      showToast('Fact deleted successfully');
      fetchFacts(false);
    } catch (error: any) {
      console.error('Error deleting fact:', error);
      showToast('Failed to delete fact', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const categories = ['All', ...Array.from(new Set(facts.map(f => f.category)))];

  const filteredFacts = facts.filter(f => {
    const matchesSearch = f.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.fact && f.fact.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            AI Knowledge & Persona
            <Badge variant="ai">RAG</Badge>
          </h1>
          <p className="text-slate-500">Manage facts and the AI persona that guides customer interactions.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-md self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Fact
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search knowledge base..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Category Tabs */}
            {categories.length > 1 && (
              <div className="px-6 py-4 border-b border-slate-100 flex overflow-x-auto gap-2 no-scrollbar">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                      selectedCategory === category
                        ? "bg-black text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Topic</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fact</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">Loading facts...</td>
                    </tr>
                  ) : filteredFacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">No facts found</td>
                    </tr>
                  ) : (
                    filteredFacts.map((fact) => (
                      <tr key={fact.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <Badge variant="info">{fact.category}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-900">{fact.topic}</span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <p className="text-sm text-slate-600 line-clamp-2">{fact.fact}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={fact.is_active ? 'success' : 'secondary'}>
                            {fact.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenModal(fact)}
                              className="p-2 text-slate-400 hover:text-black hover:bg-white rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(fact.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Configuration Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-xl">
                <Bot className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="font-bold text-slate-900">AI Persona</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Prompt</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[160px] resize-none"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter system instructions for the AI..."
                />
                <p className="text-[10px] text-slate-400 mt-1">This prompt guides how Gemini responds to customers using the facts on the left.</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700">Quick Reply</span>
                </div>
                <div className="w-8 h-4 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                </div>
              </div>
              <button 
                onClick={handleSavePrompt}
                disabled={isSavingPrompt}
                className={cn(
                  "w-full py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg",
                  isSavingPrompt && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSavingPrompt ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Persona
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900">Handoff Triggers</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keywords</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[100px] resize-none"
                  value={handoffKeywords}
                  onChange={(e) => setHandoffKeywords(e.target.value)}
                  placeholder="human, agent, person, speak to someone..."
                />
                <p className="text-[10px] text-slate-400 mt-1">Comma-separated keywords that trigger a handoff to a human agent.</p>
              </div>
              <button 
                onClick={handleSaveKeywords}
                disabled={isSavingKeywords}
                className={cn(
                  "w-full py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg",
                  isSavingKeywords && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSavingKeywords ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Keywords
              </button>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white space-y-4">
            <h4 className="font-bold text-sm">How it works</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              The AI uses the **Knowledge Base** facts on the left as its source of truth, 
              and follows the **System Prompt** above to determine its tone and personality.
            </p>
            <div className="pt-2 border-t border-white/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Current Strategy</p>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Round Robin Assignment
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingFact ? 'Edit Fact' : 'Add New Fact'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="e.g. Pricing, Policy"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black pr-10"
                        value={formData.category}
                        onChange={(e) => {
                          setFormData({ ...formData, category: e.target.value });
                          setIsCategoryDropdownOpen(true);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsCategoryDropdownOpen(false), 200)}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    
                    {isCategoryDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {(Array.from(new Set(facts.map(f => f.category))) as string[])
                          .filter(Boolean)
                          .filter(cat => cat.toLowerCase().includes(formData.category.toLowerCase()))
                          .map(cat => (
                            <button
                              key={cat}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-black transition-colors"
                              onClick={() => {
                                setFormData({ ...formData, category: cat });
                                setIsCategoryDropdownOpen(false);
                              }}
                            >
                              {cat}
                            </button>
                        ))}
                        {formData.category && !(Array.from(new Set(facts.map(f => f.category))) as string[]).some(cat => cat.toLowerCase() === formData.category.toLowerCase()) && (
                          <div className="px-4 py-2 text-sm text-slate-500 italic border-t border-slate-100 bg-slate-50/50">
                            Create new category: "{formData.category}"
                          </div>
                        )}
                        {Array.from(new Set(facts.map(f => f.category))).filter(Boolean).length === 0 && !formData.category && (
                          <div className="px-4 py-2 text-sm text-slate-500 italic">
                            Type to create a category
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Topic</label>
                    <input 
                      type="text"
                      placeholder="e.g. Daily Rate"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fact / Information</label>
                  <textarea 
                    placeholder="Enter the factual information here..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[150px] resize-none"
                    value={formData.fact}
                    onChange={(e) => setFormData({ ...formData, fact: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      formData.is_active ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                    )}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Active Status</p>
                      <p className="text-xs text-slate-500">Enable this fact for AI usage</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      formData.is_active ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.is_active ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "flex-1 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingFact ? 'Update Fact' : 'Add Fact'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Delete Fact</h3>
                <p className="text-sm text-slate-500">
                  Are you sure you want to delete this fact? This action cannot be undone and the AI will no longer use this information.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className={cn(
                    "flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg",
                    isDeleting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Fact
                </button>
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
