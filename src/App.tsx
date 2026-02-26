import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { MonthProvider } from "./contexts/MonthContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import TeamPerformance from "./pages/TeamPerformance";
import Wallet from "./pages/Wallet";
import Members from "./pages/Members";
import Earnings from "./pages/Earnings";
import Salary from "./pages/Salary";
import PersonDetail from "./pages/PersonDetail";
import AdminPanel from "./pages/AdminPanel";
import SettingsPage from "./pages/SettingsPage";
import SettlementTracker from "./pages/SettlementTracker";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function RequireAuth() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile && !profile.is_active) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

function RequireAuthOnly() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <MonthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Auth required but no password-change check */}
              <Route element={<RequireAuthOnly />}>
                <Route path="/change-password" element={<ChangePassword />} />
              </Route>

              {/* Fully protected routes */}
              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Overview />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/team/:teamId" element={<TeamDetail />} />
                  <Route path="/team-performance/:teamId" element={<TeamPerformance />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/earnings" element={<Earnings />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/salary" element={<Salary />} />
                  <Route path="/person/:personName" element={<PersonDetail />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/settlements" element={<SettlementTracker />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </MonthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
