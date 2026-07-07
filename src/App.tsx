import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ReferralGate from "@/components/ReferralGate";

// Direct imports for instant loading
import Index from "./pages/Index";
import SearchResults from "./pages/SearchResults";
import NotFound from "./pages/NotFound";
import Policies from "./pages/Policies";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Feedback from "./pages/Feedback";
import Auth from "./pages/Auth";
import Referral from "./pages/Referral";
import AdminDashboard from "./pages/AdminDashboard";
import TrendingContent from "./pages/TrendingContent";
import Waitlist from "./pages/Waitlist";
import Premium from "./pages/Premium";
import BusinessDashboard from "./pages/BusinessDashboard";
import SharedSearch from "./pages/SharedSearch";
import KnowledgeVault from "./pages/KnowledgeVault";
import POIPointsDashboard from "./pages/POIPointsDashboard";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import AcquisitionControl from "./pages/AcquisitionControl";
import Pricing from "./pages/Pricing";
import Insights from "./pages/Insights";
import DealRoom from "./pages/DealRoom";
import DealRoomAdmin from "./pages/DealRoomAdmin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/acquisition-control" element={<AcquisitionControl />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/trending/:slug" element={<TrendingContent />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/business" element={<BusinessDashboard />} />
            <Route path="/shared/:slug" element={<SharedSearch />} />
            <Route path="/vaults/:slug" element={<KnowledgeVault />} />
            <Route path="/points" element={<ReferralGate><POIPointsDashboard /></ReferralGate>} />
            <Route path="/developer" element={<ReferralGate><DeveloperDashboard /></ReferralGate>} />

            {/* Protected routes */}
            <Route path="/" element={<ReferralGate><Index /></ReferralGate>} />
            <Route path="/search" element={<ReferralGate><SearchResults /></ReferralGate>} />
            <Route path="/about" element={<ReferralGate><About /></ReferralGate>} />
            <Route path="/contact" element={<ReferralGate><Contact /></ReferralGate>} />
            <Route path="/feedback" element={<ReferralGate><Feedback /></ReferralGate>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
