import React from 'react';
import { cn } from '../utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'ai';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    error: 'bg-red-50 text-red-700 border-red-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    ai: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
