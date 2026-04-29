import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import TicketsPage from './pages/TicketsPage';
import AgentsPage from './pages/AgentsPage';
import KnowledgeBase from './pages/KnowledgeBase';
import BookingsPage from './pages/BookingsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Layout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="bookings" element={<BookingsPage />} />
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
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<div className="p-8">Page not found</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
