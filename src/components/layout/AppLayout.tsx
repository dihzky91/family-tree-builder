import { useState, useEffect, ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { MobileBottomNav } from './MobileBottomNav';
import { Breadcrumbs } from './Breadcrumbs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFamilyStore } from '@/store/familyStore';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loadData, isLoading } = useFamilyStore();
  const [initialized, setInitialized] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const initialize = async () => {
      await loadData();
      setInitialized(true);
    };
    initialize();
  }, [loadData]);

  if (!initialized || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat data keluarga...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background md:h-screen md:p-4 md:pt-5">
      <div className="flex h-full flex-col md:flex-row md:gap-4">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block md:shrink-0">
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Header */}
        {isMobile && <MobileNav />}

        {/* Main Content Area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-[1.75rem] md:border md:border-border/80 md:bg-card/70 md:shadow-sm md:backdrop-blur-sm">
          {/* Breadcrumbs Navigation (Desktop only) */}
          <Breadcrumbs />

          {/* Main Content */}
          <main
            id="app-main-scroll"
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          >
            <div className="md:px-1 md:pb-1">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNav />}
      </div>
    </div>
  );
}
