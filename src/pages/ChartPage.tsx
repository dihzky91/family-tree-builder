import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useFamilyStore } from '@/store/familyStore';
import { usePanZoom } from '@/hooks/usePanZoom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ZoomIn,
  ZoomOut,
  Search,
  User,
  Users,
  Heart,
  Baby,
  X,
  Calendar,
  GitBranch,
  Plus,
  Link2,
  Download,
  Network,
  TreePine,
  Printer,
  RotateCcw,
  ChevronDown,
  MoreHorizontal,
  Check,
  Share2,
  Map,
  PieChart,
  Dna,
  SlidersHorizontal,
} from 'lucide-react';
import type { Person } from '@/types';
import { GenerationView } from '@/features/chart/views/GenerationView';
import { FamilyView } from '@/features/chart/views/FamilyView';
import { PedigreeView } from '@/features/chart/views/PedigreeView';
import { RelationshipForm } from '@/features/relationships/RelationshipForm';
import { RelationshipInspector } from '@/features/relationships/RelationshipInspector';
import { MiniMap } from '@/features/chart/components/MiniMap';
import { exportTreeAsImage, type ExportFormat } from '@/features/chart/utils/exportTreeAsImage';
import { exportTreePremiumDigital, type PremiumTheme, type PremiumPaletteOverrides } from '@/features/chart/utils/premiumExport';
import { FamilyMainView } from '@/features/chart/views/FamilyMainView';
import { transformToFamilyChartData } from '@/features/chart/utils/familyChartMapper';
import { cn } from '@/lib/utils';

const PrintDialog = lazy(() => import('@/features/chart/components/PrintDialog').then(m => ({ default: m.PrintDialog })));
const TimelineView = lazy(() => import('@/features/chart/views/TimelineView').then(m => ({ default: m.TimelineView })));
const NetworkGraphView = lazy(() => import('@/features/chart/views/NetworkGraphView').then(m => ({ default: m.NetworkGraphView })));
const GeoMapView = lazy(() => import('@/features/chart/views/GeoMapView').then(m => ({ default: m.GeoMapView })));
const SunburstView = lazy(() => import('@/features/chart/views/SunburstView').then(m => ({ default: m.SunburstView })));
const InheritanceTreeView = lazy(() => import('@/features/chart/views/InheritanceTreeView').then(m => ({ default: m.InheritanceTreeView })));


// Animation variants
const viewTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { type: "spring" as const, stiffness: 300, damping: 30 }
};

const panelVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: { duration: 0.2 }
  }
};

const MINIMAP_PERSON_THRESHOLD = 24;

type ViewMode = 'family' | 'pedigree' | 'tree' | 'timeline' | 'stats' | 'main-chart' | 'network' | 'map' | 'sunburst' | 'dna';

export default function ChartPage() {
  const { persons, relationships, evidence, getPersonRelatives, setSelectedPerson, selectedPersonId } = useFamilyStore();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('family');
  const [searchQuery, setSearchQuery] = useState('');
  const [pedigreeGenerations, setPedigreeGenerations] = useState(4);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [addRelationshipContext, setAddRelationshipContext] = useState<{
    personId?: string;
    suggestedType?: 'parent' | 'spouse' | 'child';
  }>({});
  const chartRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom hook
  const maxScale = 2;
  const minScale = viewMode === 'pedigree' ? 0.5 : 0.3;
  const {
    isDragging,
    handlers: panZoomHandlers,
    zoomIn,
    zoomOut,
    reset,
    panBy,
    setTransform,
    containerRef: panZoomContainerRef,
    setContentRef,
  } = usePanZoom({
    minScale,
    maxScale,
    initialScale: 1,
  });
  const selectedPerson = persons.find(p => p.id === selectedPersonId);
  const relatives = selectedPersonId ? getPersonRelatives(selectedPersonId) : null;

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (focusId) {
      setSelectedPerson(focusId);
    }
  }, [searchParams, setSelectedPerson]);

  const buildLineageIds = useCallback((personId: string | null) => {
    if (!personId) return [];
    const parentsByChild = new globalThis.Map() as Map<string, string[]>;
    const childrenByParent = new globalThis.Map() as Map<string, string[]>;

    relationships.forEach((rel) => {
      if (rel.type !== 'PARENT_CHILD') return;
      if (!parentsByChild.has(rel.toPersonId)) {
        parentsByChild.set(rel.toPersonId, []);
      }
      parentsByChild.get(rel.toPersonId)!.push(rel.fromPersonId);

      if (!childrenByParent.has(rel.fromPersonId)) {
        childrenByParent.set(rel.fromPersonId, []);
      }
      childrenByParent.get(rel.fromPersonId)!.push(rel.toPersonId);
    });

    const ancestorIds = new Set<string>();
    const descendantIds = new Set<string>();

    const ancestorStack = [personId];
    while (ancestorStack.length > 0) {
      const current = ancestorStack.pop();
      if (!current) continue;
      const parents = parentsByChild.get(current) || [];
      parents.forEach((parentId) => {
        if (!ancestorIds.has(parentId)) {
          ancestorIds.add(parentId);
          ancestorStack.push(parentId);
        }
      });
    }

    const descendantStack = [personId];
    while (descendantStack.length > 0) {
      const current = descendantStack.pop();
      if (!current) continue;
      const children = childrenByParent.get(current) || [];
      children.forEach((childId) => {
        if (!descendantIds.has(childId)) {
          descendantIds.add(childId);
          descendantStack.push(childId);
        }
      });
    }

    return Array.from(new Set([personId, ...ancestorIds, ...descendantIds]));
  }, [relationships]);

  // Handle search/focus
  const fuse = useMemo(() => new Fuse(persons, {
    keys: ['fullName', 'id'],
    threshold: 0.3,
    ignoreLocation: true
  }), [persons]);

  const handleSearch = useCallback(() => {
    if (!searchQuery) return;

    const results = fuse.search(searchQuery);
    if (results.length > 0) {
      setSelectedPerson(results[0].item.id);
      setShowMobileSearch(false);
    }
  }, [searchQuery, fuse, setSelectedPerson]);

  const quickSearchResults = useMemo(
    () => (searchQuery ? fuse.search(searchQuery).slice(0, 6) : []),
    [fuse, searchQuery]
  );

  useEffect(() => {
    if (viewMode !== 'family') return;
    if (!isMobile) return;
    if (!searchQuery) return;
    const results = fuse.search(searchQuery);
    if (results.length > 0) {
      setSelectedPerson(results[0].item.id);
    }
  }, [viewMode, isMobile, searchQuery, fuse, setSelectedPerson]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!chartRef.current) return;
    await exportTreeAsImage(chartRef.current, { format, filename: 'silsilah-keluarga' });
  };

  const handleCenterOnSelected = useCallback(() => {
    if (!selectedPersonId || !chartRef.current || !panZoomContainerRef.current) return;
    const target = chartRef.current.querySelector(
      `[data-person-id="${selectedPersonId}"]`
    ) as HTMLElement | null;
    if (!target) return;

    const targetRect = target.getBoundingClientRect();
    const containerRect = panZoomContainerRef.current.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;

    panBy(containerCenterX - targetCenterX, containerCenterY - targetCenterY);
  }, [selectedPersonId, panBy, panZoomContainerRef]);

  const handleChartRef = useCallback((node: HTMLDivElement | null) => {
    chartRef.current = node;
    setContentRef(node);
  }, [setContentRef]);

  const autoFitToContent = useCallback(() => {
    if (!chartRef.current || !panZoomContainerRef.current) return;
    const nodes = Array.from(
      chartRef.current.querySelectorAll('[data-person-id]')
    ) as HTMLElement[];
    if (nodes.length === 0) return;

    setTransform({ x: 0, y: 0, scale: 1 });

    requestAnimationFrame(() => {
      if (!panZoomContainerRef.current) return;
      const containerRect = panZoomContainerRef.current.getBoundingClientRect();

      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;

      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
      });

      const contentWidth = maxRight - minLeft;
      const contentHeight = maxBottom - minTop;
      if (contentWidth <= 0 || contentHeight <= 0) return;

      const scale = Math.min(
        containerRect.width / contentWidth,
        containerRect.height / contentHeight
      ) * 0.9;

      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      const centerX = (minLeft + maxRight) / 2 - containerRect.left;
      const centerY = (minTop + maxBottom) / 2 - containerRect.top;

      const nextX = containerRect.width / 2 - centerX * clampedScale;
      const nextY = containerRect.height / 2 - centerY * clampedScale;

      setTransform({ x: nextX, y: nextY, scale: clampedScale });
    });
  }, [maxScale, minScale, setTransform, panZoomContainerRef]);

  useEffect(() => {
    if (viewMode !== 'pedigree') return;
    autoFitToContent();
  }, [viewMode, pedigreeGenerations, persons.length, relationships.length, autoFitToContent]);

  const customPalette: PremiumPaletteOverrides = {
    backgroundStart: '#f0fdfa',
    backgroundEnd: '#e0f2f1',
    accent: '#0f766e',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    border: '#cbd5e1',
  };

  const handlePremiumExport = async (
    exportTheme: PremiumTheme,
    paletteOverrides?: PremiumPaletteOverrides
  ) => {
    if (!chartRef.current) return;
    const subtitle = selectedPerson
      ? `Fokus: ${selectedPerson.fullName}`
      : `${persons.length} anggota`;
    const qrData = selectedPersonId
      ? `${window.location.origin}/chart?focus=${selectedPersonId}`
      : `${window.location.origin}/chart`;
    await exportTreePremiumDigital(chartRef.current, {
      title: 'Silsilah Keluarga',
      subtitle,
      theme: exportTheme,
      scale: 3,
      stats: {
        totalMembers: stats.total,
        totalRelationships: relationships.length,
        generations: stats.generations,
        verifiedMembers: stats.verified,
        livingMembers: stats.living,
        documents: evidence.length,
      },
      qrData,
      paletteOverrides,
      highlightedPersonIds: buildLineageIds(selectedPersonId),
    });
  };

  const handleAddRelationship = useCallback((personId: string, type: 'parent' | 'spouse' | 'child') => {
    setAddRelationshipContext({ personId, suggestedType: type });
    setShowAddRelationship(true);
  }, []);

  const timelineData = useMemo(() => {
    const parentsByChild = new globalThis.Map<string, string[]>();

    relationships.forEach((relationship) => {
      if (relationship.type !== 'PARENT_CHILD') return;

      const currentParents = parentsByChild.get(relationship.toPersonId);
      if (currentParents) {
        currentParents.push(relationship.fromPersonId);
      } else {
        parentsByChild.set(relationship.toPersonId, [relationship.fromPersonId]);
      }
    });

    const generationCache = new globalThis.Map<string, number>();
    const byGeneration: Record<number, Person[]> = {};

    const getGeneration = (personId: string, visited = new Set<string>()): number => {
      const cached = generationCache.get(personId);
      if (cached) return cached;
      if (visited.has(personId)) return 1;

      const nextVisited = new Set(visited);
      nextVisited.add(personId);

      const parentIds = parentsByChild.get(personId) || [];
      if (parentIds.length === 0) {
        generationCache.set(personId, 1);
        return 1;
      }

      const generation = Math.max(
        ...parentIds.map((parentId) => getGeneration(parentId, nextVisited))
      ) + 1;

      generationCache.set(personId, generation);
      return generation;
    };

    persons.forEach((person) => {
      const generation = getGeneration(person.id);
      if (!byGeneration[generation]) {
        byGeneration[generation] = [];
      }
      byGeneration[generation].push(person);
    });

    return Object.entries(byGeneration)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([generation, people]) => ({ generation: Number(generation), people }));
  }, [persons, relationships]);

  const stats = useMemo(() => {
    const maleCount = persons.filter(p => p.gender === 'male').length;
    const femaleCount = persons.filter(p => p.gender === 'female').length;
    const unknownCount = persons.filter(p => p.gender === 'unknown').length;
    const livingCount = persons.filter(p => !p.deathDate).length;
    const verifiedCount = persons.filter(p => p.tags.includes('verified')).length;

    return {
      total: persons.length,
      byGender: { male: maleCount, female: femaleCount, unknown: unknownCount },
      living: livingCount,
      deceased: persons.length - livingCount,
      verified: verifiedCount,
      generations: timelineData.length,
      generationData: timelineData,
    };
  }, [persons, timelineData]);

  const viewModeOptions = [
    { value: 'family', label: 'Keluarga', icon: Users, description: 'Fokus pada satu orang' },
    { value: 'pedigree', label: 'Leluhur', icon: TreePine, description: 'Silsilah leluhur' },
    { value: 'tree', label: 'Generasi', icon: Network, description: 'Semua per generasi' },
    { value: 'timeline', label: 'Linimasa', icon: Calendar, description: 'Urutan waktu' },
    { value: 'network', label: 'Jaringan', icon: Share2, description: 'Grafik hubungan' },
    { value: 'map', label: 'Peta', icon: Map, description: 'Peta Sebaran' },
    { value: 'sunburst', label: 'Sunburst', icon: PieChart, description: 'Diagram Keturunan' },
    { value: 'dna', label: 'Pohon DNA', icon: Dna, description: 'Warisan Genetik' },
    { value: 'stats', label: 'Statistik', icon: GitBranch, description: 'Statistik keluarga' },
    { value: 'main-chart', label: 'Chart Utama', icon: Network, description: 'Tampilan utama' },
  ];

  const currentViewOption = viewModeOptions.find(opt => opt.value === viewMode) || viewModeOptions[0];
  const CurrentViewIcon = currentViewOption.icon;
  const isZoomableView = viewMode === 'tree' || viewMode === 'family' || viewMode === 'pedigree';
  const primaryViewModes = viewModeOptions.slice(0, 5);
  const secondaryViewModes = viewModeOptions.slice(5);
  const showMiniMap = !isMobile && viewMode === 'tree' && persons.length >= MINIMAP_PERSON_THRESHOLD;
  const chartFocusLabel = selectedPerson ? selectedPerson.fullName : 'Belum ada fokus anggota';
  const mainChartRootPerson = selectedPerson || persons[0] || null;
  const chartContextItems = [
    `${stats.total} anggota`,
    `${stats.generations} generasi`,
    selectedPerson ? 'Fokus aktif' : currentViewOption.description,
  ];

  const selectPersonFromSearch = useCallback((personId: string) => {
    setSelectedPerson(personId);
    setShowMobileSearch(false);
  }, [setSelectedPerson]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Main Chart Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b bg-card/95 backdrop-blur-sm">
          {isMobile ? (
            <>
              <div className="flex items-center justify-between gap-3 px-3 pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tampilan</p>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="text-base font-display font-semibold">Silsilah</h1>
                    <Badge variant="secondary" className="max-w-[140px] truncate">
                      {currentViewOption.label}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {selectedPerson ? `Fokus: ${selectedPerson.fullName}` : currentViewOption.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Cari anggota"
                    onClick={() => setShowMobileSearch(true)}
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Buka kontrol chart"
                    onClick={() => setShowMobileControls(true)}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 pb-3 pt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 flex-1 justify-between" title={currentViewOption.description}>
                      <span className="flex items-center gap-2 truncate">
                        <CurrentViewIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{currentViewOption.label}</span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover w-56">
                    {viewModeOptions.map(opt => {
                      const Icon = opt.icon;
                      const isActive = viewMode === opt.value;
                      return (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => setViewMode(opt.value as ViewMode)}
                          className="flex items-start gap-3 py-2"
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium ${isActive ? 'text-primary' : ''}`}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedPerson && (
                  <Button
                    variant="secondary"
                    className="h-10 shrink-0"
                    onClick={() => setSelectedPerson(null)}
                  >
                    Lepas Fokus
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 px-4 py-2.5">
              {/* Row 1: Title + Inline Stats + Focus Pill + Search */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CurrentViewIcon className="h-4 w-4" />
                    </span>
                    <h1 className="font-display text-lg font-semibold text-foreground leading-none">
                      {currentViewOption.label}
                    </h1>
                  </div>

                  <span className="hidden text-muted-foreground/40 sm:inline">·</span>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
                      {stats.total} anggota
                    </span>
                    <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
                      {stats.generations} generasi
                    </span>
                    {selectedPerson ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 pl-2.5 pr-1.5 py-0.5 font-medium text-foreground">
                        <span className="truncate max-w-[160px]">Fokus: {selectedPerson.fullName}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPerson(null)}
                          className="rounded-full p-0.5 hover:bg-primary/20 text-muted-foreground hover:text-foreground"
                          title="Lepas fokus"
                          aria-label="Lepas fokus"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="hidden lg:inline text-muted-foreground">
                        {currentViewOption.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cari anggota atau ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-8 rounded-xl border-border/70 bg-background/80 pl-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: View Switcher + Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {primaryViewModes.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = viewMode === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-8 rounded-lg px-2.5 text-xs',
                          isActive
                            ? 'shadow-sm'
                            : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
                        )}
                        title={opt.description}
                        onClick={() => setViewMode(opt.value as ViewMode)}
                      >
                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                        {opt.label}
                      </Button>
                    );
                  })}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={secondaryViewModes.some((o) => o.value === viewMode) ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                        title={currentViewOption.description}
                      >
                        <span>Lainnya</span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-popover w-56">
                      {secondaryViewModes.map(opt => {
                        const Icon = opt.icon;
                        const isActive = viewMode === opt.value;
                        return (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setViewMode(opt.value as ViewMode)}
                            className="flex items-start gap-3 py-2"
                          >
                            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium ${isActive ? 'text-primary' : ''}`}>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Pedigree Generation Slider */}
                  {viewMode === 'pedigree' && (
                    <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Kedalaman</span>
                      <input
                        type="range"
                        min={2}
                        max={6}
                        value={pedigreeGenerations}
                        onChange={(e) => setPedigreeGenerations(Number(e.target.value))}
                        className="h-1.5 w-14 accent-primary cursor-pointer"
                      />
                      <span className="text-xs font-medium w-3 text-center">{pedigreeGenerations}</span>
                    </div>
                  )}

                  {/* Zoom Controls */}
                  {isZoomableView && (
                    <div className="flex items-center rounded-lg border border-border/70 bg-background/80">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => handleZoom('out')} title="Zoom Out" aria-label="Perkecil chart">
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-none border-x sm:flex" onClick={reset} title="Reset View" aria-label="Reset posisi chart">
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => handleZoom('in')} title="Zoom In" aria-label="Perbesar chart">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-border/70 bg-background/90 px-2.5 text-xs" title="Aksi" aria-label="Buka menu aksi">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <span>Aksi</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover w-48">
                      <DropdownMenuItem
                        onClick={() => setShowPrintDialog(true)}
                        disabled={persons.length === 0}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Cetak
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleExport('png')}
                        disabled={persons.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export PNG
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport('svg')}
                        disabled={persons.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export SVG
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { void handlePremiumExport('modern'); }}
                        disabled={persons.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Premium Modern (PNG + PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { void handlePremiumExport('classic'); }}
                        disabled={persons.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Premium Classic (PNG + PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { void handlePremiumExport('modern', customPalette); }}
                        disabled={persons.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Premium Custom (PNG + PDF)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setAddRelationshipContext({});
                          setShowAddRelationship(true);
                        }}
                        disabled={persons.length < 2}
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Tambah Relasi
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.38))]">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:36px_36px]" />
          {persons.length === 0 ? (
            <motion.div
              className="empty-state relative h-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GitBranch className="empty-state-icon" />
              <h3 className="text-lg font-medium mb-2">Belum ada data</h3>
              <p className="text-muted-foreground">
                Tambahkan anggota keluarga untuk melihat silsilah
              </p>
            </motion.div>
          ) : (
            <div
              className={cn(
                'relative w-full h-full overflow-hidden',
                isZoomableView ? 'touch-none' : 'overflow-auto',
                isZoomableView && (isDragging ? 'cursor-grabbing' : 'cursor-grab')
              )}
              ref={panZoomContainerRef}
              {...(isZoomableView ? panZoomHandlers : {})}
            >
              <div
                ref={handleChartRef}
                className={cn('w-full', isZoomableView ? 'h-full' : 'min-h-full')}
                style={{
                  minHeight: '100%',
                  willChange: 'transform',
                }}
              >
                <Suspense
                  fallback={
                    <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      Memuat tampilan...
                    </div>
                  }
                >
                <AnimatePresence mode="wait">
                  {viewMode === 'family' && (
                    <motion.div
                      key="family"
                      {...viewTransition}
                    >
                      <FamilyView
                        persons={persons}
                        relationships={relationships}
                        selectedPersonId={selectedPersonId}
                        onSelectPerson={setSelectedPerson}
                        onAddRelationship={handleAddRelationship}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'pedigree' && (
                    <motion.div
                      key="pedigree"
                      {...viewTransition}
                    >
                      <PedigreeView
                        persons={persons}
                        relationships={relationships}
                        selectedPersonId={selectedPersonId}
                        onSelectPerson={setSelectedPerson}
                        onAddRelationship={(personId) => handleAddRelationship(personId, 'parent')}
                        maxGenerations={pedigreeGenerations}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'tree' && (
                    <motion.div
                      key="tree"
                      {...viewTransition}
                    >
                      <GenerationView
                        persons={persons}
                        relationships={relationships}
                        selectedPersonId={selectedPersonId}
                        onSelectPerson={setSelectedPerson}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'timeline' && (
                    <motion.div
                      key="timeline"
                      {...viewTransition}
                      className="w-full h-full overflow-y-auto bg-background"
                    >
                      <TimelineView
                        persons={persons}
                        onSelectPerson={setSelectedPerson}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'network' && (
                    <motion.div
                      key="network"
                      {...viewTransition}
                      className="w-full h-full"
                    >
                      <NetworkGraphView
                        persons={persons}
                        relationships={relationships}
                        onSelectPerson={setSelectedPerson}
                        selectedPersonId={selectedPersonId}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'map' && (
                    <motion.div
                      key="map"
                      {...viewTransition}
                      className="w-full h-full"
                    >
                      <GeoMapView
                        persons={persons}
                        onSelectPerson={setSelectedPerson}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'sunburst' && (
                    <motion.div
                      key="sunburst"
                      {...viewTransition}
                      className="w-full h-full"
                    >
                      <SunburstView
                        persons={persons}
                        relationships={relationships}
                        selectedPersonId={selectedPersonId}
                        onSelectPerson={setSelectedPerson}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'dna' && (
                    <motion.div
                      key="dna"
                      {...viewTransition}
                      className="w-full h-full"
                    >
                      <InheritanceTreeView
                        persons={persons}
                        relationships={relationships}
                        selectedPersonId={selectedPersonId}
                        onSelectPerson={setSelectedPerson}
                      />
                    </motion.div>
                  )}
                  {viewMode === 'stats' && (
                    <motion.div
                      key="stats"
                      {...viewTransition}
                      className="p-6 space-y-6"
                    >
                      {(() => {
                        return (
                          <>
                            {/* Overview Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <Card className="stat-card">
                                <p className="text-3xl font-bold">{stats.total}</p>
                                <p className="text-sm text-muted-foreground">Total Anggota</p>
                              </Card>
                              <Card className="stat-card">
                                <p className="text-3xl font-bold">{stats.generations}</p>
                                <p className="text-sm text-muted-foreground">Generasi</p>
                              </Card>
                              <Card className="stat-card">
                                <p className="text-3xl font-bold text-success">{stats.living}</p>
                                <p className="text-sm text-muted-foreground">Masih Hidup</p>
                              </Card>
                              <Card className="stat-card">
                                <p className="text-3xl font-bold text-info">{stats.verified}</p>
                                <p className="text-sm text-muted-foreground">Terverifikasi</p>
                              </Card>
                            </div>

                            {/* Gender Distribution */}
                            <Card className="p-6">
                              <h3 className="font-display font-semibold text-lg mb-4">Distribusi Gender</h3>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Laki-laki</span>
                                    <span className="font-medium">{stats.byGender.male}</span>
                                  </div>
                                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-node-male rounded-full"
                                      style={{ width: `${(stats.byGender.male / stats.total) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Perempuan</span>
                                    <span className="font-medium">{stats.byGender.female}</span>
                                  </div>
                                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-node-female rounded-full"
                                      style={{ width: `${(stats.byGender.female / stats.total) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </Card>

                            {/* Per Generation */}
                            <Card className="p-6">
                              <h3 className="font-display font-semibold text-lg mb-4">Per Generasi</h3>
                              <div className="space-y-2">
                                {stats.generationData.map(({ generation, people }) => (
                                  <div key={generation} className="flex items-center gap-3">
                                    <span className="w-20 text-sm text-muted-foreground">Gen {generation}</span>
                                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-end pr-2"
                                        style={{ width: `${Math.max((people.length / Math.max(...stats.generationData.map(g => g.people.length))) * 100, 20)}%` }}
                                      >
                                        <span className="text-xs font-medium text-primary-foreground">{people.length}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                  {viewMode === 'main-chart' && mainChartRootPerson && (
                    <motion.div
                      key="main-chart"
                      {...viewTransition}
                      className="w-full h-full"
                    >
                      <FamilyMainView
                        data={transformToFamilyChartData(persons, relationships)}
                        rootId={mainChartRootPerson.id}
                        rootPerson={mainChartRootPerson}
                        onSelectPerson={setSelectedPerson}
                        onAddRelationship={(id) => handleAddRelationship(id, 'child')}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for mobile detail panel */}
      <AnimatePresence>
        {selectedPerson && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSelectedPerson(null)}
          />
        )}
      </AnimatePresence>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div
            className={isMobile
              ? 'fixed inset-x-0 bottom-0 max-h-[78vh] rounded-t-3xl border-x border-t bg-card overflow-y-auto z-50 shadow-2xl'
              : 'fixed md:relative inset-y-0 right-0 w-full md:w-80 lg:w-[340px] shrink-0 border-l bg-card overflow-y-auto z-50 md:z-auto'
            }
            variants={isMobile ? undefined : panelVariants}
            initial={isMobile ? { opacity: 0, y: 48 } : 'hidden'}
            animate={isMobile ? { opacity: 1, y: 0 } : 'visible'}
            exit={isMobile ? { opacity: 0, y: 48 } : 'exit'}
            transition={isMobile ? { duration: 0.2 } : undefined}
          >
            {isMobile && <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">Detail Anggota</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedPerson(null)}
                aria-label="Tutup detail anggota"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Avatar, Name & Tags */}
              <div className="flex items-start gap-3">
                <div className={`
                w-12 h-12 shrink-0 rounded-full flex items-center justify-center overflow-hidden
                ${selectedPerson.gender === 'male' ? 'bg-node-male/20 text-node-male' :
                    selectedPerson.gender === 'female' ? 'bg-node-female/20 text-node-female' :
                      'bg-node-unknown/20 text-node-unknown'}
              `}>
                  {selectedPerson.photoUrl ? (
                    <img
                      src={selectedPerson.photoUrl}
                      alt={selectedPerson.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base leading-tight truncate" title={selectedPerson.fullName}>
                    {selectedPerson.fullName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedPerson.gender === 'male'
                      ? 'Laki-laki'
                      : selectedPerson.gender === 'female'
                        ? 'Perempuan'
                        : 'Tidak diketahui'}
                  </p>
                  {selectedPerson.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {selectedPerson.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant={tag === 'verified' ? 'secondary' : 'outline'}
                          className="text-[10px] px-2 py-0"
                        >
                          {tag === 'verified' ? 'Terverifikasi' : tag === 'needs review' ? 'Perlu Review' : tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setAddRelationshipContext({ personId: selectedPerson.id });
                    setShowAddRelationship(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tambah Relasi
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setViewMode('family')}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Fokus Keluarga
                </Button>
              </div>

              {/* Dates */}
              {(selectedPerson.birthDate || selectedPerson.deathDate) && (
                <div className="rounded-xl border border-border/60 bg-muted/25 p-2.5 space-y-1.5">
                  {selectedPerson.birthDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Lahir: {new Date(selectedPerson.birthDate).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                  {selectedPerson.deathDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Wafat: {new Date(selectedPerson.deathDate).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedPerson.notes && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Catatan</p>
                  <p className="text-xs leading-relaxed">{selectedPerson.notes}</p>
                </div>
              )}

              {/* Relationship Inspector (Already includes clickable Parent, Spouse, and Child links) */}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                    Relasi Keluarga
                  </h4>
                </div>
                <RelationshipInspector
                  personId={selectedPerson.id}
                  onPersonClick={setSelectedPerson}
                />
              </div>

              {/* Siblings (Only shown if person has siblings, avoiding duplicate Parent/Spouse/Child lists) */}
              {relatives && relatives.siblings.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Saudara Kandung ({relatives.siblings.length})
                  </p>
                  <div className="space-y-1">
                    {relatives.siblings.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPerson(p.id)}
                        className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted transition-colors"
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Relationship Dialog */}
      <Dialog open={showAddRelationship} onOpenChange={setShowAddRelationship}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Relasi Baru</DialogTitle>
            <DialogDescription>
              Buat relasi keluarga baru antara dua anggota
            </DialogDescription>
          </DialogHeader>
          <RelationshipForm
            preselectedPersonId={addRelationshipContext.personId || selectedPersonId || undefined}
            onSuccess={() => {
              setShowAddRelationship(false);
              setAddRelationshipContext({});
            }}
            onCancel={() => {
              setShowAddRelationship(false);
              setAddRelationshipContext({});
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      {showPrintDialog && (
        <Suspense fallback={null}>
          <PrintDialog
            open={showPrintDialog}
            onOpenChange={setShowPrintDialog}
            elementRef={chartRef}
            title="Silsilah Keluarga"
          />
        </Suspense>
      )}

      {/* Mini Map for navigation */}
      {showMiniMap && (
        <MiniMap
          persons={persons}
          relationships={relationships}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPerson}
          onCenterSelected={handleCenterOnSelected}
        />
      )}

      <Sheet open={showMobileSearch} onOpenChange={setShowMobileSearch}>
        <SheetContent side="top" className="rounded-b-3xl px-4 pb-6" title="Cari anggota keluarga">
          <SheetHeader className="text-left">
            <SheetTitle>Cari anggota</SheetTitle>
            <SheetDescription>Pilih anggota untuk memusatkan tampilan chart.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                type="search"
                placeholder="Cari nama anggota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-11 pl-10"
              />
            </div>

            {quickSearchResults.length > 0 ? (
              <div className="space-y-2">
                {quickSearchResults.map(({ item }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectPersonFromSearch(item.id)}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.birthDate ? new Date(item.birthDate).getFullYear() : 'Tahun tidak diketahui'}
                      </p>
                    </div>
                    <Badge variant="secondary">Pilih</Badge>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Tidak ada hasil untuk kata kunci ini.
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Mulai ketik nama anggota untuk mencari fokus chart.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showMobileControls} onOpenChange={setShowMobileControls}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8" title="Kontrol chart mobile">
          <SheetHeader className="text-left">
            <SheetTitle>Kontrol chart</SheetTitle>
            <SheetDescription>Atur mode tampilan dan aksi penting tanpa memenuhi toolbar.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            {viewMode === 'pedigree' && (
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Jumlah generasi</span>
                  <Badge variant="secondary">{pedigreeGenerations}</Badge>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={pedigreeGenerations}
                  onChange={(e) => setPedigreeGenerations(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}

            {isZoomableView && (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-11" onClick={() => handleZoom('out')}>
                  <ZoomOut className="w-4 h-4" />
                  Zoom Out
                </Button>
                <Button variant="outline" className="h-11" onClick={reset}>
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
                <Button variant="outline" className="h-11" onClick={() => handleZoom('in')}>
                  <ZoomIn className="w-4 h-4" />
                  Zoom In
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Button
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setShowPrintDialog(true);
                  setShowMobileControls(false);
                }}
                disabled={persons.length === 0}
              >
                <Printer className="w-4 h-4" />
                Cetak chart
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setShowMobileControls(false);
                  void handleExport('png');
                }}
                disabled={persons.length === 0}
              >
                <Download className="w-4 h-4" />
                Export PNG
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setAddRelationshipContext({});
                  setShowAddRelationship(true);
                  setShowMobileControls(false);
                }}
                disabled={persons.length < 2}
              >
                <Link2 className="w-4 h-4" />
                Tambah relasi
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
