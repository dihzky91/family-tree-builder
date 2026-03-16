import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  House,
  Users,
  GitBranch,
  FileText,
  Download,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
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
  Upload,
  X,
  Cake,
  Mouse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFamilyStore } from '@/store/familyStore';
import { useState, useMemo, useEffect, useRef } from 'react';
import { UserMenu } from '@/components/auth/UserMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/features/people/PersonForm';
import { checkDataQuality } from '@/lib/dataQuality';
import { findAllDuplicates } from '@/lib/duplicateDetection';

interface NavItem {
  title: string;
  url: string;
  icon: any;
  badge?: () => number | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, persons, relationships, isZenMode, isDemoMode } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [hasNavOverflow, setHasNavOverflow] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Sync localSearch with global searchQuery
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement || collapsed) {
      setHasNavOverflow(false);
      return;
    }

    const updateOverflowState = () => {
      setHasNavOverflow(navElement.scrollHeight > navElement.clientHeight + 4);
    };

    updateOverflowState();

    const resizeObserver = new ResizeObserver(updateOverflowState);
    resizeObserver.observe(navElement);

    window.addEventListener('resize', updateOverflowState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateOverflowState);
    };
  }, [collapsed, persons.length, relationships.length]);

  // Calculate badge counts
  const duplicateCount = useMemo(() => {
    return findAllDuplicates(persons).length;
  }, [persons]);

  const submissionCount = useMemo(() => {
    // TODO: Add submissions to store when implementing submission feature
    return 0;
  }, []);

  const issueCount = useMemo(() => {
    const issues = checkDataQuality(persons, relationships);
    return issues.filter(i => i.type === 'error' || i.type === 'warning').length;
  }, [persons, relationships]);

  const todayAuditCount = useMemo(() => {
    // For demo purposes, return 0 - would need actual audit log data
    return 0;
  }, []);

  const navGroups: NavGroup[] = [
    {
      label: 'Ringkasan',
      items: [
        { title: 'Beranda', url: '/', icon: House },
        { title: 'Hari Ini', url: '/on-this-day', icon: CalendarHeart },
        { title: 'Kalender Ulang Tahun', url: '/calendar', icon: Cake },
      ]
    },
    {
      label: 'Data',
      items: [
        { title: 'Anggota', url: '/people', icon: Users },
        { title: 'Silsilah', url: '/chart', icon: GitBranch },
        { title: 'Kisah Keluarga', url: '/stories', icon: BookOpen },
        { title: 'Dokumen', url: '/evidence', icon: FileText },
        { title: 'Galeri', url: '/gallery', icon: Image },
      ]
    },
    {
      label: 'Tools',
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
      label: 'Insights',
      items: [
        { title: 'Statistik', url: '/stats', icon: BarChart3 },
      ]
    },
    {
      label: 'Management',
      items: [
        { title: 'Cabang', url: '/branches', icon: FolderTree },
        {
          title: 'Submisi',
          url: '/submissions',
          icon: FileCheck,
          badge: () => submissionCount > 0 ? submissionCount : null
        },
        {
          title: 'Audit Log',
          url: '/audit',
          icon: History,
          badge: () => todayAuditCount > 0 ? todayAuditCount : null
        },
        { title: 'Import/Export', url: '/data', icon: Download },
        { title: 'Pengaturan', url: '/settings', icon: Settings },
      ]
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    if (location.pathname !== '/people') {
      navigate('/people');
    }
  };

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const navElement = navRef.current;
    if (!navElement) return;

    const step = 56;
    const pageStep = Math.max(navElement.clientHeight * 0.8, 120);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        navElement.scrollBy({ top: step, behavior: 'smooth' });
        break;
      case 'ArrowUp':
        event.preventDefault();
        navElement.scrollBy({ top: -step, behavior: 'smooth' });
        break;
      case 'PageDown':
      case ' ': {
        event.preventDefault();
        navElement.scrollBy({ top: pageStep, behavior: 'smooth' });
        break;
      }
      case 'PageUp':
        event.preventDefault();
        navElement.scrollBy({ top: -pageStep, behavior: 'smooth' });
        break;
      case 'Home':
        event.preventDefault();
        navElement.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'End':
        event.preventDefault();
        navElement.scrollTo({ top: navElement.scrollHeight, behavior: 'smooth' });
        break;
      default:
        break;
    }
  };

  return (
    <aside
      className={cn(
        "sticky top-5 flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-black/20 transition-all duration-300 sidebar-gradient",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border/80 px-4 py-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <TreeDeciduous className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-lg truncate">Silsilah</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">Keluarga</p>
          </div>
        )}

        {/* Demo Mode Indicator */}
        {isDemoMode && !collapsed && (
          <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/50 text-[10px] px-1.5 py-0.5">
            DEMO
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search */}
      {!collapsed && (
        <form onSubmit={handleSearch} className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/50" />
            <Input
              type="search"
              placeholder="Cari nama, tag..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="h-10 rounded-xl border-sidebar-border/80 bg-sidebar-accent/80 pl-9 pr-9 text-sidebar-foreground placeholder:text-sidebar-foreground/50"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      )}

      {/* Quick Actions */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-3 space-y-2">
          <Button
            className="w-full justify-start gap-2 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
            onClick={() => setShowAddPersonDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Tambah Anggota
          </Button>
          <Button
            variant="sidebarOutline"
            className="w-full justify-start gap-2 rounded-xl border-sidebar-border/80 bg-sidebar-accent/30 hover:bg-sidebar-accent"
            onClick={() => navigate('/data')}
          >
            <Upload className="w-4 h-4" />
            Import Data
          </Button>
          {hasNavOverflow && (
            <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-sidebar-foreground/45">
            <Mouse className="h-3.5 w-3.5 shrink-0" />
              <span>Gunakan trackpad dua jari atau tombol panah untuk menelusuri menu</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="relative flex-1 min-h-0 px-2 py-3">
        <div className="pointer-events-none absolute inset-x-2 top-3 z-10 h-6 rounded-t-2xl bg-gradient-to-b from-sidebar via-sidebar/85 to-transparent" />
        <div className="pointer-events-none absolute inset-x-2 bottom-3 z-10 h-8 rounded-b-2xl bg-gradient-to-t from-sidebar via-sidebar/85 to-transparent" />
        <nav
          ref={navRef}
          tabIndex={hasNavOverflow ? 0 : -1}
          aria-label="Navigasi sidebar"
          onKeyDown={handleNavKeyDown}
          className="soft-scroll scroll-fade-mask h-full space-y-4 overflow-y-auto rounded-2xl px-0.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className="space-y-1.5">
            {/* Group Label */}
            {!collapsed && (
              <div className="px-3 py-1.5">
                <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
            )}

            {/* Group Items */}
            {group.items.map((item) => {
              const isActive = location.pathname === item.url;
              const badgeCount = item.badge ? item.badge() : null;

              return (
                <Link
                  key={item.url}
                  to={item.url}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    "hover:bg-sidebar-accent/80",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80"
                  )}
                  title={collapsed ? item.title : undefined}
                  aria-label={collapsed ? item.title : undefined}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0", collapsed && "mx-auto")} />
                  {!collapsed && (
                    <>
                      <span className="font-medium flex-1">{item.title}</span>
                      {badgeCount !== null && badgeCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-5 min-w-5 px-1.5 text-xs font-semibold",
                            isActive
                              ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                              : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {badgeCount}
                        </Badge>
                      )}
                    </>
                  )}
                  {/* Badge indicator for collapsed mode */}
                  {collapsed && badgeCount !== null && badgeCount > 0 && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        </nav>
      </div>

      {/* Footer with User Menu */}
      <div className={cn(
        "border-t border-sidebar-border/80 bg-sidebar-accent/20 backdrop-blur-sm",
        collapsed ? "p-2" : "p-4"
      )}>
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="text-xs text-sidebar-foreground/60">
              <p>{persons.length} anggota</p>
            </div>
          )}
          <UserMenu />
        </div>
      </div>

      {/* Add Person Dialog */}
      <Dialog open={showAddPersonDialog} onOpenChange={setShowAddPersonDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Tambah Anggota Keluarga</DialogTitle>
          </DialogHeader>
          <PersonForm
            onSuccess={() => setShowAddPersonDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </aside>
  );
}
