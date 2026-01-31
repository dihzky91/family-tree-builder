import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Users,
  Calendar,
  BookOpen,
  Menu,
  Copy,
  Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFamilyStore } from '@/store/familyStore';
import { useMemo } from 'react';
import { checkDataQuality } from '@/lib/dataQuality';
import { findAllDuplicates } from '@/lib/duplicateDetection';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: () => number | null;
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { persons, relationships } = useFamilyStore();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Calculate badge counts
  const duplicateCount = useMemo(() => {
    return findAllDuplicates(persons).length;
  }, [persons]);

  const issueCount = useMemo(() => {
    const issues = checkDataQuality(persons, relationships);
    return issues.filter(i => i.type === 'error' || i.type === 'warning').length;
  }, [persons, relationships]);

  const navItems: NavItem[] = [
    {
      title: 'Silsilah',
      url: '/chart',
      icon: GitBranch,
    },
    {
      title: 'Anggota',
      url: '/people',
      icon: Users,
    },
    {
      title: 'Kalender',
      url: '/calendar',
      icon: Calendar,
    },
    {
      title: 'Kisah',
      url: '/stories',
      icon: BookOpen,
    },
    {
      title: 'Menu',
      url: '#menu',
      icon: Menu,
      badge: () => {
        const total = duplicateCount + issueCount;
        return total > 0 ? total : null;
      }
    },
  ];

  // Detect keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      // On mobile, when keyboard opens, window height decreases significantly
      const isMobile = window.innerWidth < 768;
      const heightRatio = window.innerHeight / window.screen.height;
      
      if (isMobile && heightRatio < 0.6) {
        setIsKeyboardVisible(true);
      } else {
        setIsKeyboardVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = (url: string) => {
    if (url === '#menu') {
      // Trigger menu sheet from parent - we'll handle this differently
      // Dispatch custom event to open mobile nav sheet
      window.dispatchEvent(new CustomEvent('openMobileNav'));
    } else {
      navigate(url);
    }
  };

  // Don't render if keyboard is visible
  if (isKeyboardVisible) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url || 
                          (item.url !== '#' && location.pathname.startsWith(item.url));
          const badgeCount = item.badge ? item.badge() : null;
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              onClick={() => handleNavClick(item.url)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-colors",
                "active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "w-5 h-5 mb-1",
                  isActive && "stroke-[2.5px]"
                )} />
                {badgeCount !== null && badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] font-semibold flex items-center justify-center"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
