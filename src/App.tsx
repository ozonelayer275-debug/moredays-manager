import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import StudentDetailPage from "./pages/StudentDetailPage";
import SalesPage from "./pages/SalesPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReportsPage from "./pages/ReportsPage";

function SetupScreen() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 mb-4">
        <span className="text-white text-2xl font-bold">M</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Supabase not configured</h1>
      <p className="text-gray-500 text-sm max-w-xs mb-4">
        Open <code className="bg-gray-100 px-1 rounded">.env.local</code> and fill in your
        Supabase URL and anon key, then restart the dev server.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-left text-xs font-mono text-gray-600 w-full max-w-sm">
        <p>VITE_SUPABASE_URL=https://xxxx.supabase.co</p>
        <p>VITE_SUPABASE_ANON_KEY=eyJ...</p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/students/:id" element={<StudentDetailPage />} />
      <Route path="/sales" element={<SalesPage />} />
      <Route path="/expenses" element={<ExpensesPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PublicRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<PublicRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
