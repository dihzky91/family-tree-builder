import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import DashboardPage from "./pages/DashboardPage";
import OnThisDayPage from "./pages/OnThisDayPage";
import RelationshipCheckPage from "./pages/RelationshipCheckPage";
import DataQualityPage from "./pages/DataQualityPage";
import StoriesPage from "./pages/StoriesPage";
import GalleryPage from "./pages/GalleryPage";
import PeoplePage from "./pages/PeoplePage";
import ChartPage from "./pages/ChartPage";
import EvidencePage from "./pages/EvidencePage";
import DataPage from "./pages/DataPage";
import SettingsPage from "./pages/SettingsPage";
import DuplicatesPage from "./pages/DuplicatesPage";
import AuditLogPage from "./pages/AuditLogPage";
import StatsPage from "./pages/StatsPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import PublicSubmitPage from "./pages/PublicSubmitPage";
import BranchManagementPage from "./pages/BranchManagementPage";
import SubmissionReviewPage from "./pages/SubmissionReviewPage";

const queryClient = new QueryClient();

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="h-full"
  >
    {children}
  </motion.div>
);

const DashboardRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
        <Route path="/on-this-day" element={<PageTransition><OnThisDayPage /></PageTransition>} />
        <Route path="/relationship-check" element={<PageTransition><RelationshipCheckPage /></PageTransition>} />
        <Route path="/stories" element={<PageTransition><StoriesPage /></PageTransition>} />
        <Route path="/data-quality" element={<PageTransition><DataQualityPage /></PageTransition>} />
        <Route path="/gallery" element={<PageTransition><GalleryPage /></PageTransition>} />
        <Route path="/people" element={<PageTransition><PeoplePage /></PageTransition>} />
        <Route path="/chart" element={<PageTransition><ChartPage /></PageTransition>} />
        <Route path="/evidence" element={<PageTransition><EvidencePage /></PageTransition>} />
        <Route path="/duplicates" element={<PageTransition><DuplicatesPage /></PageTransition>} />
        <Route path="/audit" element={<PageTransition><AuditLogPage /></PageTransition>} />
        <Route path="/stats" element={<PageTransition><StatsPage /></PageTransition>} />
        <Route path="/branches" element={<PageTransition><BranchManagementPage /></PageTransition>} />
        <Route path="/submissions" element={<PageTransition><SubmissionReviewPage /></PageTransition>} />
        <Route path="/data" element={<PageTransition><DataPage /></PageTransition>} />
        <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
        <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes (no auth) */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/submit/:branchCode" element={<PublicSubmitPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppLayout>
                  <DashboardRoutes />
                </AppLayout>
              </AuthGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
