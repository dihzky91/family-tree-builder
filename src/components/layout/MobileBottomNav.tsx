import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  GitBranch,
  Users,
  BookOpen,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFamilyStore } from '@/store/familyStore';
import { checkDataQuality } from '@/lib/dataQuality';
import { findAllDuplicates, IGNORED_DUPLICATES_EVENT } from '@/lib/duplicateDetection';
import { usePendingSubmissionCount } from '@/hooks/usePendingSubmissionCount';

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

  const [ignoredVersion, setIgnoredVersion] = useState(0);

  useEffect(() => {
    const onIgnoredChanged = () => setIgnoredVersion((v) => v + 1);
    window.addEventListener(IGNORED_DUPLICATES_EVENT, onIgnoredChanged);
    return () => window.removeEventListener(IGNORED_DUPLICATES_EVENT, onIgnoredChanged);
  }, []);

  // Calculate badge counts
  const duplicateCount = useMemo(() => {
    void ignoredVersion;
    return findAllDuplicates(persons, { relationships }).length;
  }, [persons, relationships, ignoredVersion]);

  const submissionCount = usePendingSubmissionCount();

  const issueCount = useMemo(() => {
    const issues = checkDataQuality(persons, relationships);
    return issues.filter(i => i.type === 'error' || i.type === 'warning').length;
  }, [persons, relationships]);

  const navItems: NavItem[] = [
    {
      title: 'Beranda',
      url: '/',
      icon: House,
    },
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
      title: 'Kisah',
      url: '/stories',
      icon: BookOpen,
    },
    {
      title: 'Menu',
      url: '#menu',
      icon: Menu,
      badge: () => {
        const total = duplicateCount + issueCount + submissionCount;
        return total > 0 ? total : null;
      }
    },
  ];

  // Detect keyboard visibility on mobile using visualViewport when available
  useEffect(() => {
    const checkKeyboard = () => {
      if (window.innerWidth >= 768) {
        setIsKeyboardVisible(false);
        return;
      }
      const vv = window.visualViewport;
      if (vv) {
        const heightDiff = window.innerHeight - vv.height;
        setIsKeyboardVisible(heightDiff > 150);
      } else {
        const heightRatio = window.innerHeight / window.screen.height;
        setIsKeyboardVisible(heightRatio < 0.6);
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', checkKeyboard);
      return () => vv.removeEventListener('resize', checkKeyboard);
    }
    window.addEventListener('resize', checkKeyboard);
    return () => window.removeEventListener('resize', checkKeyboard);
  }, []);

  const handleNavClick = (url: string) => {
    if (url === '#menu') {
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
    <nav
      aria-label="Navigasi Utama"
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/98 border-t border-border/80 md:hidden safe-area-pb"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.url ||
            (item.url !== '/' && item.url !== '#menu' && location.pathname.startsWith(item.url));
          const badgeCount = item.badge ? item.badge() : null;
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              type="button"
              onClick={() => handleNavClick(item.url)}
              aria-label={item.title}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-h-[44px] px-1 py-1 gap-0.5 transition-colors",
                "active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-full px-3.5 py-1 transition-colors",
                  isActive && "bg-primary/12"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive && "stroke-[2.25px]"
                  )}
                />
                {badgeCount !== null && badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 right-0.5 h-4 min-w-4 px-1 text-[10px] font-semibold flex items-center justify-center"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
