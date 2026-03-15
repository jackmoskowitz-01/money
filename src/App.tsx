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
import NotFound from "./pages/NotFound";
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/news" element={<News />} />
        <Route path="/building/:buildingId/tenant/:tenantId" element={<TenantDetail />} />
        <Route path="/prospect/:prospectId" element={<CustomProspectDetail />} />
        <Route path="/scoop" element={<ScoopBoard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/prospects" element={<Prospects />} />
        <Route path="/activities" element={<ActivityLogger />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/loopnet" element={<LoopNetSearch />} />
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
