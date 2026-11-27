import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  Users,
  GitBranch,
  FileText,
  Download,
  Settings,
  Search,
  TreeDeciduous,
  Copy,
  History,
  BarChart3,
  FileCheck,
  FolderTree,
  CalendarHeart,
  Network,
  Image,
  Stethoscope,
  BookOpen,
  Plus,
  X,
  Cake,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFamilyStore } from '@/store/familyStore';
import { UserMenu } from '@/components/auth/UserMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { checkDataQuality } from '@/lib/dataQuality';
import { findAllDuplicates, IGNORED_DUPLICATES_EVENT } from '@/lib/duplicateDetection';
import { usePendingSubmissionCount } from '@/hooks/usePendingSubmissionCount';

const PersonForm = lazy(() =>
  import('@/features/people/PersonForm').then((m) => ({ default: m.PersonForm }))
);

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: () => number | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const TOP_LEVEL_ROUTES = new Set(['/', '/chart', '/people', '/stories']);

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Silsilah',
  '/chart': 'Silsilah',
  '/people': 'Anggota',
  '/stories': 'Kisah Keluarga',
  '/calendar': 'Kalender',
  '/evidence': 'Dokumen',
  '/gallery': 'Galeri',
  '/stats': 'Statistik',
  '/relationship-check': 'Cek Hubungan',
  '/duplicates': 'Duplikat',
  '/data-quality': 'Kesehatan Data',
  '/branches': 'Cabang',
  '/submissions': 'Submisi',
  '/audit': 'Audit Log',
  '/data': 'Import/Export',
  '/settings': 'Pengaturan',
  '/on-this-day': 'Hari Ini',
  '/profile': 'Profil Saya',
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, persons, relationships, isDemoMode } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const isTopLevel = TOP_LEVEL_ROUTES.has(location.pathname);
  const pageTitle = ROUTE_TITLES[location.pathname] || 'Silsilah';

  const [ignoredVersion, setIgnoredVersion] = useState(0);

  useEffect(() => {
    const onIgnoredChanged = () => setIgnoredVersion((v) => v + 1);
    window.addEventListener(IGNORED_DUPLICATES_EVENT, onIgnoredChanged);
    return () => window.removeEventListener(IGNORED_DUPLICATES_EVENT, onIgnoredChanged);
  }, []);

  // Calculate badge counts lazily only when the bottom sheet menu is open
  const duplicateCount = useMemo(() => {
    if (!open) return 0;
    void ignoredVersion;
    return findAllDuplicates(persons, { relationships }).length;
  }, [open, persons, relationships, ignoredVersion]);

  const submissionCount = usePendingSubmissionCount();

  const issueCount = useMemo(() => {
    if (!open) return 0;
    const issues = checkDataQuality(persons, relationships);
    return issues.filter(i => i.type === 'error' || i.type === 'warning').length;
  }, [open, persons, relationships]);

  // Listen for openMobileNav event from MobileBottomNav
  useEffect(() => {
    const handleOpenNav = () => {
      setOpen(true);
    };

    window.addEventListener('openMobileNav', handleOpenNav);
    return () => window.removeEventListener('openMobileNav', handleOpenNav);
  }, []);

  const navGroups: NavGroup[] = [
    {
      label: 'Ringkasan',
      items: [
        { title: 'Beranda', url: '/', icon: House },
        { title: 'Hari Ini', url: '/on-this-day', icon: CalendarHeart },
        { title: 'Ulang Tahun', url: '/calendar', icon: Cake },
      ]
    },
    {
      label: 'Data & Media',
      items: [
        { title: 'Anggota', url: '/people', icon: Users },
        { title: 'Silsilah', url: '/chart', icon: GitBranch },
        { title: 'Kisah', url: '/stories', icon: BookOpen },
        { title: 'Dokumen', url: '/evidence', icon: FileText },
        { title: 'Galeri', url: '/gallery', icon: Image },
        { title: 'Statistik', url: '/stats', icon: BarChart3 },
      ]
    },
    {
      label: 'Alat & Analisis',
      items: [
        { title: 'Cek Hubungan', url: '/relationship-check', icon: Network },
        {
          title: 'Duplikat',
          url: '/duplicates',
          icon: Copy,
          badge: () => duplicateCount > 0 ? duplicateCount : null
        },
        {
          title: 'Kesehatan Data',
          url: '/data-quality',
          icon: Stethoscope,
          badge: () => issueCount > 0 ? issueCount : null
        },
      ]
    },
    {
      label: 'Pengelolaan',
      items: [
        { title: 'Cabang', url: '/branches', icon: FolderTree },
        {
          title: 'Submisi',
          url: '/submissions',
          icon: FileCheck,
          badge: () => submissionCount > 0 ? submissionCount : null
        },
        { title: 'Audit Log', url: '/audit', icon: History },
        { title: 'Import/Export', url: '/data', icon: Download },
        { title: 'Pengaturan', url: '/settings', icon: Settings },
      ]
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    setOpen(false);
    if (location.pathname !== '/people') {
      navigate('/people');
    }
  };

  const handleNavClick = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="shrink-0 z-40 w-full border-b bg-background md:hidden safe-area-pt">
        <div className="flex h-14 items-center justify-between px-3">
          {isTopLevel ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
                <TreeDeciduous className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm leading-tight truncate">
                    {pageTitle}
                  </span>
                  {isDemoMode && (
                    <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/50 text-[10px] px-1.5 py-0 h-4">
                      DEMO
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {persons.length} anggota
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Kembali"
                className="h-9 w-9 shrink-0 -ml-1"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-display font-semibold text-base truncate">
                {pageTitle}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddPersonDialog(true)}
              aria-label="Tambah anggota"
              className="h-9 w-9 rounded-full"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Bottom Sheet Menu (triggered from MobileBottomNav "Menu" tab) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85dvh] p-0 flex flex-col safe-area-pb"
          title="Menu Navigasi"
        >
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-12 rounded-full bg-muted shrink-0" />
          <SheetHeader className="px-4 pt-1 pb-2 text-left shrink-0">
            <SheetTitle className="font-display text-base">Menu & Fitur</SheetTitle>
          </SheetHeader>

          {/* Search */}
          <div className="px-4 pb-3 border-b shrink-0">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari nama anggota, tag..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="h-10 pl-9 pr-9 rounded-xl"
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSearch('');
                      setSearchQuery('');
                    }}
                    aria-label="Hapus pencarian"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Navigation Grid */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {group.label}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.url;
                    const badgeCount = item.badge ? item.badge() : null;

                    return (
                      <button
                        key={item.url}
                        onClick={() => handleNavClick(item.url)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-3 rounded-xl border text-left transition-colors active:scale-[0.98]",
                          isActive
                            ? "bg-primary/10 border-primary/30 text-primary font-medium"
                            : "bg-card/60 border-border/60 text-foreground hover:bg-accent/50"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-xs sm:text-sm truncate">{item.title}</span>
                        {badgeCount !== null && badgeCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-destructive/15 text-destructive shrink-0"
                          >
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Add Person Dialog */}
      {showAddPersonDialog && (
        <Dialog open={showAddPersonDialog} onOpenChange={setShowAddPersonDialog}>
          <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Tambah Anggota Keluarga</DialogTitle>
            </DialogHeader>
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Memuat formulir...</div>}>
              <PersonForm
                onSuccess={() => setShowAddPersonDialog(false)}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
