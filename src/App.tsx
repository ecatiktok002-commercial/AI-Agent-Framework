import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import TicketsPage from './pages/TicketsPage';
import LeadsPage from './pages/LeadsPage';
import IdentityPage from './pages/settings/IdentityPage';
import KnowledgeBasePage from './pages/settings/KnowledgeBasePage';
import PromptRulesPage from './pages/settings/PromptRulesPage';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Layout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="leads" element={<LeadsPage />} />
              
              {/* Settings Sub-routes */}
              <Route path="settings">
                <Route path="identity" element={<IdentityPage />} />
                <Route path="knowledge" element={<KnowledgeBasePage />} />
                <Route path="prompts" element={<PromptRulesPage />} />
              </Route>

              <Route path="analytics" element={<div className="p-8">Analytics Coming Soon</div>} />
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Route>

          {/* Agent Routes */}
          <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
            <Route path="/agent" element={<Layout />}>
              <Route path="dashboard" element={<AdminDashboard />} /> {/* Reusing dashboard for now */}
              <Route path="inbox" element={<TicketsPage />} />
              <Route index element={<Navigate to="/agent/dashboard" replace />} />
            </Route>
          </Route>

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<div className="p-8">Page not found</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
