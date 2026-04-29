import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  ArrowUpRight,
  MoreHorizontal,
  BookOpen,
  Database,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Car,
  FileCheck
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { cn } from '../utils';
import { supabase } from '../supabase';
import { Ticket, BookingLead } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
  const { agent } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    totalLeadsMonth: 0,
    pendingRevenue: 0,
    aiResolutionRate: 0,
  });
  
  const [popularModels, setPopularModels] = useState<{ model: string; count: number }[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<BookingLead[]>([]);
  const [humanEscalations, setHumanEscalations] = useState<Ticket[]>([]);
  const [pendingKnowledgeCount, setPendingKnowledgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTestingBridge, setIsTestingBridge] = useState(false);

  const checkDatabaseBridge = async () => {
    setIsTestingBridge(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-agent-core', {
        body: { action: 'test-bridge' }
      });

      if (error) throw error;

      if (data && data.success) {
        alert(`✅ Bridge Connected Successfully!\nUser: ${data.data[0].connected_user}\nTime: ${data.data[0].current_time}`);
        console.log("Bridge Data:", data);
      } else {
        alert(`❌ Bridge Failed: ${data?.error || 'Unknown error'}\nDetails: ${data?.details || ''}`);
      }
    } catch (err: any) {
      alert(`❌ Error testing bridge: ${err.message}`);
      console.error(err);
    } finally {
      setIsTestingBridge(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 1. Fetch leads for this month & Revenue
      const { data: monthLeads } = await supabase
        .from('leads')
        .select('*')
        .gte('created_at', startOfMonth);

      let revenue = 0;
      const modelCounts: Record<string, number> = {};

      monthLeads?.forEach(lead => {
        if (lead.status === 'New' && lead.data?.price) {
          // extract digits from price if it exists
          const numbers = String(lead.data.price).match(/\d+/g);
          if (numbers && numbers.length > 0) {
            revenue += parseInt(numbers[0], 10);
          }
        }
        const model = lead.lead_type || 'Unknown';
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      });

      const popularModelsArray = Object.entries(modelCounts)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
        
      setPopularModels(popularModelsArray);

      // 2. AI Resolution Rate
      const { count: totalTickets } = await supabase.from('tickets').select('*', { count: 'exact', head: true });
      const { count: aiTickets } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'ai_handling');
      const rate = totalTickets ? Math.round((aiTickets! / totalTickets) * 100) : 0;

      setMetrics({
        totalLeadsMonth: monthLeads?.length || 0,
        pendingRevenue: revenue,
        aiResolutionRate: rate
      });

      // 3. Pending Approvals Queue
      const { data: pending } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'New')
        .order('created_at', { ascending: false })
        .limit(5);
      setPendingApprovals(pending || []);

      // 4. Human Escalations Queue
      const { data: escalations } = await supabase
        .from('tickets')
        .select('*, customer:customers(*)')
        .eq('status', 'waiting_assignment')
        .eq('is_deleted', false)
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
        .limit(5);
      setHumanEscalations(escalations || []);

      // 5. Pending Knowledge Facts
      const { count: pendingKnowledge } = await supabase
        .from('company_knowledge')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false);
      setPendingKnowledgeCount(pendingKnowledge || 0);

      setLoading(false);
    };

    fetchDashboardData();

    // Real-time subscriptions for multiple tables
    const leadsSub = supabase.channel('dashboard_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDashboardData)
      .subscribe();
      
    const ticketsSub = supabase.channel('dashboard_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchDashboardData)
      .subscribe();
      
    const knowledgeSub = supabase.channel('dashboard_knowledge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_knowledge' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSub);
      supabase.removeChannel(ticketsSub);
      supabase.removeChannel(knowledgeSub);
    };
  }, []);

  const statCards = [
    { label: 'Total Leads (Month)', value: metrics.totalLeadsMonth, icon: Users, trend: 'Growth', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Revenue (Pipeline)', value: `RM ${metrics.pendingRevenue}`, icon: DollarSign, trend: 'Pipeline', color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/admin/leads' },
    { label: 'AI Resolution Rate', value: `${metrics.aiResolutionRate}%`, icon: TrendingUp, trend: 'Performance', color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading command center...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-500">Monitor sales leads, AI performance, and urgent human action items.</p>
        </div>
        <button
          onClick={checkDatabaseBridge}
          disabled={isTestingBridge}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isTestingBridge ? 'Testing Bridge...' : 'Test DB Bridge'}
          </span>
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                stat.trend === 'Pipeline' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
              )}>
                {stat.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <div className="flex items-end justify-between mt-1">
              <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
              {stat.link && (
                <Link to={stat.link} className="p-1 px-2 rounded hover:bg-slate-50 text-slate-400 hover:text-black transition-colors flex items-center">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Split View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bottom Left: Lead Growth & Performance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              Lead Growth
            </h2>
            <div className="w-full h-40 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm italic">
              [Chart Placeholder]
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-slate-400" />
              Most Common Lead Types
            </h2>
            {popularModels.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">No data available yet.</div>
            ) : (
              <div className="space-y-4">
                {popularModels.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{item.model}</span>
                    <Badge variant="info">{item.count} Requests</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Right: Action Center Widget */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Action Required
              </h2>
            </div>
            
            <div className="flex-1 divide-y divide-slate-100">
              
              {/* Section: Pending Knowledge Approval */}
              {pendingKnowledgeCount > 0 && (
                <div className="p-4 px-6 bg-amber-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Knowledge Base Approvals</p>
                      <p className="text-xs text-slate-600">The AI has {pendingKnowledgeCount} new facts waiting for your approval.</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/admin/knowledge-base')} className="px-3 py-1.5 text-xs font-bold bg-white text-amber-700 border border-amber-200 rounded-lg shadow-sm hover:bg-amber-100 transition">
                    Review
                  </button>
                </div>
              )}

              {/* Section: Human Escalations (Tickets) */}
              {humanEscalations.length > 0 && (
                <div className="p-4 px-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Human Escalations</h3>
                  <div className="space-y-3">
                    {humanEscalations.map(ticket => (
                      <div key={ticket.id} className="flex items-center justify-between bg-white hover:bg-slate-50 transition-colors p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="min-w-0 flex-1 mr-4">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {ticket.customer?.name || ticket.customer?.phone_number || 'Unknown Customer'}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-full">
                            {ticket.last_message ? ticket.last_message.replace(/\[NEEDS_AGENT\]/gi, '').trim() : 'Requested human assistance'}
                          </p>
                        </div>
                        <button 
                          onClick={() => navigate('/admin/tickets', { state: { selectedTicketId: ticket.id } })} 
                          className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-800 transition whitespace-nowrap shrink-0"
                        >
                          Take Over
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Pending Leads */}
              <div className="p-4 px-6">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Leads Captured</h3>
                   <Link to="/admin/leads" className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">View All</Link>
                 </div>
                 {pendingApprovals.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">No new leads.</div>
                 ) : (
                   <div className="space-y-3">
                     {pendingApprovals.map((lead: any) => (
                       <div key={lead.id} className="flex items-center justify-between bg-white hover:bg-slate-50 transition-colors p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div className="min-w-0 flex-1 mr-4">
                           <p className="text-sm font-semibold text-slate-900 truncate">{lead.lead_type}</p>
                           <p className="text-xs text-slate-500 truncate">{lead.customer_phone}</p>
                         </div>
                         <div className="flex items-center gap-3 shrink-0">
                           <Badge variant="warning" className="hidden sm:inline-flex">New</Badge>
                           <button 
                             onClick={() => navigate('/admin/leads')} 
                             className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-100 transition whitespace-nowrap"
                           >
                             <FileCheck className="w-3.5 h-3.5" />
                             Review
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
