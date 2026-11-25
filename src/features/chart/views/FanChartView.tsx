import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Layers,
  Crosshair,
  Plus,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportTreeAsImage } from '@/features/chart/utils/exportTreeAsImage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatShortYearLabel, getSortableTimestamp } from '@/lib/flexibleDateUtils';
import type { Person, Relationship } from '@/types';

interface FanChartViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string) => void;
  readOnly?: boolean;
}

type FanAngle = 180 | 240;
type ColorMode = 'lineage' | 'gender' | 'birthPlace' | 'verification';

interface FanSlot {
  /** Ahnentafel index: 1 = root, 2 = father, 3 = mother, 4 = pat. GF, 5 = pat. GM, 6 = mat. GF, 7 = mat. GM ... */
  ahnentafel: number;
  generation: number; // 0 = center, 1 = parents, 2 = grandparents, ...
  indexInGen: number; // 0 .. 2^gen - 1
  person: Person | null;
  /** The child person in generation - 1 (useful for adding missing parent) */
  childPerson: Person | null;
  /** 0..3 for the 4 grandparent branches; null for gen 0 & 1 */
  grandparentBranch: number | null;
  /** 'paternal' | 'maternal' | 'root' */
  side: 'root' | 'paternal' | 'maternal';
  roleLabel: string;
}

interface HoveredSlotInfo {
  slot: FanSlot;
  x: number;
  y: number;
}

const LINEAGE_COLORS = [
  { name: 'Ayah → Ayah', light: '#d97706', dark: '#f59e0b', softLight: '#fef3c7', softDark: '#78350f' },
  { name: 'Ayah → Ibu', light: '#0284c7', dark: '#38bdf8', softLight: '#e0f2fe', softDark: '#0c4a6e' },
  { name: 'Ibu → Ayah', light: '#059669', dark: '#34d399', softLight: '#d1fae5', softDark: '#064e3b' },
  { name: 'Ibu → Ibu', light: '#db2777', dark: '#f472b6', softLight: '#fce7f3', softDark: '#831843' },
];

const PLACE_PALETTE = [
  '#d97706',
  '#0284c7',
  '#059669',
  '#db2777',
  '#7c3aed',
  '#ea580c',
  '#0d9488',
  '#4f46e5',
];

function formatLifeSpan(birthDate?: string | null, deathDate?: string | null): string | null {
  const b = formatShortYearLabel(birthDate);
  const d = formatShortYearLabel(deathDate);
  if (b && d) return `${b}–${d}`;
  if (b) return `l. ${b}`;
  if (d) return `w. ${d}`;
  return null;
}

function formatShortName(fullName: string, maxChars: number): string {
  if (maxChars < 3) return '';
  if (fullName.length <= maxChars) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) {
    const firstLastInit = `${parts[0]} ${parts[parts.length - 1][0]}.`;
    if (firstLastInit.length <= maxChars) return firstLastInit;
    if (parts[0].length <= maxChars) return parts[0];
  }
  return `${fullName.slice(0, Math.max(2, maxChars - 1))}…`;
}

function getAhnentafelRole(ahn: number, gen: number): string {
  if (gen === 0) return 'Figur Pusat';
  const isMaleSlot = ahn % 2 === 0;
  if (gen === 1) return isMaleSlot ? 'Ayah' : 'Ibu';
  if (gen === 2) {
    if (ahn === 4) return 'Kakek (pihak Ayah)';
    if (ahn === 5) return 'Nenek (pihak Ayah)';
    if (ahn === 6) return 'Kakek (pihak Ibu)';
    return 'Nenek (pihak Ibu)';
  }
  if (gen === 3) return isMaleSlot ? 'Kakek Buyut' : 'Nenek Buyut';
  if (gen === 4) return isMaleSlot ? 'Canggah (L)' : 'Canggah (P)';
  if (gen === 5) return isMaleSlot ? 'Wareng (L)' : 'Wareng (P)';
  return `Leluhur Gen ${gen}`;
}

export function FanChartView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
  readOnly = false,
}: FanChartViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [maxGenerations, setMaxGenerations] = useState<number>(4);
  const [fanAngle, setFanAngle] = useState<FanAngle>(180);
  const [colorMode, setColorMode] = useState<ColorMode>('lineage');
  const [centerPersonId, setCenterPersonId] = useState<string | null>(selectedPersonId);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<HoveredSlotInfo | null>(null);

  // Sync center person if not yet set
  useEffect(() => {
    if (centerPersonId && persons.some((p) => p.id === centerPersonId)) return;
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) {
      setCenterPersonId(selectedPersonId);
      return;
    }
    if (persons.length === 0) return;

    // Pick youngest generation person who has parents so the fan chart looks rich right away
    const parentCount = new Map<string, number>();
    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        parentCount.set(r.toPersonId, (parentCount.get(r.toPersonId) || 0) + 1);
      }
    });
    const best = [...persons].sort((a, b) => {
      const diff = (parentCount.get(b.id) || 0) - (parentCount.get(a.id) || 0);
      if (diff !== 0) return diff;
      const ya = getSortableTimestamp(a.birthDate) ?? 0;
      const yb = getSortableTimestamp(b.birthDate) ?? 0;
      return yb - ya;
    })[0];
    setCenterPersonId(best?.id ?? null);
  }, [persons, relationships, selectedPersonId, centerPersonId]);

  // Observe stage size
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build parent lookup: childId -> { father, mother }
  const parentsLookup = useMemo(() => {
    const personMap = new Map<string, Person>();
    persons.forEach((p) => personMap.set(p.id, p));

    const map = new Map<string, { father: Person | null; mother: Person | null }>();
    const rawParents = new Map<string, Person[]>();

    relationships.forEach((rel) => {
      if (rel.type !== 'PARENT_CHILD') return;
      const parent = personMap.get(rel.fromPersonId);
      if (!parent) return;
      if (!rawParents.has(rel.toPersonId)) rawParents.set(rel.toPersonId, []);
      rawParents.get(rel.toPersonId)!.push(parent);
    });

    rawParents.forEach((pList, childId) => {
      let father: Person | null = null;
      let mother: Person | null = null;
      const others: Person[] = [];

      for (const p of pList) {
        if (p.gender === 'male' && !father) father = p;
        else if (p.gender === 'female' && !mother) mother = p;
        else others.push(p);
      }

      for (const o of others) {
        if (!father) father = o;
        else if (!mother) mother = o;
      }

      map.set(childId, { father, mother });
    });

    return { map, personMap };
  }, [persons, relationships]);

  // Build binary Ahnentafel slots
  const slots = useMemo<FanSlot[]>(() => {
    if (!centerPersonId) return [];
    const rootPerson = parentsLookup.personMap.get(centerPersonId) || null;
    if (!rootPerson) return [];

    const slotByAhn = new Map<number, FanSlot>();
    const result: FanSlot[] = [];

    for (let gen = 0; gen < maxGenerations; gen++) {
      const count = 1 << gen;
      const startAhn = 1 << gen;

      for (let i = 0; i < count; i++) {
        const ahn = startAhn + i;
        let person: Person | null = null;
        let childPerson: Person | null = null;

        if (gen === 0) {
          person = rootPerson;
        } else {
          const childAhn = Math.floor(ahn / 2);
          const childSlot = slotByAhn.get(childAhn);
          childPerson = childSlot?.person ?? null;
          if (childPerson) {
            const parents = parentsLookup.map.get(childPerson.id);
            person = ahn % 2 === 0 ? parents?.father ?? null : parents?.mother ?? null;
          }
        }

        const side: 'root' | 'paternal' | 'maternal' =
          gen === 0 ? 'root' : i < count / 2 ? 'paternal' : 'maternal';

        const grandparentBranch =
          gen >= 2 ? Math.floor((i / count) * 4) : null;

        const slot: FanSlot = {
          ahnentafel: ahn,
          generation: gen,
          indexInGen: i,
          person,
          childPerson,
          grandparentBranch,
          side,
          roleLabel: getAhnentafelRole(ahn, gen),
        };

        slotByAhn.set(ahn, slot);
        result.push(slot);
      }
    }

    return result;
  }, [centerPersonId, maxGenerations, parentsLookup]);

  // Birthplace color map
  const birthPlaceLegend = useMemo(() => {
    const counts = new Map<string, number>();
    slots.forEach((s) => {
      const place = s.person?.birthPlace?.trim();
      if (place) counts.set(place, (counts.get(place) || 0) + 1);
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, PLACE_PALETTE.length);

    const colorMap = new Map<string, string>();
    sorted.forEach(([place], idx) => {
      colorMap.set(place, PLACE_PALETTE[idx % PLACE_PALETTE.length]);
    });

    return { sorted, colorMap };
  }, [slots]);

  // Completion stats (excluding root)
  const completionStats = useMemo(() => {
    const ancestorSlots = slots.filter((s) => s.generation > 0);
    const filled = ancestorSlots.filter((s) => s.person !== null).length;
    const total = ancestorSlots.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { filled, total, pct };
  }, [slots]);

  const getSlotFill = useCallback(
    (slot: FanSlot): { fill: string; stroke: string; text: string } => {
      if (!slot.person) {
        return {
          fill: isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(148, 163, 184, 0.09)',
          stroke: isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.28)',
          text: isDark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.65)',
        };
      }

      if (slot.generation === 0) {
        return {
          fill: isDark ? '#b45309' : '#d97706',
          stroke: isDark ? '#fbbf24' : '#ffffff',
          text: '#ffffff',
        };
      }

      if (colorMode === 'lineage') {
        if (slot.generation === 1) {
          const isPat = slot.side === 'paternal';
          return {
            fill: isPat
              ? isDark ? '#92400e' : '#f59e0b'
              : isDark ? '#065f46' : '#10b981',
            stroke: isDark ? '#1e293b' : '#ffffff',
            text: '#ffffff',
          };
        }
        const branchIdx = slot.grandparentBranch ?? 0;
        const palette = LINEAGE_COLORS[branchIdx % 4];
        const depthFade = Math.max(0, slot.generation - 2) * 0.14;
        const baseColor = d3.color(isDark ? palette.dark : palette.light);
        const adjusted = baseColor
          ? (isDark ? baseColor.darker(depthFade * 1.4) : baseColor.brighter(depthFade * 1.1)).formatHex()
          : palette.light;
        return {
          fill: adjusted,
          stroke: isDark ? '#0f172a' : '#ffffff',
          text: '#ffffff',
        };
      }

      if (colorMode === 'gender') {
        if (slot.person.gender === 'male') {
          return {
            fill: isDark ? '#0369a1' : '#0ea5e9',
            stroke: isDark ? '#0f172a' : '#ffffff',
            text: '#ffffff',
          };
        }
        if (slot.person.gender === 'female') {
          return {
            fill: isDark ? '#be185d' : '#ec4899',
            stroke: isDark ? '#0f172a' : '#ffffff',
            text: '#ffffff',
          };
        }
        return {
          fill: isDark ? '#475569' : '#94a3b8',
          stroke: isDark ? '#0f172a' : '#ffffff',
          text: '#ffffff',
        };
      }

      if (colorMode === 'birthPlace') {
        const place = slot.person.birthPlace?.trim();
        const c = place ? birthPlaceLegend.colorMap.get(place) : undefined;
        return {
          fill: c || (isDark ? '#475569' : '#94a3b8'),
          stroke: isDark ? '#0f172a' : '#ffffff',
          text: '#ffffff',
        };
      }

      // verification
      const isVerified = slot.person.tags.includes('verified');
      return {
        fill: isVerified
          ? isDark ? '#047857' : '#10b981'
          : isDark ? '#b45309' : '#f59e0b',
        stroke: isDark ? '#0f172a' : '#ffffff',
        text: '#ffffff',
      };
    },
    [colorMode, isDark, birthPlaceLegend]
  );

  // Render D3 Fan Chart
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || stageSize.width === 0 || stageSize.height === 0 || slots.length === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = stageSize.width;
    const height = stageSize.height;

    // Fit radius nicely inside stage
    const isWide = fanAngle === 240;
    const maxRByWidth = (width - 48) / 2;
    const maxRByHeight = isWide ? (height - 48) / 1.55 : height - 64;
    const outerRadius = Math.max(180, Math.min(maxRByWidth, maxRByHeight, 440));

    const centerRadius = Math.min(72, outerRadius * 0.22);
    const ringThickness = (outerRadius - centerRadius) / Math.max(1, maxGenerations - 1);

    const cx = width / 2;
    const cy = isWide ? height * 0.62 : height * 0.86;

    const totalRad = (fanAngle * Math.PI) / 180;
    const startFanAngle = -totalRad / 2;

    const g = svg
      .append('g')
      .attr('transform', `translate(${cx + pan.x}, ${cy + pan.y}) scale(${zoomScale})`);

    const arcGen = d3.arc<{
      innerRadius: number;
      outerRadius: number;
      startAngle: number;
      endAngle: number;
    }>();

    // Render outer rings first (gen >= 1)
    const ancestorSlots = slots.filter((s) => s.generation >= 1);

    ancestorSlots.forEach((slot) => {
      const count = 1 << slot.generation;
      const stepAngle = totalRad / count;
      const a0 = startFanAngle + slot.indexInGen * stepAngle;
      const a1 = a0 + stepAngle;
      const r0 = centerRadius + (slot.generation - 1) * ringThickness;
      const r1 = r0 + ringThickness;

      const colors = getSlotFill(slot);
      const isSelected = !!slot.person && slot.person.id === selectedPersonId;

      const sliceG = g
        .append('g')
        .attr('class', 'fan-slice')
        .style('cursor', slot.person || (slot.childPerson && onAddRelationship) ? 'pointer' : 'default');

      sliceG
        .append('path')
        .attr(
          'd',
          arcGen({
            innerRadius: r0 + 1.5,
            outerRadius: r1 - 1.5,
            startAngle: a0,
            endAngle: a1,
          }) || ''
        )
        .attr('fill', colors.fill)
        .attr('stroke', isSelected ? (isDark ? '#fde047' : '#111827') : colors.stroke)
        .attr('stroke-width', isSelected ? 3 : 1.5)
        .attr('stroke-dasharray', slot.person ? null : '4 3')
        .attr('opacity', 0.94)
        .on('mouseenter', function (event: MouseEvent) {
          d3.select(this).attr('opacity', 1);
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (stageRect) {
            setHovered({
              slot,
              x: event.clientX - stageRect.left,
              y: event.clientY - stageRect.top,
            });
          }
        })
        .on('mousemove', (event: MouseEvent) => {
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (stageRect) {
            setHovered({
              slot,
              x: event.clientX - stageRect.left,
              y: event.clientY - stageRect.top,
            });
          }
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 0.94);
          setHovered(null);
        })
        .on('click', () => {
          if (slot.person) {
            onSelectPerson(slot.person.id);
          } else if (slot.childPerson && onAddRelationship) {
            onAddRelationship(slot.childPerson.id);
          }
        })
        .on('dblclick', () => {
          if (slot.person) {
            setCenterPersonId(slot.person.id);
            onSelectPerson(slot.person.id);
          }
        });

      // Labels inside arc
      const midAngle = (a0 + a1) / 2;
      const midR = (r0 + r1) / 2;
      const arcLength = stepAngle * midR;
      const radialSpace = r1 - r0;

      // Determine whether text should be tangential (along arc) or radial
      const useRadial = slot.generation >= 4 || arcLength < radialSpace * 0.9;
      const deg = (midAngle * 180) / Math.PI;

      const tx = Math.sin(midAngle) * midR;
      const ty = -Math.cos(midAngle) * midR;

      const textGroup = sliceG
        .append('g')
        .attr('pointer-events', 'none')
        .attr('transform', () => {
          if (useRadial) {
            const rot = deg - 90;
            const flip = deg < 0 ? rot + 180 : rot;
            return `translate(${tx}, ${ty}) rotate(${flip})`;
          }
          const rot = deg > 90 || deg < -90 ? deg + 180 : deg;
          return `translate(${tx}, ${ty}) rotate(${rot})`;
        });

      if (slot.person) {
        const availPx = useRadial ? radialSpace - 10 : arcLength - 10;
        const fontSize = slot.generation <= 2 ? 11.5 : slot.generation === 3 ? 10.5 : 9.5;
        const maxChars = Math.floor(availPx / (fontSize * 0.58));

        if (maxChars >= 3) {
          const shortName = formatShortName(slot.person.fullName, maxChars);
          const life = formatLifeSpan(slot.person.birthDate, slot.person.deathDate);
          const showLife = !useRadial && life && radialSpace >= 44 && availPx >= 52;

          textGroup
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', showLife ? '-0.25em' : '0.35em')
            .attr('fill', colors.text)
            .attr('font-size', `${fontSize}px`)
            .attr('font-weight', 600)
            .text(shortName);

          if (showLife) {
            textGroup
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', '1.05em')
              .attr('fill', colors.text)
              .attr('opacity', 0.85)
              .attr('font-size', '9px')
              .text(life);
          }
        }
      } else if (arcLength >= 26 && radialSpace >= 28) {
        textGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', colors.text)
          .attr('font-size', slot.generation <= 2 ? '10px' : '9px')
          .attr('font-weight', 500)
          .text(slot.childPerson && onAddRelationship ? '+ Tambah' : '?');
      }
    });

    // Center Root Wedge / Semi-Circle
    const rootSlot = slots[0];
    if (rootSlot && rootSlot.person) {
      const rootColors = getSlotFill(rootSlot);
      const isRootSelected = rootSlot.person.id === selectedPersonId;

      const rootG = g
        .append('g')
        .style('cursor', 'pointer')
        .on('click', () => onSelectPerson(rootSlot.person!.id))
        .on('mouseenter', (event: MouseEvent) => {
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (stageRect) {
            setHovered({
              slot: rootSlot,
              x: event.clientX - stageRect.left,
              y: event.clientY - stageRect.top,
            });
          }
        })
        .on('mouseleave', () => setHovered(null));

      rootG
        .append('path')
        .attr(
          'd',
          arcGen({
            innerRadius: 0,
            outerRadius: centerRadius - 1,
            startAngle: startFanAngle,
            endAngle: -startFanAngle,
          }) || ''
        )
        .attr('fill', rootColors.fill)
        .attr('stroke', isRootSelected ? (isDark ? '#fde047' : '#111827') : rootColors.stroke)
        .attr('stroke-width', isRootSelected ? 3 : 2);

      const centerYOffset = isWide ? -centerRadius * 0.25 : -centerRadius * 0.42;
      const rootName = formatShortName(rootSlot.person.fullName, 16);
      const rootLife = formatLifeSpan(rootSlot.person.birthDate, rootSlot.person.deathDate);

      rootG
        .append('text')
        .attr('x', 0)
        .attr('y', centerYOffset)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '12px')
        .attr('font-weight', 700)
        .text(rootName);

      if (rootLife) {
        rootG
          .append('text')
          .attr('x', 0)
          .attr('y', centerYOffset + 15)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('opacity', 0.85)
          .attr('font-size', '9.5px')
          .text(rootLife);
      }
    }
  }, [
    slots,
    stageSize,
    fanAngle,
    maxGenerations,
    pan,
    zoomScale,
    getSlotFill,
    selectedPersonId,
    isDark,
    onSelectPerson,
    onAddRelationship,
  ]);

  // Pan & Wheel Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoomScale((prev) => Math.max(0.55, Math.min(2.6, prev * factor)));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, select')) return;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleResetView = () => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleExport = (format: 'png' | 'svg') => {
    if (!stageRef.current) return;
    void exportTreeAsImage(stageRef.current, {
      format,
      filename: 'diagram-kipas-silsilah',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      scale: 2,
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/85 px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Center Person Selector */}
          <Select
            value={centerPersonId || ''}
            onValueChange={(val) => {
              setCenterPersonId(val);
              onSelectPerson(val);
            }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs bg-background/90">
              <Crosshair className="mr-1.5 h-3.5 w-3.5 text-primary shrink-0" />
              <SelectValue placeholder="Pilih pusat kipas..." />
            </SelectTrigger>
            <SelectContent>
              {persons.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Generations Selector */}
          <Select
            value={String(maxGenerations)}
            onValueChange={(v) => setMaxGenerations(Number(v))}
          >
            <SelectTrigger className="h-8 w-[124px] text-xs bg-background/90">
              <Layers className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3" className="text-xs">3 Generasi</SelectItem>
              <SelectItem value="4" className="text-xs">4 Generasi</SelectItem>
              <SelectItem value="5" className="text-xs">5 Generasi</SelectItem>
              <SelectItem value="6" className="text-xs">6 Generasi</SelectItem>
            </SelectContent>
          </Select>

          {/* Angle Toggle */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setFanAngle(180)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                fanAngle === 180
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              180°
            </button>
            <button
              type="button"
              onClick={() => setFanAngle(240)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                fanAngle === 240
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              240°
            </button>
          </div>

          {/* Color Mode */}
          <Select
            value={colorMode}
            onValueChange={(v) => setColorMode(v as ColorMode)}
          >
            <SelectTrigger className="h-8 w-[158px] text-xs bg-background/90">
              <Palette className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lineage" className="text-xs">4 Garis Kakek-Nenek</SelectItem>
              <SelectItem value="gender" className="text-xs">Jenis Kelamin</SelectItem>
              <SelectItem value="birthPlace" className="text-xs">Lokasi Lahir</SelectItem>
              <SelectItem value="verification" className="text-xs">Status Verifikasi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right: Completion Badge + Zoom Controls */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px] font-medium">
            Leluhur terisi: {completionStats.filled}/{completionStats.total} ({completionStats.pct}%)
          </Badge>

          <div className="flex items-center rounded-lg border border-border/70 bg-background/85">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none"
              onClick={() => setZoomScale((z) => Math.max(0.55, z * 0.85))}
              title="Perkecil"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none border-x"
              onClick={handleResetView}
              title="Reset posisi"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={() => setZoomScale((z) => Math.min(2.6, z * 1.18))}
              title="Perbesar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs bg-background/90">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleExport('png')} className="text-xs">
                  Simpan PNG (HD)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('svg')} className="text-xs">
                  Simpan SVG (Vektor)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Interactive SVG Stage */}
      <div
        ref={stageRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          'relative flex-1 overflow-hidden select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <svg
          ref={svgRef}
          data-export-svg="true"
          width={stageSize.width}
          height={stageSize.height}
          className="block h-full w-full"
        />

        {/* Dynamic Legend (Bottom Left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur-sm">
          {colorMode === 'lineage' &&
            LINEAGE_COLORS.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isDark ? item.dark : item.light }}
                />
                <span className="text-muted-foreground">{item.name}</span>
              </span>
            ))}

          {colorMode === 'gender' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span className="text-muted-foreground">Laki-laki</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
                <span className="text-muted-foreground">Perempuan</span>
              </span>
            </>
          )}

          {colorMode === 'verification' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Terverifikasi</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Belum terverifikasi</span>
              </span>
            </>
          )}

          {colorMode === 'birthPlace' &&
            (birthPlaceLegend.sorted.length > 0 ? (
              birthPlaceLegend.sorted.slice(0, 5).map(([place]) => (
                <span key={place} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: birthPlaceLegend.colorMap.get(place) }}
                  />
                  <span className="max-w-[90px] truncate text-muted-foreground">{place}</span>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">Belum ada data kota lahir</span>
            ))}

          <span className="inline-flex items-center gap-1.5 border-l border-border/60 pl-2">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/60" />
            <span className="text-muted-foreground">Belum diketahui</span>
          </span>
        </div>

        {/* Hint (Bottom Right) */}
        <div
          data-export-ignore="true"
          className="pointer-events-none hidden sm:block absolute bottom-3 right-3 rounded-lg border border-border/60 bg-card/85 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm"
        >
          Klik 2x pada anggota untuk menjadikannya pusat kipas
        </div>

        {/* Hover Tooltip */}
        {hovered && (
          <div
            data-export-ignore="true"
            className="pointer-events-none absolute z-30 w-56 rounded-xl border border-border/80 bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(hovered.x + 14, Math.max(12, stageSize.width - 240)),
              top: Math.max(12, hovered.y - 70),
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {hovered.slot.roleLabel}
            </p>
            {hovered.slot.person ? (
              <>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {hovered.slot.person.fullName}
                </p>
                <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {formatLifeSpan(hovered.slot.person.birthDate, hovered.slot.person.deathDate) && (
                    <p>
                      {formatLifeSpan(hovered.slot.person.birthDate, hovered.slot.person.deathDate)}
                    </p>
                  )}
                  {hovered.slot.person.birthPlace && <p>Lahir: {hovered.slot.person.birthPlace}</p>}
                  {hovered.slot.person.tags.includes('verified') && (
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">✓ Terverifikasi</p>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Data leluhur belum diisi</p>
                {hovered.slot.childPerson && onAddRelationship && (
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                    <Plus className="h-3 w-3" />
                    Klik untuk tambah orang tua {hovered.slot.childPerson.fullName}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
