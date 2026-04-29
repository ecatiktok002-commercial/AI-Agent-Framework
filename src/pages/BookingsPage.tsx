import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { CheckCircle2, Clock, Calendar, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BookingLead } from '../types';

export default function BookingsPage() {
  const [leads, setLeads] = useState<BookingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    console.log("Fetching booking leads...");
    const { data, error: fetchError } = await supabase
      .from('booking_leads')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_leads' }, fetchLeads)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const toggleStatus = async (lead: BookingLead) => {
    const newStatus = lead.status === 'Pending' ? 'Done' : 'Pending';
    const { error: updateError } = await supabase
      .from('booking_leads')
      .update({ status: newStatus })
      .eq('id', lead.id);

    if (updateError) {
      console.error("Error updating status:", updateError);
      alert("Failed to update status: " + updateError.message);
    } else {
      // Optimitistically update locally
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
      
      // Update ticket tag to Done or Booking Pending so UI reflects the state
      if (lead.ticket_id) {
         await supabase
          .from('tickets')
          .update({ tag: newStatus === 'Done' ? 'Done' : 'Booking Pending' })
          .eq('id', lead.ticket_id);
      }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Admin Bookings Dashboard</h1>
          <p className="text-sm md:text-base text-slate-500">Manage and verify customer car rental bookings.</p>
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
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking Info</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Documents</th>
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
                      <p className="text-[10px] text-slate-400 font-mono">ID: {lead.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Vehicle: {lead.vehicle_model}</p>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" /> Pickup: {lead.pickup_date} @ {lead.pickup_time}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" /> Price: {lead.price} for {lead.duration}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {lead.ic_url ? (
                      <a href={lead.ic_url} target="_blank" rel="noreferrer" className="group relative">
                        <img src={lead.ic_url} alt="IC" className="w-10 h-10 rounded border border-slate-200 object-cover hover:scale-110 transition-transform" />
                        <span className="absolute -top-8 left-0 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded">IC</span>
                      </a>
                    ) : <div className="w-10 h-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-300">No IC</div>}
                    
                    {lead.license_url ? (
                      <a href={lead.license_url} target="_blank" rel="noreferrer" className="group relative">
                        <img src={lead.license_url} alt="License" className="w-10 h-10 rounded border border-slate-200 object-cover hover:scale-110 transition-transform" />
                        <span className="absolute -top-8 left-0 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded">Lic</span>
                      </a>
                    ) : <div className="w-10 h-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-300">No Lic</div>}
                    
                    {lead.receipt_url ? (
                      <a href={lead.receipt_url} target="_blank" rel="noreferrer" className="group relative">
                        <img src={lead.receipt_url} alt="Receipt" className="w-10 h-10 rounded border border-slate-200 object-cover hover:scale-110 transition-transform" />
                        <span className="absolute -top-8 left-0 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded">Pay</span>
                      </a>
                    ) : <div className="w-10 h-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-300">No Pay</div>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={lead.status === 'Done' ? 'success' : 'warning'}>
                    {lead.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(lead)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      lead.status === 'Pending' 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    }`}
                  >
                    {lead.status === 'Pending' ? (
                      <><CheckCircle2 className="w-4 h-4" /> Mark as Done</>
                    ) : (
                      <><Clock className="w-4 h-4" /> Revert to Pending</>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No bookings found in the database.
                </td>
              </tr>
            )}
            {loading && leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Loading bookings...</span>
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
