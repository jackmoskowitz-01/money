import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Dashboard from "./pages/Dashboard";
import MapView from "./pages/MapView";
import TenantDetail from "./pages/TenantDetail";
import CustomProspectDetail from "./pages/CustomProspectDetail";
import ScoopBoard from "./pages/ScoopBoard";
import Pipeline from "./pages/Pipeline";


import Tasks from "./pages/Tasks";
import Prospects from "./pages/Prospects";
import ActivityLogger from "./pages/ActivityLogger";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/building/:buildingId/tenant/:tenantId" element={<TenantDetail />} />
          <Route path="/scoop" element={<ScoopBoard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          
          
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/prospects" element={<Prospects />} />
          <Route path="/activities" element={<ActivityLogger />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
