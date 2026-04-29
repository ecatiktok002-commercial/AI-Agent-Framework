import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, MessageSquare } from 'lucide-react';
import { useDashboardSettings } from '../hooks/useDashboardSettings';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logoUrl } = useDashboardSettings();

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
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
