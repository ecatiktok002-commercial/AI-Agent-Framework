import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { CheckCircle2, Clock, Terminal, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '../components/Badge';
import { GenericLead } from '../types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<GenericLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    console.log("Fetching leads...");
    const { data, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error("Error fetching leads:", fetchError);
      setError(fetchError.message);
    } else {
      setLeads(data || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();

    const sub = supabase.channel('leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const toggleStatus = async (lead: GenericLead) => {
    const newStatus = lead.status === 'New' ? 'Done' : 'New';
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', lead.id);

    if (updateError) {
      console.error("Error updating status:", updateError);
      alert("Failed to update status: " + updateError.message);
    } else {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
      
      if (lead.ticket_id) {
         await supabase
          .from('tickets')
          .update({ tag: newStatus === 'Done' ? 'Done' : 'Lead Pending' })
          .eq('id', lead.ticket_id);
      }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Captured Leads</h1>
          <p className="text-sm md:text-base text-slate-500">View and manage information captured dynamically by your AI agents.</p>
        </div>
        <button 
          onClick={fetchLeads}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full overflow-x-auto">
        <div className="min-w-[800px]">
          <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Extracted Data</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{lead.customer_phone}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Date: {new Date(lead.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                     {lead.lead_type || 'General'}
                   </span>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {lead.data && Object.entries(lead.data).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="font-semibold text-slate-700 capitalize">{key.replace(/_/g, ' ')}:</span> 
                        <span className="text-slate-600 ml-2">{String(value)}</span>
                      </div>
                    ))}
                    {(!lead.data || Object.keys(lead.data).length === 0) && (
                      <span className="text-slate-400 text-xs italic">No data captured</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={lead.status === 'Done' ? 'success' : lead.status === 'New' ? 'warning' : 'primary'}>
                    {lead.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(lead)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      lead.status === 'New' 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {lead.status === 'New' ? (
                      <><CheckCircle2 className="w-4 h-4" /> Mark Done</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Reset</>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No leads captured yet. Setup your AI prompt to use the capture_customer_lead tool!
                </td>
              </tr>
            )}
            {loading && leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Loading leads...</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
