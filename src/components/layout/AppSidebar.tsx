import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  GitBranch,
  FileText,
  Download,
  Settings,
  Home,
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
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFamilyStore } from '@/store/familyStore';
import { useState, useMemo } from 'react';
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
  const { searchQuery, setSearchQuery, persons, relationships } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);

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
      label: 'Overview',
      items: [
        { title: 'Hari Ini', url: '/on-this-day', icon: CalendarHeart },
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
          title: 'Submissions',
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

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <TreeDeciduous className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-lg truncate">Silsilah</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">Keluarga</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search */}
      {!collapsed && (
        <form onSubmit={handleSearch} className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/50" />
            <Input
              type="search"
              placeholder="Cari nama, tag..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
            />
          </div>
        </form>
      )}

      {/* Quick Actions */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          <Button
            className="w-full justify-start gap-2 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
            onClick={() => setShowAddPersonDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Tambah Anggota
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-sidebar-border hover:bg-sidebar-accent"
            onClick={() => navigate('/data')}
          >
            <Upload className="w-4 h-4" />
            Import Data
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className="space-y-1">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative",
                    "hover:bg-sidebar-accent",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80"
                  )}
                  title={collapsed ? item.title : undefined}
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

      {/* Footer with User Menu */}
      <div className={cn(
        "border-t border-sidebar-border",
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
