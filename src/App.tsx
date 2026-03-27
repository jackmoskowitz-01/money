import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar, SidebarTrigger } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import DealCopilot from "@/components/DealCopilot";
import { CommandPalette } from "@/components/CommandPalette";
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
import Analytics from "./pages/Analytics";
import EmailAnalytics from "./pages/EmailAnalytics";
import ProspectTable from "./pages/ProspectTable";
import LeaseAbstracts from "./pages/LeaseAbstracts";
import Landing from "./pages/Landing";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminUsers from "./pages/admin/AdminUsers";
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
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-10 items-center gap-3 border-b border-border/40 bg-background/95 backdrop-blur-sm px-3">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search companies, prospects..."
              className="h-7 pl-8 text-xs bg-secondary/40 border-transparent focus:border-border"
              onFocus={(e) => {
                e.target.blur();
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
            />
          </div>
        </header>
        <DealCopilot />
        <CommandPalette />
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
          <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
          <Route path="/email-analytics" element={<ErrorBoundary><EmailAnalytics /></ErrorBoundary>} />
          <Route path="/prospect-table" element={<ErrorBoundary><ProspectTable /></ErrorBoundary>} />
          <Route path="/lease-abstracts" element={<ErrorBoundary><LeaseAbstracts /></ErrorBoundary>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
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
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="organizations" element={<AdminOrganizations />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>
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
