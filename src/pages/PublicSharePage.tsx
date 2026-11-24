import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { usePanZoom } from '@/hooks/usePanZoom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  getPublicShareMeta,
  unlockPublicShare,
  type PublicShareMeta,
} from '@/storage/supabase/shareQueries';
import type { Person, PublicSharePayload, Relationship } from '@/types';
import {
  formatFlexibleDate,
  formatShortYearLabel,
  getEstimatedYear,
} from '@/lib/flexibleDateUtils';
import { GenerationView } from '@/features/chart/views/GenerationView';
import { FamilyView } from '@/features/chart/views/FamilyView';
import { PedigreeView } from '@/features/chart/views/PedigreeView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Network,
  TreePine,
  RotateCcw,
  ChevronDown,
  Check,
  Share2,
  Map,
  PieChart,
  Dna,
  Maximize2,
  Minimize2,
  Crosshair,
  Sparkles,
  Scan,
  Compass,
  Route,
  Hourglass,
  ListTree,
  BarChart3,
  Lock,
  Loader2,
  AlertCircle,
  Eye,
  MapPin,
  UserPlus,
  ShieldCheck,
  Moon,
  Sun,
  TreeDeciduous,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TimelineView = lazy(() =>
  import('@/features/chart/views/TimelineView').then((m) => ({ default: m.TimelineView }))
);
const NetworkGraphView = lazy(() =>
  import('@/features/chart/views/NetworkGraphView').then((m) => ({ default: m.NetworkGraphView }))
);
const GeoMapView = lazy(() =>
  import('@/features/chart/views/GeoMapView').then((m) => ({ default: m.GeoMapView }))
);
const SunburstView = lazy(() =>
  import('@/features/chart/views/SunburstView').then((m) => ({ default: m.SunburstView }))
);
const InheritanceTreeView = lazy(() =>
  import('@/features/chart/views/InheritanceTreeView').then((m) => ({
    default: m.InheritanceTreeView,
  }))
);
const FanChartView = lazy(() =>
  import('@/features/chart/views/FanChartView').then((m) => ({ default: m.FanChartView }))
);
const RelationshipPathView = lazy(() =>
  import('@/features/chart/views/RelationshipPathView').then((m) => ({
    default: m.RelationshipPathView,
  }))
);
const HourglassView = lazy(() =>
  import('@/features/chart/views/HourglassView').then((m) => ({ default: m.HourglassView }))
);
const DescendantOutlineView = lazy(() =>
  import('@/features/chart/views/DescendantOutlineView').then((m) => ({
    default: m.DescendantOutlineView,
  }))
);
const LifespanGanttView = lazy(() =>
  import('@/features/chart/views/LifespanGanttView').then((m) => ({
    default: m.LifespanGanttView,
  }))
);
const BotanicalTreeView = lazy(() =>
  import('@/features/chart/views/BotanicalTreeView').then((m) => ({
    default: m.BotanicalTreeView,
  }))
);

type ViewMode =
  | 'family'
  | 'pedigree'
  | 'tree'
  | 'botanical'
  | 'sunburst'
  | 'fan'
  | 'hourglass'
  | 'outline'
  | 'path'
  | 'lifespan'
  | 'network'
  | 'timeline'
  | 'map'
  | 'dna';

const viewTransition = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

function computeRelatives(
  personId: string,
  persons: Person[],
  relationships: Relationship[]
): {
  parents: Person[];
  children: Person[];
  spouses: Person[];
  siblings: Person[];
} {
  const parentIds = relationships
    .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === personId)
    .map((r) => r.fromPersonId);
  const parents = persons.filter((p) => parentIds.includes(p.id));

  const childIds = relationships
    .filter((r) => r.type === 'PARENT_CHILD' && r.fromPersonId === personId)
    .map((r) => r.toPersonId);
  const children = persons.filter((p) => childIds.includes(p.id));

  const spouseIds = relationships
    .filter(
      (r) => r.type === 'SPOUSE' && (r.fromPersonId === personId || r.toPersonId === personId)
    )
    .map((r) => (r.fromPersonId === personId ? r.toPersonId : r.fromPersonId));
  const spouses = persons.filter((p) => spouseIds.includes(p.id));

  const siblingIds = new Set<string>();
  for (const parentId of parentIds) {
    relationships
      .filter(
        (r) =>
          r.type === 'PARENT_CHILD' && r.fromPersonId === parentId && r.toPersonId !== personId
      )
      .forEach((r) => siblingIds.add(r.toPersonId));
  }
  const siblings = persons.filter((p) => siblingIds.has(p.id));

  return { parents, children, spouses, siblings };
}

export default function PublicSharePage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const isMobile = useIsMobile();

  const [meta, setMeta] = useState<PublicShareMeta | null>(null);
  const [payload, setPayload] = useState<PublicSharePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('family');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileViewPicker, setShowMobileViewPicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightLineage, setHighlightLineage] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  const chartRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

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

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  // Load share metadata and auto-unlock if no PIN is required (or if PIN is cached in sessionStorage)
  useEffect(() => {
    async function initShare() {
      if (!shareCode) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotFound(false);
      setPinError(null);

      try {
        const metaData = await getPublicShareMeta(shareCode);
        if (!metaData) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        setMeta(metaData);

        const cachedPin =
          typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem(`silsilah-pin-${shareCode}`) || undefined
            : undefined;

        if (!metaData.hasPin || cachedPin) {
          const res = await unlockPublicShare(shareCode, cachedPin);
          if (res.status === 'ok') {
            setPayload(res.payload);
            if (res.payload.share.rootPersonId) {
              setSelectedPersonId(res.payload.share.rootPersonId);
            }
          } else if (res.status === 'not_found') {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.error('Error loading public share:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    initShare();
  }, [shareCode]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCode) return;
    if (!pinInput.trim()) {
      setPinError('Masukkan kode PIN terlebih dahulu');
      return;
    }

    setIsUnlocking(true);
    setPinError(null);
    try {
      const res = await unlockPublicShare(shareCode, pinInput.trim());
      if (res.status === 'ok') {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`silsilah-pin-${shareCode}`, pinInput.trim());
        }
        setPayload(res.payload);
        if (res.payload.share.rootPersonId) {
          setSelectedPersonId(res.payload.share.rootPersonId);
        }
      } else if (res.status === 'invalid_pin') {
        setPinError('Kode PIN tidak sesuai. Silakan coba lagi.');
      } else {
        setNotFound(true);
      }
    } catch {
      setPinError('Terjadi kesalahan saat memeriksa kode PIN');
    } finally {
      setIsUnlocking(false);
    }
  };

  const persons = useMemo(() => payload?.persons || [], [payload]);
  const relationships = useMemo(() => payload?.relationships || [], [payload]);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId) || null,
    [persons, selectedPersonId]
  );

  const relatives = useMemo(
    () =>
      selectedPersonId ? computeRelatives(selectedPersonId, persons, relationships) : null,
    [selectedPersonId, persons, relationships]
  );

  const defaultFocusPersonId = useMemo(() => {
    if (selectedPersonId) return selectedPersonId;
    if (payload?.share.rootPersonId && persons.some((p) => p.id === payload.share.rootPersonId)) {
      return payload.share.rootPersonId;
    }
    if (persons.length === 0) return null;
    const relCount = new globalThis.Map<string, number>();
    relationships.forEach((r) => {
      relCount.set(r.fromPersonId, (relCount.get(r.fromPersonId) || 0) + 1);
      relCount.set(r.toPersonId, (relCount.get(r.toPersonId) || 0) + 1);
    });
    return (
      [...persons].sort((a, b) => (relCount.get(b.id) || 0) - (relCount.get(a.id) || 0))[0]?.id ??
      null
    );
  }, [persons, relationships, selectedPersonId, payload]);

  const fuse = useMemo(
    () =>
      new Fuse(persons, {
        keys: ['fullName', 'birthPlace', 'residence'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [persons]
  );

  const quickSearchResults = useMemo(
    () => (searchQuery ? fuse.search(searchQuery).slice(0, 6) : []),
    [fuse, searchQuery]
  );

  const selectPersonFromSearch = useCallback((personId: string) => {
    setSelectedPersonId(personId);
    setShowMobileSearch(false);
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

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

  useEffect(() => {
    if (viewMode !== 'tree') {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [viewMode, setTransform]);

  const handleChartRef = useCallback(
    (node: HTMLDivElement | null) => {
      chartRef.current = node;
      setContentRef(node);
    },
    [setContentRef]
  );

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

      const scale =
        Math.min(containerRect.width / contentWidth, containerRect.height / contentHeight) * 0.9;

      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      const centerX = (minLeft + maxRight) / 2 - containerRect.left;
      const centerY = (minTop + maxBottom) / 2 - containerRect.top;

      const nextX = containerRect.width / 2 - centerX * clampedScale;
      const nextY = containerRect.height / 2 - centerY * clampedScale;

      setTransform({ x: nextX, y: nextY, scale: clampedScale });
    });
  }, [maxScale, minScale, setTransform, panZoomContainerRef]);

  const buildLineageIds = useCallback(
    (personId: string | null) => {
      if (!personId) return [];
      const parentsByChild = new globalThis.Map<string, string[]>();
      const childrenByParent = new globalThis.Map<string, string[]>();

      relationships.forEach((rel) => {
        if (rel.type !== 'PARENT_CHILD') return;
        if (!parentsByChild.has(rel.toPersonId)) parentsByChild.set(rel.toPersonId, []);
        parentsByChild.get(rel.toPersonId)!.push(rel.fromPersonId);

        if (!childrenByParent.has(rel.fromPersonId)) childrenByParent.set(rel.fromPersonId, []);
        childrenByParent.get(rel.fromPersonId)!.push(rel.toPersonId);
      });

      const visited = new Set<string>([personId]);
      const ancStack = [personId];
      while (ancStack.length > 0) {
        const curr = ancStack.pop()!;
        (parentsByChild.get(curr) || []).forEach((pid) => {
          if (!visited.has(pid)) {
            visited.add(pid);
            ancStack.push(pid);
          }
        });
      }

      const descStack = [personId];
      while (descStack.length > 0) {
        const curr = descStack.pop()!;
        (childrenByParent.get(curr) || []).forEach((cid) => {
          if (!visited.has(cid)) {
            visited.add(cid);
            descStack.push(cid);
          }
        });
      }

      return Array.from(visited);
    },
    [relationships]
  );

  const lineageIdSet = useMemo(() => {
    if (!highlightLineage || !selectedPersonId) return null;
    return new Set(buildLineageIds(selectedPersonId));
  }, [highlightLineage, selectedPersonId, buildLineageIds]);

  const viewModeOptions = [
    { value: 'family', label: 'Keluarga', icon: Users, description: 'Pohon keluarga interaktif' },
    { value: 'pedigree', label: 'Leluhur', icon: TreePine, description: 'Silsilah leluhur ke atas' },
    { value: 'tree', label: 'Generasi', icon: Network, description: 'Semua anggota per generasi' },
    { value: 'botanical', label: 'Pohon Botanik', icon: TreeDeciduous, description: 'Ilustrasi pohon organik dengan dahan & daun' },
    { value: 'sunburst', label: 'Sunburst', icon: PieChart, description: 'Diagram melingkar keturunan & leluhur' },
    { value: 'fan', label: 'Diagram Kipas', icon: Compass, description: 'Kipas leluhur 180°/240°' },
    { value: 'hourglass', label: 'Jam Pasir', icon: Hourglass, description: 'Leluhur ke atas & keturunan ke bawah' },
    { value: 'outline', label: 'Bagan Trah', icon: ListTree, description: 'Daftar keturunan berjenjang (Bani/Trah)' },
    { value: 'path', label: 'Jalur Hubungan', icon: Route, description: 'Grafik kekerabatan antara 2 orang' },
    { value: 'lifespan', label: 'Rentang Hidup', icon: BarChart3, description: 'Perbandingan era & usia hidup sezaman' },
    { value: 'network', label: 'Jaringan', icon: Share2, description: 'Grafik jejaring hubungan' },
    { value: 'timeline', label: 'Linimasa', icon: Calendar, description: 'Urutan waktu kelahiran' },
    { value: 'map', label: 'Peta', icon: Map, description: 'Peta sebaran lokasi' },
    { value: 'dna', label: 'Pohon DNA', icon: Dna, description: 'Warisan genetik' },
  ];

  const currentViewOption =
    viewModeOptions.find((opt) => opt.value === viewMode) || viewModeOptions[0];
  const CurrentViewIcon = currentViewOption.icon;
  const isZoomableView = viewMode === 'tree';
  const isFullHeightView =
    isZoomableView ||
    viewMode === 'family' ||
    viewMode === 'pedigree' ||
    viewMode === 'botanical' ||
    viewMode === 'sunburst' ||
    viewMode === 'fan' ||
    viewMode === 'hourglass' ||
    viewMode === 'outline' ||
    viewMode === 'path' ||
    viewMode === 'lifespan' ||
    viewMode === 'network' ||
    viewMode === 'map' ||
    viewMode === 'dna';

  const primaryViewModes = viewModeOptions.slice(0, 5);
  const secondaryViewModes = viewModeOptions.slice(5);
  const secondaryViewGroups = [
    { label: 'Bagan Silsilah', values: ['fan', 'hourglass', 'outline'] },
    { label: 'Analisis & Relasi', values: ['path', 'network', 'dna'] },
    { label: 'Waktu & Lokasi', values: ['lifespan', 'timeline', 'map'] },
  ].map((group) => ({
    label: group.label,
    items: group.values
      .map((val) => viewModeOptions.find((opt) => opt.value === val))
      .filter((opt): opt is (typeof viewModeOptions)[number] => Boolean(opt)),
  }));

  const formatBirthDisplay = (person: Person) => {
    if (!person.birthDate) return null;
    const isLiving = !person.deathDate;
    if (payload?.share.hideLivingDetails && isLiving) {
      const y = getEstimatedYear(person.birthDate);
      return y === null ? null : `Tahun ${y}`;
    }
    return formatFlexibleDate(person.birthDate);
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat pohon silsilah keluarga...</p>
        </div>
      </div>
    );
  }

  if (notFound || !meta) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 sm:p-8 text-center rounded-2xl space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <h1 className="text-xl font-display font-bold">Tautan Tidak Ditemukan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tautan silsilah ini tidak ditemukan atau sedang dinonaktifkan oleh pengelola keluarga.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // PIN Gate Screen
  if (!payload) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/10 via-background to-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 sm:p-8 rounded-3xl shadow-lg border-border/80 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="w-7 h-7" />
            </div>
            <Badge variant="secondary" className="text-[11px]">
              Tautan Silsilah Terproteksi
            </Badge>
            <h1 className="text-2xl font-display font-bold text-foreground">{meta.title}</h1>
            {meta.description && (
              <p className="text-xs sm:text-sm text-muted-foreground">{meta.description}</p>
            )}
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="pin-code-input" className="text-xs font-medium text-foreground">
                Masukkan Kode Akses / PIN Keluarga
              </label>
              <Input
                id="pin-code-input"
                type="password"
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="Ketik kode PIN..."
                className="h-11 text-center font-mono text-base tracking-widest"
              />
              {pinError && <p className="text-xs text-destructive text-center">{pinError}</p>}
            </div>

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isUnlocking}>
              {isUnlocking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memeriksa PIN...
                </>
              ) : (
                'Buka Pohon Silsilah'
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const renderPersonDetailContent = (person: Person) => {
    const birthLabel = formatBirthDisplay(person);
    const deathLabel = formatFlexibleDate(person.deathDate);

    return (
      <div className="p-4 space-y-4">
        {/* Avatar & Name */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-12 h-12 shrink-0 rounded-full flex items-center justify-center overflow-hidden',
              person.gender === 'male'
                ? 'bg-node-male/20 text-node-male'
                : person.gender === 'female'
                  ? 'bg-node-female/20 text-node-female'
                  : 'bg-node-unknown/20 text-node-unknown'
            )}
          >
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base leading-tight" title={person.fullName}>
              {person.fullName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {person.gender === 'male'
                ? 'Laki-laki'
                : person.gender === 'female'
                  ? 'Perempuan'
                  : 'Tidak diketahui'}
            </p>
            {person.tags.includes('verified') && (
              <Badge variant="secondary" className="mt-1.5 text-[10px] px-2 py-0">
                Terverifikasi
              </Badge>
            )}
          </div>
        </div>

        {/* Focus action */}
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setViewMode('family')}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Jadikan Pusat Pohon Keluarga
        </Button>

        {/* Dates & Places */}
        {(birthLabel || deathLabel || person.birthPlace || person.residence) && (
          <div className="rounded-xl border border-border/60 bg-muted/25 p-3 space-y-1.5 text-xs">
            {birthLabel && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Lahir: {birthLabel}</span>
              </div>
            )}
            {person.birthPlace && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Tempat lahir: {person.birthPlace}</span>
              </div>
            )}
            {person.residence && !person.deathDate && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Domisili: {person.residence}</span>
              </div>
            )}
            {deathLabel && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>
                  Wafat: {deathLabel}
                  {person.deathPlace ? ` (${person.deathPlace})` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {person.notes && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Catatan Keluarga</p>
            <p className="text-xs leading-relaxed">{person.notes}</p>
          </div>
        )}

        {/* Read-Only Relatives Lists */}
        {relatives && (
          <div className="space-y-3 pt-2 border-t">
            {relatives.parents.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Orang Tua
                </p>
                <div className="space-y-1">
                  {relatives.parents.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonId(p.id)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted transition-colors font-medium"
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatives.spouses.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-pink-500" /> Pasangan
                </p>
                <div className="space-y-1">
                  {relatives.spouses.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonId(p.id)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted transition-colors font-medium"
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatives.children.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Baby className="w-3.5 h-3.5 text-primary" /> Anak ({relatives.children.length})
                </p>
                <div className="space-y-1">
                  {relatives.children.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonId(p.id)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted transition-colors font-medium"
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatives.siblings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Saudara Kandung ({relatives.siblings.length})
                </p>
                <div className="space-y-1">
                  {relatives.siblings.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonId(p.id)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted transition-colors"
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-background">
      {/* Top Read-Only Header Banner */}
      {!isFullscreen && (
        <header className="shrink-0 border-b bg-card/95 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <TreePine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-sm sm:text-base truncate">
                  {payload.share.title}
                </h1>
                <Badge variant="secondary" className="text-[10px] px-2 py-0 shrink-0">
                  <Eye className="w-3 h-3 mr-1" />
                  Baca-Saja
                </Badge>
                {payload.share.hideLivingDetails && (
                  <Badge
                    variant="outline"
                    className="hidden md:inline-flex text-[10px] px-2 py-0 shrink-0"
                    title="Detail tanggal lahir lengkap dan catatan pribadi anggota masih hidup disamarkan"
                  >
                    <ShieldCheck className="w-3 h-3 mr-1 text-primary" />
                    Privasi Aktif
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {payload.share.description ||
                  `${persons.length} anggota keluarga · Jelajahi pohon silsilah interaktif`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {payload.share.branchCode && (
              <Button asChild size="sm" variant="default" className="h-8 text-xs gap-1.5">
                <Link to={`/submit/${payload.share.branchCode}`}>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Usulkan Data Keluarga</span>
                  <span className="sm:hidden">Isi Data</span>
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={toggleTheme}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>
      )}

      {/* Main Interactive Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="border-b bg-card/90 backdrop-blur-sm">
            {isMobile ? (
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    className="h-9 flex-1 min-w-0 justify-between rounded-xl px-3 text-xs font-medium"
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
                    onClick={() => setIsFullscreen((prev) => !prev)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {selectedPerson && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 border border-primary/25 px-2.5 py-1 text-xs">
                    <span className="truncate text-foreground font-medium">
                      Fokus: {selectedPerson.fullName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPersonId(null)}
                      className="inline-flex items-center gap-1 text-[11px] text-primary font-medium shrink-0"
                    >
                      <span>Lepas</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                {/* Left: View Switcher */}
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
                          variant={
                            secondaryViewModes.some((o) => o.value === viewMode)
                              ? 'default'
                              : 'ghost'
                          }
                          size="sm"
                          className="h-8 gap-1 rounded-lg px-2.5 text-xs"
                        >
                          <span>
                            {secondaryViewModes.some((o) => o.value === viewMode)
                              ? currentViewOption.label
                              : 'Tampilan Lainnya'}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="bg-popover w-64 max-h-[75vh] overflow-y-auto"
                      >
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
                                  <Icon
                                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                                      isActive ? 'text-primary' : ''
                                    }`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className={`font-medium ${isActive ? 'text-primary' : ''}`}
                                    >
                                      {opt.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {opt.description}
                                    </div>
                                  </div>
                                  {isActive && (
                                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <span className="hidden lg:inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {persons.length} anggota
                  </span>

                  {selectedPerson && (
                    <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-foreground">
                      <span className="truncate max-w-[140px]">{selectedPerson.fullName}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPersonId(null)}
                        className="rounded-full p-0.5 hover:bg-primary/20 text-muted-foreground hover:text-foreground"
                        title="Lepas fokus"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>

                {/* Right: Search + Zoom + Fullscreen */}
                <div className="flex items-center gap-1.5">
                  {viewMode === 'tree' && selectedPersonId && (
                    <Button
                      variant={highlightLineage ? 'default' : 'outline'}
                      size="sm"
                      className="hidden sm:inline-flex h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                      onClick={() => setHighlightLineage((prev) => !prev)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">Sorot Jalur</span>
                    </Button>
                  )}

                  {isZoomableView && (
                    <div className="flex items-center rounded-lg border border-border/70 bg-background/80">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-r-none"
                        onClick={zoomOut}
                        title="Perkecil"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden h-8 w-8 rounded-none border-l sm:flex"
                        onClick={autoFitToContent}
                        title="Sesuaikan layar"
                      >
                        <Scan className="w-3.5 h-3.5" />
                      </Button>
                      {selectedPersonId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hidden h-8 w-8 rounded-none border-l sm:flex"
                          onClick={handleCenterOnSelected}
                          title="Pusatkan ke anggota terpilih"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden h-8 w-8 rounded-none border-x sm:flex"
                        onClick={reset}
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-l-none"
                        onClick={zoomIn}
                        title="Perbesar"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Live Search */}
                  <div ref={searchBoxRef} className="relative w-44 sm:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Cari nama kerabat..."
                      value={searchQuery}
                      onFocus={() => setIsSearchOpen(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      className="h-8 rounded-lg border-border/70 bg-background/85 pl-8 text-xs"
                    />
                    {isSearchOpen && searchQuery.trim().length > 0 && (
                      <div className="absolute right-0 top-full z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-lg">
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

                  <Button
                    variant={isFullscreen ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 rounded-lg border-border/70 bg-background/90"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    title={isFullscreen ? 'Keluar layar penuh' : 'Mode layar penuh'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Chart Canvas */}
          <div className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.38))]">
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:36px_36px]" />
            {persons.length === 0 ? (
              <div className="empty-state relative h-full">
                <GitBranch className="empty-state-icon" />
                <h3 className="text-lg font-medium mb-1">Belum ada anggota dalam cakupan ini</h3>
              </div>
            ) : (
              <div
                className={cn(
                  'relative w-full h-full overflow-hidden',
                  isZoomableView
                    ? 'touch-none'
                    : isFullHeightView
                      ? 'overflow-hidden'
                      : 'overflow-auto',
                  isZoomableView && (isDragging ? 'cursor-grabbing' : 'cursor-grab')
                )}
                ref={panZoomContainerRef}
                {...(isZoomableView ? panZoomHandlers : {})}
              >
                <div
                  ref={handleChartRef}
                  className={cn('w-full', isFullHeightView ? 'h-full' : 'min-h-full')}
                  style={{ minHeight: '100%', willChange: 'transform' }}
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
                        <motion.div key="family" {...viewTransition} className="w-full h-full">
                          <FamilyView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                            readOnly
                          />
                        </motion.div>
                      )}
                      {viewMode === 'pedigree' && (
                        <motion.div key="pedigree" {...viewTransition} className="w-full h-full">
                          <PedigreeView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'tree' && (
                        <motion.div key="tree" {...viewTransition}>
                          <GenerationView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId}
                            highlightedPersonIds={lineageIdSet}
                            onSelectPerson={setSelectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'botanical' && (
                        <motion.div key="botanical" {...viewTransition} className="w-full h-full">
                          <BotanicalTreeView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                            readOnly
                          />
                        </motion.div>
                      )}
                      {viewMode === 'timeline' && (
                        <motion.div
                          key="timeline"
                          {...viewTransition}
                          className="w-full h-full overflow-y-auto bg-background"
                        >
                          <TimelineView persons={persons} onSelectPerson={setSelectedPersonId} />
                        </motion.div>
                      )}
                      {viewMode === 'network' && (
                        <motion.div key="network" {...viewTransition} className="w-full h-full">
                          <NetworkGraphView
                            persons={persons}
                            relationships={relationships}
                            onSelectPerson={setSelectedPersonId}
                            selectedPersonId={selectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'map' && (
                        <motion.div key="map" {...viewTransition} className="w-full h-full">
                          <GeoMapView persons={persons} onSelectPerson={setSelectedPersonId} />
                        </motion.div>
                      )}
                      {viewMode === 'sunburst' && (
                        <motion.div key="sunburst" {...viewTransition} className="w-full h-full">
                          <SunburstView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId}
                            onSelectPerson={setSelectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'fan' && (
                        <motion.div key="fan" {...viewTransition} className="w-full h-full">
                          <FanChartView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                            readOnly
                          />
                        </motion.div>
                      )}
                      {viewMode === 'path' && (
                        <motion.div key="path" {...viewTransition} className="w-full h-full">
                          <RelationshipPathView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                            readOnly
                          />
                        </motion.div>
                      )}
                      {viewMode === 'hourglass' && (
                        <motion.div key="hourglass" {...viewTransition} className="w-full h-full">
                          <HourglassView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId || defaultFocusPersonId}
                            onSelectPerson={setSelectedPersonId}
                            readOnly
                          />
                        </motion.div>
                      )}
                      {viewMode === 'outline' && (
                        <motion.div key="outline" {...viewTransition} className="w-full h-full">
                          <DescendantOutlineView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId}
                            onSelectPerson={setSelectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'lifespan' && (
                        <motion.div key="lifespan" {...viewTransition} className="w-full h-full">
                          <LifespanGanttView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId}
                            onSelectPerson={setSelectedPersonId}
                          />
                        </motion.div>
                      )}
                      {viewMode === 'dna' && (
                        <motion.div key="dna" {...viewTransition} className="w-full h-full">
                          <InheritanceTreeView
                            persons={persons}
                            relationships={relationships}
                            selectedPersonId={selectedPersonId}
                            onSelectPerson={setSelectedPersonId}
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

        {/* Desktop Read-Only Detail Side Panel */}
        <AnimatePresence>
          {selectedPerson && !isMobile && (
            <motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="w-80 lg:w-[330px] shrink-0 border-l bg-card overflow-y-auto"
            >
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-display font-semibold text-sm">Profil Anggota</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedPersonId(null)}
                  aria-label="Tutup profil"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {renderPersonDetailContent(selectedPerson)}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Detail Drawer */}
      <Drawer
        open={Boolean(selectedPerson && isMobile)}
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
      >
        <DrawerContent className="max-h-[82dvh] rounded-t-3xl safe-area-pb">
          {selectedPerson && (
            <>
              <DrawerHeader className="px-4 py-2.5 border-b text-left flex flex-row items-center justify-between space-y-0">
                <div>
                  <DrawerTitle className="font-display text-base">Profil Anggota</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    Detail informasi anggota keluarga
                  </DrawerDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedPersonId(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DrawerHeader>
              <div className="overflow-y-auto">{renderPersonDetailContent(selectedPerson)}</div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Mobile Search Sheet */}
      <Sheet open={showMobileSearch} onOpenChange={setShowMobileSearch}>
        <SheetContent side="top" className="rounded-b-3xl px-4 pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>Cari Kerabat</SheetTitle>
            <SheetDescription>Ketik nama untuk memusatkan tampilan pohon silsilah.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                type="search"
                placeholder="Cari nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
            {quickSearchResults.length > 0 && (
              <div className="space-y-2">
                {quickSearchResults.map(({ item }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectPersonFromSearch(item.id)}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatShortYearLabel(item.birthDate) || '—'}
                      </p>
                    </div>
                    <Badge variant="secondary">Pilih</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile View Picker Drawer */}
      <Drawer open={showMobileViewPicker} onOpenChange={setShowMobileViewPicker}>
        <DrawerContent className="max-h-[82dvh] rounded-t-3xl safe-area-pb">
          <DrawerHeader className="px-4 pt-2 pb-2 text-left border-b">
            <DrawerTitle className="font-display text-base">Pilih Mode Tampilan</DrawerTitle>
            <DrawerDescription className="text-xs">{persons.length} anggota</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {viewModeOptions.map((opt) => {
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
                      'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
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
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
