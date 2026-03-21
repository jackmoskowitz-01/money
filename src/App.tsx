import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import DealCopilot from "@/components/DealCopilot";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import MapView from "./pages/MapView";
import TenantDetail from "./pages/TenantDetail";
import CustomProspectDetail from "./pages/CustomProspectDetail";
import ScoopBoard from "./pages/ScoopBoard";
import Pipeline from "./pages/Pipeline";
import News from "./pages/News";
import Tasks from "./pages/Tasks";
import Prospects from "./pages/Prospects";
import ActivityLogger from "./pages/ActivityLogger";
import Settings from "./pages/Settings";
import LoopNetSearch from "./pages/LoopNetSearch";
import LoopNetDetail from "./pages/LoopNetDetail";
import EmailAnalytics from "./pages/EmailAnalytics";
import ProspectTable from "./pages/ProspectTable";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <Navbar />
      <DealCopilot />
      <Routes>
        <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/map" element={<ErrorBoundary><MapView /></ErrorBoundary>} />
        <Route path="/news" element={<ErrorBoundary><News /></ErrorBoundary>} />
        <Route path="/building/:buildingId/tenant/:tenantId" element={<ErrorBoundary><TenantDetail /></ErrorBoundary>} />
        <Route path="/prospect/:prospectId" element={<ErrorBoundary><CustomProspectDetail /></ErrorBoundary>} />
        <Route path="/scoop" element={<ErrorBoundary><ScoopBoard /></ErrorBoundary>} />
        <Route path="/pipeline" element={<ErrorBoundary><Pipeline /></ErrorBoundary>} />
        <Route path="/tasks" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
        <Route path="/prospects" element={<ErrorBoundary><Prospects /></ErrorBoundary>} />
        <Route path="/activities" element={<ErrorBoundary><ActivityLogger /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="/loopnet" element={<ErrorBoundary><LoopNetSearch /></ErrorBoundary>} />
        <Route path="/loopnet/detail" element={<ErrorBoundary><LoopNetDetail /></ErrorBoundary>} />
        <Route path="/email-analytics" element={<ErrorBoundary><EmailAnalytics /></ErrorBoundary>} />
        <Route path="/prospect-table" element={<ErrorBoundary><ProspectTable /></ErrorBoundary>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
