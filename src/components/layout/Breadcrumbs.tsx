import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive?: boolean;
}

// Route mapping untuk breadcrumbs
const routeMap: Record<string, { label: string; parent?: string }> = {
  '/': { label: 'Beranda' },
  '/chart': { label: 'Silsilah' },
  '/people': { label: 'Anggota' },
  '/stories': { label: 'Kisah Keluarga' },
  '/calendar': { label: 'Kalender' },
  '/evidence': { label: 'Dokumen' },
  '/gallery': { label: 'Galeri' },
  '/stats': { label: 'Statistik' },
  '/relationship-check': { label: 'Cek Hubungan' },
  '/duplicates': { label: 'Duplikat' },
  '/data-quality': { label: 'Kesehatan Data' },
  '/branches': { label: 'Cabang' },
  '/submissions': { label: 'Submisi' },
  '/audit': { label: 'Audit Log' },
  '/data': { label: 'Import/Export' },
  '/settings': { label: 'Pengaturan' },
  '/on-this-day': { label: 'Hari Ini' },
};

// Route patterns dengan parameter
const dynamicRoutes = [
  { pattern: /^\/people\/[^/]+$/, label: 'Detail Anggota', parent: '/people' },
  { pattern: /^\/stories\/[^/]+$/, label: 'Detail Kisah', parent: '/stories' },
  { pattern: /^\/chart\/[^/]+$/, label: 'Detail Silsilah', parent: '/chart' },
];

export function Breadcrumbs() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const pathname = location.pathname;
    const items: BreadcrumbItem[] = [];

    // Jangan tampilkan breadcrumbs di dashboard/home
    if (pathname === '/') {
      return [];
    }

    // Always add home
    items.push({ label: 'Beranda', href: '/', isActive: false });

    // Check for dynamic routes first
    let matchedDynamic = false;
    for (const route of dynamicRoutes) {
      if (route.pattern.test(pathname)) {
        // Add parent if exists
        if (route.parent && routeMap[route.parent]) {
          items.push({
            label: routeMap[route.parent].label,
            href: route.parent,
            isActive: false,
          });
        }
        // Add current page
        items.push({
          label: route.label,
          href: pathname,
          isActive: true,
        });
        matchedDynamic = true;
        break;
      }
    }

    // If no dynamic route matched, use static mapping
    if (!matchedDynamic) {
      const routeInfo = routeMap[pathname];
      if (routeInfo) {
        items.push({
          label: routeInfo.label,
          href: pathname,
          isActive: true,
        });
      } else {
        // Fallback: use pathname segments
        const segments = pathname.split('/').filter(Boolean);
        let currentPath = '';
        
        segments.forEach((segment, index) => {
          currentPath += `/${segment}`;
          const isLast = index === segments.length - 1;
          
          // Try to find label in routeMap
          const routeInfo = routeMap[currentPath];
          const label = routeInfo?.label || 
                       segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
          
          items.push({
            label,
            href: currentPath,
            isActive: isLast,
          });
        });
      }
    }

    return items;
  }, [location.pathname]);

  // Jangan render jika tidak ada breadcrumbs (dashboard) atau hanya 1 item
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb"
      className={cn(
        "sticky top-14 md:top-0 z-30 w-full border-b bg-muted/30 backdrop-blur",
        "py-1.5 px-3 md:rounded-t-[1.75rem] md:border-b md:border-border/70 md:bg-card/85 md:px-6"
      )}
    >
      <ol className="mx-auto flex max-w-7xl items-center flex-wrap gap-1.5 text-sm md:min-h-[3.25rem]">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground/50 flex-shrink-0" />
              )}
              
              {isLast ? (
                <span 
                  className="font-medium text-foreground truncate max-w-[200px] md:max-w-xs"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground font-normal"
                >
                  <Link to={item.href} className="flex items-center gap-1">
                    {index === 0 && <Home className="w-3.5 h-3.5" />}
                    <span className="truncate max-w-[150px] md:max-w-[200px]">
                      {item.label}
                    </span>
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
