import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Route, 
  BookOpen,
  BarChart3, 
  FileText,
  LogOut,
  UserCircle,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '../utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { agent, logout, updateAgent } = useAuth();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const isAdmin = agent?.role === 'admin'; 

  const navItems = [
    { 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      path: isAdmin ? '/admin/dashboard' : '/agent/dashboard',
      show: true 
    },
    { 
      label: 'Tickets', 
      icon: MessageSquare, 
      path: isAdmin ? '/admin/tickets' : '/agent/inbox',
      show: true 
    },
    { 
      label: 'Agents', 
      icon: Users, 
      path: '/admin/agents',
      show: isAdmin 
    },
    { 
      label: 'Knowledge Base', 
      icon: BookOpen, 
      path: '/admin/knowledge-base',
      show: isAdmin 
    },
    { 
      label: 'Bookings', 
      icon: FileText, 
      path: '/admin/bookings',
      show: isAdmin 
    },
    { 
      label: 'Analytics', 
      icon: BarChart3, 
      path: '/admin/analytics',
      show: isAdmin 
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleStatus = async () => {
    if (!agent) return;
    setIsUpdatingStatus(true);
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    
    try {
      const { error } = await supabase
        .from('agents')
        .update({ status: newStatus })
        .eq('id', agent.id);
        
      if (error) throw error;
      
      updateAgent({ status: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsOpen?.(false)}
        />
      )}
      <aside className={cn(
        "w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed md:sticky top-0 z-50 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://tnvhriiyuzjhtdqfufmh.supabase.co/storage/v1/object/public/public-assets/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-xl tracking-tight">HelpDesk</span>
          </div>
          <button 
            className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setIsOpen?.(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.filter(item => item.show).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen?.(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                isActive 
                  ? "bg-slate-100 text-black" 
                  : "text-slate-500 hover:text-black hover:bg-slate-50"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-black" : "text-slate-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent?.username}`} 
              alt="Avatar" 
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{agent?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{agent?.role}</p>
          </div>
        </div>
        
        {agent && (
          <div className="px-3 py-2 flex items-center justify-between bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", agent.status === 'online' ? "bg-emerald-500" : "bg-slate-300")} />
              <span className="text-xs font-medium text-slate-700">
                {agent.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
            <button 
              onClick={toggleStatus}
              disabled={isUpdatingStatus}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2",
                agent.status === 'online' ? "bg-emerald-500" : "bg-slate-300",
                isUpdatingStatus && "opacity-50 cursor-not-allowed"
              )}
            >
              <span 
                className={cn(
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  agent.status === 'online' ? "translate-x-5" : "translate-x-1"
                )} 
              />
            </button>
          </div>
        )}
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
      </aside>
    </>
  );
};
