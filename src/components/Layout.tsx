import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, MessageSquare, AlertTriangle } from 'lucide-react';
import { useDashboardSettings } from '../hooks/useDashboardSettings';
import { isSupabaseConfigured } from '../supabase';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logoUrl } = useDashboardSettings();

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      {!isSupabaseConfigured && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-500 text-white p-3 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Environment variables missing! Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your AI Studio application settings.</span>
        </div>
      )}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="w-8 h-8 shrink-0 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <span className="font-bold text-lg tracking-tight text-slate-800">Waki Sales Dashboard</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;  
