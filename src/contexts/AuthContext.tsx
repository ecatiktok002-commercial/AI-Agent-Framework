import React, { createContext, useContext, useState } from 'react';
import { Agent } from '../types';

interface AuthContextType {
  agent: Agent | null;
  login: (agent: Agent) => void;
  logout: () => void;
  updateAgent: (updates: Partial<Agent>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agent, setAgent] = useState<Agent | null>(() => {
    const stored = localStorage.getItem('agent_session');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (agentData: Agent) => {
    setAgent(agentData);
    localStorage.setItem('agent_session', JSON.stringify(agentData));
  };

  const logout = () => {
    setAgent(null);
    localStorage.removeItem('agent_session');
  };

  const updateAgent = (updates: Partial<Agent>) => {
    setAgent(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem('agent_session', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ agent, login, logout, updateAgent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
