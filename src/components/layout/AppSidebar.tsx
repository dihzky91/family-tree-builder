import { useLocation, Link } from 'react-router-dom';
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
  TreeDeciduous
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFamilyStore } from '@/store/familyStore';
import { useState } from 'react';

const navItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Anggota', url: '/people', icon: Users },
  { title: 'Silsilah', url: '/chart', icon: GitBranch },
  { title: 'Dokumen', url: '/evidence', icon: FileText },
  { title: 'Import/Export', url: '/data', icon: Download },
  { title: 'Pengaturan', url: '/settings', icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { searchQuery, setSearchQuery, persons } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
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

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                "hover:bg-sidebar-accent",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground/80"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", collapsed && "mx-auto")} />
              {!collapsed && <span className="font-medium">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Stats */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60">
            <p>{persons.length} anggota keluarga</p>
          </div>
        </div>
      )}
    </aside>
  );
}
