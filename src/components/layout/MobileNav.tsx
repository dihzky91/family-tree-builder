import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  House,
  Users,
  GitBranch,
  FileText,
  Download,
  Settings,
  Search,
  Menu,
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
  Cake
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useFamilyStore } from '@/store/familyStore';
import { useMemo } from 'react';
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, persons, relationships, isDemoMode } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Calculate badge counts
  const duplicateCount = useMemo(() => {
    return findAllDuplicates(persons).length;
  }, [persons]);

  const submissionCount = useMemo(() => {
    return 0;
  }, []);

  const issueCount = useMemo(() => {
    const issues = checkDataQuality(persons, relationships);
    return issues.filter(i => i.type === 'error' || i.type === 'warning').length;
  }, [persons, relationships]);

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
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <TreeDeciduous className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-semibold text-sm">Silsilah</span>
              <span className="text-xs text-muted-foreground">{persons.length} anggota</span>
            </div>
            {isDemoMode && (
              <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/50 text-[10px] px-1.5 py-0">
                DEMO
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddPersonDialog(true)}
              aria-label="Tambah anggota"
              className="h-9 w-9"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <UserMenu />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Buka menu navigasi">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-[350px] p-0">
                <div className="flex flex-col h-full">
                  {/* Search */}
                  <div className="p-4 border-b">
                    <form onSubmit={handleSearch}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Cari nama, tag..."
                          value={localSearch}
                          onChange={(e) => setLocalSearch(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {localSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setLocalSearch('');
                              setSearchQuery('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Navigation */}
                  <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                    {navGroups.map((group) => (
                      <div key={group.label} className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </h3>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const isActive = location.pathname === item.url;
                            const badgeCount = item.badge ? item.badge() : null;

                            return (
                              <button
                                key={item.url}
                                onClick={() => handleNavClick(item.url)}
                                className={cn(
                                  "flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-colors",
                                  "hover:bg-accent",
                                  isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-foreground"
                                )}
                              >
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span className="flex-1 text-left">{item.title}</span>
                                {badgeCount !== null && badgeCount > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 min-w-5 px-1.5 text-xs font-semibold bg-destructive/10 text-destructive"
                                  >
                                    {badgeCount}
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

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
    </>
  );
}
