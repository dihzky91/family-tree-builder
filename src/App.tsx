import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const OnThisDayPage = lazy(() => import("./pages/OnThisDayPage"));
const RelationshipCheckPage = lazy(() => import("./pages/RelationshipCheckPage"));
const DataQualityPage = lazy(() => import("./pages/DataQualityPage"));
const StoriesPage = lazy(() => import("./pages/StoriesPage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const ChartPage = lazy(() => import("./pages/ChartPage"));
const EvidencePage = lazy(() => import("./pages/EvidencePage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DuplicatesPage = lazy(() => import("./pages/DuplicatesPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicSubmitPage = lazy(() => import("./pages/PublicSubmitPage"));
const BranchManagementPage = lazy(() => import("./pages/BranchManagementPage"));
const SubmissionReviewPage = lazy(() => import("./pages/SubmissionReviewPage"));
const BirthdayCalendar = lazy(() => import("./pages/BirthdayCalendar"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex h-full min-h-[40vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="h-full"
  >
    <Suspense fallback={<RouteFallback />}>{children}</Suspense>
  </motion.div>
);

const DashboardRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
        <Route path="/on-this-day" element={<PageTransition><OnThisDayPage /></PageTransition>} />
        <Route path="/calendar" element={<PageTransition><BirthdayCalendar /></PageTransition>} />
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
          <Route path="/auth" element={<Suspense fallback={<RouteFallback />}><AuthPage /></Suspense>} />
          <Route path="/submit/:branchCode" element={<Suspense fallback={<RouteFallback />}><PublicSubmitPage /></Suspense>} />
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
