import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useFamilyStore } from '@/store/familyStore';
import { formatFlexibleDate, formatShortYearLabel } from '@/lib/flexibleDateUtils';
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
  DropdownMenuLabel,
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
  Maximize2,
  Minimize2,
  Pencil,
  Crosshair,
  Sparkles,
  Scan,
  BookOpen,
  Copy,
  FileSpreadsheet,
  Compass,
  Route,
  Hourglass,
  ListTree,
  BarChart3,
  Pin,
  TreeDeciduous,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Person } from '@/types';
import { GenerationView } from '@/features/chart/views/GenerationView';
import { FamilyView } from '@/features/chart/views/FamilyView';
import { PedigreeView } from '@/features/chart/views/PedigreeView';
import { RelationshipForm } from '@/features/relationships/RelationshipForm';
import { RelationshipInspector } from '@/features/relationships/RelationshipInspector';
import {
  AddRelativeWizardDialog,
  type RelativeRole,
} from '@/features/chart/components/AddRelativeWizardDialog';
import { MiniMap } from '@/features/chart/components/MiniMap';
import {
  exportTreeAsImage,
  copyTreeToClipboard,
  type ExportFormat,
} from '@/features/chart/utils/exportTreeAsImage';
import { exportFamilyCsv } from '@/features/chart/utils/familyBookPdfExport';
import { cn } from '@/lib/utils';

const PrintDialog = lazy(() => import('@/features/chart/components/PrintDialog').then(m => ({ default: m.PrintDialog })));
const ExportStudioDialog = lazy(() => import('@/features/chart/components/ExportStudioDialog').then(m => ({ default: m.ExportStudioDialog })));
const ShareTreeDialog = lazy(() => import('@/features/chart/components/ShareTreeDialog').then(m => ({ default: m.ShareTreeDialog })));
const PersonForm = lazy(() => import('@/features/people/PersonForm').then(m => ({ default: m.PersonForm })));
const TimelineView = lazy(() => import('@/features/chart/views/TimelineView').then(m => ({ default: m.TimelineView })));
const NetworkGraphView = lazy(() => import('@/features/chart/views/NetworkGraphView').then(m => ({ default: m.NetworkGraphView })));
const GeoMapView = lazy(() => import('@/features/chart/views/GeoMapView').then(m => ({ default: m.GeoMapView })));
const SunburstView = lazy(() => import('@/features/chart/views/SunburstView').then(m => ({ default: m.SunburstView })));
const InheritanceTreeView = lazy(() => import('@/features/chart/views/InheritanceTreeView').then(m => ({ default: m.InheritanceTreeView })));
const FanChartView = lazy(() => import('@/features/chart/views/FanChartView').then(m => ({ default: m.FanChartView })));
const RelationshipPathView = lazy(() => import('@/features/chart/views/RelationshipPathView').then(m => ({ default: m.RelationshipPathView })));
const HourglassView = lazy(() => import('@/features/chart/views/HourglassView').then(m => ({ default: m.HourglassView })));
const DescendantOutlineView = lazy(() => import('@/features/chart/views/DescendantOutlineView').then(m => ({ default: m.DescendantOutlineView })));
const LifespanGanttView = lazy(() => import('@/features/chart/views/LifespanGanttView').then(m => ({ default: m.LifespanGanttView })));
const BotanicalTreeView = lazy(() => import('@/features/chart/views/BotanicalTreeView').then(m => ({ default: m.BotanicalTreeView })));


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

type ViewMode = 'family' | 'pedigree' | 'tree' | 'botanical' | 'sunburst' | 'fan' | 'hourglass' | 'outline' | 'path' | 'lifespan' | 'network' | 'timeline' | 'map' | 'dna';

export default function ChartPage() {
  const {
    persons,
    relationships,
    evidence,
    stories,
    getPersonRelatives,
    setSelectedPerson,
    selectedPersonId,
    homePersonId,
    setHomePerson,
  } = useFamilyStore();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('family');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightLineage, setHighlightLineage] = useState(false);
  const [showEditPerson, setShowEditPerson] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [showAddRelativeWizard, setShowAddRelativeWizard] = useState(false);
  const [addRelativeWizardState, setAddRelativeWizardState] = useState<{
    personId: string | null;
    initialRole?: RelativeRole | null;
  }>({ personId: null, initialRole: null });
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showExportStudio, setShowExportStudio] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showMobileViewPicker, setShowMobileViewPicker] = useState(false);
  const [addRelationshipContext, setAddRelationshipContext] = useState<{
    personId?: string;
    suggestedType?: 'parent' | 'spouse' | 'child';
  }>({});
  const chartRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom hook (used only by GenerationView 'tree')
  const maxScale = 2;
  const minScale = 0.3;
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

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isSearchOpen]);

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

  // Reset outer pan/zoom transform whenever switching away from 'tree' so other views aren't offset
  useEffect(() => {
    if (viewMode !== 'tree') {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [viewMode, setTransform]);

  const handleCopyClipboard = async () => {
    if (!chartRef.current) return;
    await copyTreeToClipboard(chartRef.current);
  };

  const handleAddRelationship = useCallback(
    (personId: string, type?: 'parent' | 'spouse' | 'child') => {
      // Open the MyHeritage-style interactive relative diagram / form
      const initialRole: RelativeRole | null =
        type === 'spouse' ? 'partner' : null;
      setAddRelativeWizardState({
        personId,
        initialRole,
      });
      setShowAddRelativeWizard(true);
    },
    []
  );

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
    { value: 'family', label: 'Keluarga', icon: Users, description: 'Pohon keluarga interaktif' },
    { value: 'pedigree', label: 'Leluhur', icon: TreePine, description: 'Silsilah leluhur ke atas' },
    { value: 'tree', label: 'Generasi', icon: Network, description: 'Semua anggota per generasi' },
    { value: 'botanical', label: 'Pohon Botanik', icon: TreeDeciduous, description: 'Ilustrasi pohon organik dengan dahan & daun' },
    { value: 'sunburst', label: 'Sunburst', icon: PieChart, description: 'Diagram melingkar keturunan & leluhur' },
    { value: 'fan', label: 'Diagram Kipas', icon: Compass, description: 'Kipas leluhur 180°/240° & slot kosong' },
    { value: 'hourglass', label: 'Jam Pasir', icon: Hourglass, description: 'Leluhur ke atas & keturunan ke bawah' },
    { value: 'outline', label: 'Bagan Trah', icon: ListTree, description: 'Daftar keturunan berjenjang (Bani/Trah)' },
    { value: 'path', label: 'Jalur Hubungan', icon: Route, description: 'Grafik kekerabatan antara 2 orang' },
    { value: 'lifespan', label: 'Rentang Hidup', icon: BarChart3, description: 'Perbandingan era & usia hidup sezaman' },
    { value: 'network', label: 'Jaringan', icon: Share2, description: 'Grafik jejaring hubungan' },
    { value: 'timeline', label: 'Linimasa', icon: Calendar, description: 'Urutan waktu kelahiran' },
    { value: 'map', label: 'Peta', icon: Map, description: 'Peta sebaran lokasi' },
    { value: 'dna', label: 'Pohon DNA', icon: Dna, description: 'Warisan genetik' },
  ];

  const currentViewOption = viewModeOptions.find(opt => opt.value === viewMode) || viewModeOptions[0];
  const CurrentViewIcon = currentViewOption.icon;
  const isZoomableView = viewMode === 'tree';
  const isFullHeightView = isZoomableView || viewMode === 'family' || viewMode === 'pedigree' || viewMode === 'botanical' || viewMode === 'sunburst' || viewMode === 'fan' || viewMode === 'hourglass' || viewMode === 'outline' || viewMode === 'path' || viewMode === 'lifespan' || viewMode === 'network' || viewMode === 'map' || viewMode === 'dna';
  const primaryViewModes = viewModeOptions.slice(0, 5);
  const secondaryViewModes = viewModeOptions.slice(5);
  const secondaryViewGroups = [
    {
      label: 'Bagan Silsilah',
      values: ['fan', 'hourglass', 'outline'],
    },
    {
      label: 'Analisis & Relasi',
      values: ['path', 'network', 'dna'],
    },
    {
      label: 'Waktu & Lokasi',
      values: ['lifespan', 'timeline', 'map'],
    },
  ].map((group) => ({
    label: group.label,
    items: group.values
      .map((val) => viewModeOptions.find((opt) => opt.value === val))
      .filter((opt): opt is (typeof viewModeOptions)[number] => Boolean(opt)),
  }));
  const showMiniMap = !isMobile && viewMode === 'tree' && persons.length >= MINIMAP_PERSON_THRESHOLD;
  const defaultFocusPersonId = useMemo(() => {
    if (selectedPersonId) return selectedPersonId;
    if (persons.length === 0) return null;
    if (homePersonId && persons.some((p) => p.id === homePersonId)) {
      return homePersonId;
    }
    // Prefer person with both parents and children (middle generation), or most relationships
    const hasParents = new Set<string>();
    const hasChildren = new Set<string>();
    const relCount = new globalThis.Map<string, number>();
    relationships.forEach((r) => {
      relCount.set(r.fromPersonId, (relCount.get(r.fromPersonId) || 0) + 1);
      relCount.set(r.toPersonId, (relCount.get(r.toPersonId) || 0) + 1);
      if (r.type === 'PARENT_CHILD') {
        hasChildren.add(r.fromPersonId);
        hasParents.add(r.toPersonId);
      }
    });
    const balanced = persons.filter((p) => hasParents.has(p.id) && hasChildren.has(p.id));
    const pool = balanced.length > 0 ? balanced : persons;
    return [...pool].sort(
      (a, b) => (relCount.get(b.id) || 0) - (relCount.get(a.id) || 0)
    )[0]?.id ?? null;
  }, [persons, relationships, selectedPersonId, homePersonId]);

  const lineageIdSet = useMemo(() => {
    if (!highlightLineage || !selectedPersonId) return null;
    return new Set(buildLineageIds(selectedPersonId));
  }, [highlightLineage, selectedPersonId, buildLineageIds]);

  const selectPersonFromSearch = useCallback((personId: string) => {
    setSelectedPerson(personId);
    setShowMobileSearch(false);
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [setSelectedPerson]);

  return (
    <div
      className={cn(
        'flex animate-fade-in',
        isFullscreen
          ? 'fixed inset-0 z-50 h-[100dvh] w-screen bg-background'
          : 'h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-3.5rem)]'
      )}
    >
      {/* Main Chart Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="relative z-30 border-b bg-card/95 backdrop-blur-sm">
          {isMobile ? (
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  className="h-9 flex-1 min-w-0 justify-between rounded-xl px-3 text-xs font-medium"
                  title={currentViewOption.description}
                  onClick={() => setShowMobileViewPicker(true)}
                >
                  <span className="flex items-center gap-2 truncate">
                    <CurrentViewIcon className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">{currentViewOption.label}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label="Cari anggota"
                  onClick={() => setShowMobileSearch(true)}
                >
                  <Search className="w-4 h-4" />
                </Button>

                <Button
                  variant={isFullscreen ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={isFullscreen ? 'Keluar layar penuh' : 'Mode layar penuh'}
                  onClick={() => setIsFullscreen((prev) => !prev)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label="Buka kontrol chart"
                  onClick={() => setShowMobileControls(true)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </div>

              {selectedPerson && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 border border-primary/25 px-2.5 py-1 text-xs">
                  <span className="truncate text-foreground font-medium">
                    Fokus: {selectedPerson.fullName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPerson(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-primary font-medium shrink-0"
                    aria-label="Lepas fokus"
                  >
                    <span>Lepas</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              {/* Left: View Switcher + Compact Meta */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-muted/35 p-0.5">
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
                        className="h-8 gap-1 rounded-lg px-2.5 text-xs"
                        title={currentViewOption.description}
                      >
                        <span>
                          {secondaryViewModes.some((o) => o.value === viewMode)
                            ? currentViewOption.label
                            : 'Lainnya'}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-popover w-64 max-h-[75vh] overflow-y-auto">
                      {secondaryViewGroups.map((group, groupIdx) => (
                        <div key={group.label}>
                          {groupIdx > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </DropdownMenuLabel>
                          {group.items.map((opt) => {
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
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <span className="hidden xl:inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                  {stats.total} anggota · {stats.generations} gen
                </span>

                {selectedPerson && (
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-foreground">
                    <span className="truncate max-w-[130px]">{selectedPerson.fullName}</span>
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
                )}
              </div>

              {/* Right: Contextual Controls + Live Autocomplete Search + Fullscreen + Actions */}
              <div className="flex items-center gap-1.5">
                {/* Lineage Spotlight Toggle (Generasi View) */}
                {viewMode === 'tree' && selectedPersonId && (
                  <Button
                    variant={highlightLineage ? 'default' : 'outline'}
                    size="sm"
                    className="hidden sm:inline-flex h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                    onClick={() => setHighlightLineage((prev) => !prev)}
                    title="Sorot leluhur & keturunan langsung dari anggota terpilih"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Sorot Jalur</span>
                  </Button>
                )}

                {/* Zoom, Fit & Center Controls for tree & pedigree */}
                {isZoomableView && (
                  <div className="flex items-center rounded-lg border border-border/70 bg-background/80">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => handleZoom('out')} title="Zoom Out" aria-label="Perkecil chart">
                      <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-none border-l sm:flex" onClick={autoFitToContent} title="Sesuaikan layar (Fit)" aria-label="Sesuaikan layar">
                      <Scan className="w-3.5 h-3.5" />
                    </Button>
                    {selectedPersonId && (
                      <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-none border-l sm:flex" onClick={handleCenterOnSelected} title="Pusatkan ke anggota terpilih" aria-label="Pusatkan ke fokus">
                        <Crosshair className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-none border-x sm:flex" onClick={reset} title="Reset Zoom (100%)" aria-label="Reset posisi chart">
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => handleZoom('in')} title="Zoom In" aria-label="Perbesar chart">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* Desktop Search with Live Autocomplete */}
                <div ref={searchBoxRef} className="relative w-44 sm:w-52 lg:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cari anggota..."
                    value={searchQuery}
                    onFocus={() => setIsSearchOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                        setIsSearchOpen(false);
                      } else if (e.key === 'Escape') {
                        setIsSearchOpen(false);
                      }
                    }}
                    className="h-8 rounded-lg border-border/70 bg-background/85 pl-8 text-xs"
                  />
                  {isSearchOpen && searchQuery.trim().length > 0 && (
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                      {quickSearchResults.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto p-1">
                          {quickSearchResults.map(({ item }) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => selectPersonFromSearch(item.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    'h-2 w-2 shrink-0 rounded-full',
                                    item.gender === 'male'
                                      ? 'bg-node-male'
                                      : item.gender === 'female'
                                        ? 'bg-node-female'
                                        : 'bg-node-unknown'
                                  )}
                                />
                                <span className="truncate font-medium text-foreground">
                                  {item.fullName}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatShortYearLabel(item.birthDate) || ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="px-3 py-2.5 text-xs text-muted-foreground">
                          Anggota tidak ditemukan
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Public Read-Only Share Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-primary/35 bg-primary/5 hover:bg-primary/10 text-primary px-2.5 text-xs font-medium"
                  onClick={() => setShowShareDialog(true)}
                  title="Bagikan tautan baca-saja pohon silsilah (dengan opsi PIN)"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Bagikan</span>
                </Button>

                {/* Fullscreen / Mode Fokus Toggle */}
                <Button
                  variant={isFullscreen ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border/70 bg-background/90"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  title={isFullscreen ? 'Keluar layar penuh (Esc)' : 'Mode layar penuh'}
                  aria-label={isFullscreen ? 'Keluar layar penuh' : 'Mode layar penuh'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-border/70 bg-background/90 px-2.5 text-xs" title="Aksi" aria-label="Buka menu aksi">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Aksi</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover w-56">
                    <DropdownMenuItem
                      onClick={() => setShowShareDialog(true)}
                      disabled={persons.length === 0}
                      className="font-medium"
                    >
                      <Share2 className="w-4 h-4 mr-2 text-primary" />
                      Tautan Baca-Saja Publik...
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowExportStudio(true)}
                      disabled={persons.length === 0}
                      className="font-medium text-primary"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Export Buku PDF (Studio)...
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { void handleCopyClipboard(); }}
                      disabled={persons.length === 0}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Salin Gambar ke Clipboard
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
                      onClick={() => exportFamilyCsv(persons, relationships)}
                      disabled={persons.length === 0}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Data CSV (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowPrintDialog(true)}
                      disabled={persons.length === 0}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Cetak Cepat
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
                isZoomableView ? 'touch-none' : isFullHeightView ? 'overflow-hidden' : 'overflow-auto',
                isZoomableView && (isDragging ? 'cursor-grabbing' : 'cursor-grab')
              )}
              ref={panZoomContainerRef}
              {...(isZoomableView ? panZoomHandlers : {})}
            >
              <div
                ref={handleChartRef}
                className={cn('w-full', isFullHeightView ? 'h-full' : 'min-h-full')}
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
                        className="w-full h-full"
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
                        className="w-full h-full"
                      >
                        <PedigreeView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId || defaultFocusPersonId}
                          onSelectPerson={setSelectedPerson}
                          onAddRelationship={(personId) => handleAddRelationship(personId, 'parent')}
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
                          highlightedPersonIds={lineageIdSet}
                          onSelectPerson={setSelectedPerson}
                        />
                      </motion.div>
                    )}
                    {viewMode === 'botanical' && (
                      <motion.div
                        key="botanical"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <BotanicalTreeView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId || defaultFocusPersonId}
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
                    {viewMode === 'fan' && (
                      <motion.div
                        key="fan"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <FanChartView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId || defaultFocusPersonId}
                          onSelectPerson={setSelectedPerson}
                          onAddRelationship={(personId) => handleAddRelationship(personId, 'parent')}
                        />
                      </motion.div>
                    )}
                    {viewMode === 'path' && (
                      <motion.div
                        key="path"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <RelationshipPathView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId || defaultFocusPersonId}
                          onSelectPerson={setSelectedPerson}
                        />
                      </motion.div>
                    )}
                    {viewMode === 'hourglass' && (
                      <motion.div
                        key="hourglass"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <HourglassView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId || defaultFocusPersonId}
                          onSelectPerson={setSelectedPerson}
                        />
                      </motion.div>
                    )}
                    {viewMode === 'outline' && (
                      <motion.div
                        key="outline"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <DescendantOutlineView
                          persons={persons}
                          relationships={relationships}
                          selectedPersonId={selectedPersonId}
                          onSelectPerson={setSelectedPerson}
                        />
                      </motion.div>
                    )}
                    {viewMode === 'lifespan' && (
                      <motion.div
                        key="lifespan"
                        {...viewTransition}
                        className="w-full h-full"
                      >
                        <LifespanGanttView
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
                  </AnimatePresence>
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Detail Panel */}
      <AnimatePresence>
        {selectedPerson && !isMobile && (
          <motion.div
            className="relative inset-y-0 right-0 w-80 lg:w-[340px] shrink-0 border-l bg-card overflow-y-auto"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">Detail Anggota</h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowEditPerson(true)}
                  title="Edit profil anggota"
                  aria-label="Edit profil anggota"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
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
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowEditPerson(true)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit Profil
                  </Button>
                  <Button
                    variant={homePersonId === selectedPerson.id ? 'default' : 'secondary'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setHomePerson(selectedPerson.id);
                      toast.success(`${selectedPerson.fullName} dijadikan Figur Utama (Saya)`);
                    }}
                    title="Jadikan anggota ini sebagai fokus utama default (Ini Saya)"
                  >
                    <Pin className="w-3.5 h-3.5 mr-1.5" />
                    {homePersonId === selectedPerson.id ? 'Ini Saya' : 'Jadikan Saya'}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleAddRelationship(selectedPerson.id, 'parent')}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Ortu
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleAddRelationship(selectedPerson.id, 'spouse')}
                  >
                    <Heart className="w-3 h-3 mr-1" />
                    Pasangan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleAddRelationship(selectedPerson.id, 'child')}
                  >
                    <Baby className="w-3 h-3 mr-1" />
                    Anak
                  </Button>
                </div>
              </div>

              {/* Dates */}
              {(selectedPerson.birthDate || selectedPerson.deathDate) && (
                <div className="rounded-xl border border-border/60 bg-muted/25 p-2.5 space-y-1.5">
                  {selectedPerson.birthDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Lahir: {formatFlexibleDate(selectedPerson.birthDate)}</span>
                    </div>
                  )}
                  {selectedPerson.deathDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Wafat: {formatFlexibleDate(selectedPerson.deathDate)}</span>
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

              {/* Relationship Inspector */}
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

              {/* Siblings */}
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

      {/* Mobile Swipe-to-Dismiss Detail Drawer */}
      <Drawer
        open={Boolean(selectedPerson && isMobile)}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null);
        }}
      >
        <DrawerContent className="max-h-[82dvh] rounded-t-3xl safe-area-pb">
          {selectedPerson && (
            <>
              <DrawerHeader className="px-4 py-2.5 border-b text-left flex flex-row items-center justify-between space-y-0">
                <div>
                  <DrawerTitle className="font-display text-base">Detail Anggota</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    Informasi profil dan relasi keluarga
                  </DrawerDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setShowEditPerson(true)}
                    aria-label="Edit profil anggota"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setSelectedPerson(null)}
                    aria-label="Tutup detail anggota"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DrawerHeader>

              <div className="overflow-y-auto p-4 space-y-4">
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
                    <h3 className="font-semibold text-base leading-tight truncate">
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
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => setShowEditPerson(true)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit Profil
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => setViewMode('family')}
                    >
                      <Users className="w-3.5 h-3.5 mr-1.5" />
                      Fokus Keluarga
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2 text-xs"
                      onClick={() => handleAddRelationship(selectedPerson.id, 'parent')}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Ortu
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2 text-xs"
                      onClick={() => handleAddRelationship(selectedPerson.id, 'spouse')}
                    >
                      <Heart className="w-3.5 h-3.5 mr-1" />
                      Pasangan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2 text-xs"
                      onClick={() => handleAddRelationship(selectedPerson.id, 'child')}
                    >
                      <Baby className="w-3.5 h-3.5 mr-1" />
                      Anak
                    </Button>
                  </div>
                </div>

                {/* Dates */}
                {(selectedPerson.birthDate || selectedPerson.deathDate) && (
                  <div className="rounded-xl border border-border/60 bg-muted/25 p-3 space-y-1.5">
                    {selectedPerson.birthDate && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>Lahir: {formatFlexibleDate(selectedPerson.birthDate)}</span>
                      </div>
                    )}
                    {selectedPerson.deathDate && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>Wafat: {formatFlexibleDate(selectedPerson.deathDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selectedPerson.notes && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Catatan</p>
                    <p className="text-xs leading-relaxed">{selectedPerson.notes}</p>
                  </div>
                )}

                {/* Relationship Inspector */}
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

                {/* Siblings */}
                {relatives && relatives.siblings.length > 0 && (
                  <div className="space-y-2 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Saudara Kandung ({relatives.siblings.length})
                    </p>
                    <div className="space-y-1.5">
                      {relatives.siblings.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPerson(p.id)}
                          className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-border/50 bg-background/60 hover:bg-muted transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* MyHeritage-style Add Relative Diagram & Quick Form Dialog */}
      <AddRelativeWizardDialog
        open={showAddRelativeWizard}
        onOpenChange={setShowAddRelativeWizard}
        anchorPersonId={
          addRelativeWizardState.personId || selectedPersonId || defaultFocusPersonId
        }
        initialRole={addRelativeWizardState.initialRole}
        onOpenManualLinkDialog={() => {
          setAddRelationshipContext({
            personId:
              addRelativeWizardState.personId || selectedPersonId || undefined,
          });
          setShowAddRelationship(true);
        }}
      />

      {/* Manual Link Existing Relationship Dialog */}
      <Dialog open={showAddRelationship} onOpenChange={setShowAddRelationship}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Relasi Baru</DialogTitle>
            <DialogDescription>
              Buat relasi keluarga baru antara dua anggota
            </DialogDescription>
          </DialogHeader>
          <RelationshipForm
            key={`${addRelationshipContext.personId || selectedPersonId || 'none'}-${addRelationshipContext.suggestedType || 'default'}`}
            preselectedPersonId={addRelationshipContext.personId || selectedPersonId || undefined}
            suggestedType={addRelationshipContext.suggestedType}
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

      {/* Edit Person Dialog */}
      <Dialog open={showEditPerson} onOpenChange={setShowEditPerson}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profil Anggota</DialogTitle>
            <DialogDescription>
              Perbarui informasi anggota keluarga secara langsung dari tampilan silsilah
            </DialogDescription>
          </DialogHeader>
          {selectedPerson && (
            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Memuat formulir...
                </div>
              }
            >
              <PersonForm
                key={selectedPerson.id}
                person={selectedPerson}
                onSuccess={() => setShowEditPerson(false)}
              />
            </Suspense>
          )}
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

      {/* Public Read-Only Share Tree Dialog */}
      {showShareDialog && (
        <Suspense fallback={null}>
          <ShareTreeDialog
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
          />
        </Suspense>
      )}

      {/* Export Studio Dialog (Multi-page Family Book PDF + Quick Exports) */}
      {showExportStudio && (
        <Suspense fallback={null}>
          <ExportStudioDialog
            open={showExportStudio}
            onOpenChange={setShowExportStudio}
            chartElementRef={chartRef}
            viewLabel={currentViewOption.label}
            selectedPersonName={selectedPerson?.fullName}
            selectedPersonId={selectedPersonId}
            persons={persons}
            relationships={relationships}
            evidence={evidence}
            stories={stories}
            generationsCount={stats.generations}
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
                        {formatShortYearLabel(item.birthDate) || 'Tahun tidak diketahui'}
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

      {/* Mobile View Mode Picker Bottom Drawer */}
      <Drawer open={showMobileViewPicker} onOpenChange={setShowMobileViewPicker}>
        <DrawerContent className="max-h-[82dvh] rounded-t-3xl safe-area-pb">
          <DrawerHeader className="px-4 pt-2 pb-2 text-left border-b">
            <DrawerTitle className="font-display text-base">Pilih Mode Tampilan</DrawerTitle>
            <DrawerDescription className="text-xs">
              {stats.total} anggota · {stats.generations} generasi
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4 space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Utama
              </p>
              <div className="grid grid-cols-2 gap-2">
                {primaryViewModes.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = viewMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setViewMode(opt.value as ViewMode);
                        setShowMobileViewPicker(false);
                      }}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors active:scale-[0.98]',
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-card border-border/70 text-foreground hover:bg-accent/50'
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <Icon className="w-4 h-4 shrink-0" />
                        {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <span className="text-xs font-semibold leading-tight mt-0.5">{opt.label}</span>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {secondaryViewGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = viewMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setViewMode(opt.value as ViewMode);
                          setShowMobileViewPicker(false);
                        }}
                        className={cn(
                          'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors active:scale-[0.98]',
                          isActive
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'bg-card border-border/70 text-foreground hover:bg-accent/50'
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <Icon className="w-4 h-4 shrink-0" />
                          {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <span className="text-xs font-semibold leading-tight mt-0.5">{opt.label}</span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Sheet open={showMobileControls} onOpenChange={setShowMobileControls}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 safe-area-pb" title="Kontrol chart mobile">
          <SheetHeader className="text-left">
            <SheetTitle>Kontrol chart</SheetTitle>
            <SheetDescription>Atur mode tampilan dan aksi penting tanpa memenuhi toolbar.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
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
                variant="secondary"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setShowMobileControls(false);
                  setShowShareDialog(true);
                }}
                disabled={persons.length === 0}
              >
                <Share2 className="w-4 h-4" />
                Tautan Baca-Saja Publik (PIN)
              </Button>
              <Button
                variant="default"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setShowMobileControls(false);
                  setShowExportStudio(true);
                }}
                disabled={persons.length === 0}
              >
                <BookOpen className="w-4 h-4" />
                Export Buku PDF (Studio)
              </Button>
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
