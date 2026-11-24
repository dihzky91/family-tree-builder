import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Tag,
  GitFork,
  Share2,
  Crosshair,
  Sparkles,
  Info,
  Activity,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatShortYearLabel } from '@/lib/flexibleDateUtils';
import { cn } from '@/lib/utils';
import type { Person, Relationship, Gender } from '@/types';

interface NetworkGraphViewProps {
  persons: Person[];
  relationships: Relationship[];
  onSelectPerson?: (personId: string) => void;
  selectedPersonId?: string | null;
}

type LayoutMode = 'free' | 'td';
type LabelMode = 'smart' | 'all' | 'focus';

interface GraphNode {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  gender: Gender;
  yearLabel: string;
  photoUrl?: string | null;
  degree: number;
  generation: number;
  radius: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'PARENT_CHILD' | 'SPOUSE';
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getShortName(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed.length <= 20) return trimmed;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return trimmed.slice(0, 19) + '…';
  const firstTwo = `${parts[0]} ${parts[1]}`;
  if (firstTwo.length <= 18) {
    return `${firstTwo} ${parts[parts.length - 1][0]}.`;
  }
  return firstTwo.slice(0, 18) + '…';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function NetworkGraphView({
  persons,
  relationships,
  onSelectPerson,
  selectedPersonId,
}: NetworkGraphViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isMobile = useIsMobile();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('free');
  const [labelMode, setLabelMode] = useState<LabelMode>('smart');
  const [spotlightActive, setSpotlightActive] = useState(true);
  const [neuralFlowActive, setNeuralFlowActive] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    setShowLegend(!isMobile);
  }, [isMobile]);

  // Ensure canvas inside ForceGraph2D has touch-action: none so mobile touch drag & pinch-zoom work smoothly
  useEffect(() => {
    if (!containerRef.current) return;
    const applyTouchAction = () => {
      const canvases = containerRef.current?.querySelectorAll('canvas');
      canvases?.forEach((c) => {
        c.style.touchAction = 'none';
      });
    };
    applyTouchAction();
    const timer = setTimeout(applyTouchAction, 150);
    return () => clearTimeout(timer);
  }, [dimensions]);

  // Track container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observeTarget = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  // Preload avatars for canvas rendering
  useEffect(() => {
    persons.forEach((p) => {
      if (p.photoUrl && !imageCacheRef.current.has(p.photoUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = p.photoUrl;
        imageCacheRef.current.set(p.photoUrl, img);
      }
    });
  }, [persons]);

  // Build graph structure, degrees, generations, and neighbor lookup
  const { graphData, neighborsByNode, maxDegree, generationCount } = useMemo(() => {
    const personIds = new Set(persons.map((p) => p.id));
    const degreeMap = new Map<string, number>();
    const neighbors = new Map<string, Set<string>>();
    const parentsByChild = new Map<string, string[]>();

    persons.forEach((p) => {
      degreeMap.set(p.id, 0);
      neighbors.set(p.id, new Set([p.id]));
    });

    const validLinks: GraphLink[] = [];

    relationships.forEach((rel) => {
      if (!personIds.has(rel.fromPersonId) || !personIds.has(rel.toPersonId)) return;

      degreeMap.set(rel.fromPersonId, (degreeMap.get(rel.fromPersonId) || 0) + 1);
      degreeMap.set(rel.toPersonId, (degreeMap.get(rel.toPersonId) || 0) + 1);

      neighbors.get(rel.fromPersonId)?.add(rel.toPersonId);
      neighbors.get(rel.toPersonId)?.add(rel.fromPersonId);

      if (rel.type === 'PARENT_CHILD') {
        const list = parentsByChild.get(rel.toPersonId) || [];
        list.push(rel.fromPersonId);
        parentsByChild.set(rel.toPersonId, list);
      }

      // In hierarchical DAG mode ('td'), cyclic spouse links can break dagMode if included as DAG edges
      if (layoutMode === 'td' && rel.type === 'SPOUSE') {
        return;
      }

      validLinks.push({
        id: rel.id,
        source: rel.fromPersonId,
        target: rel.toPersonId,
        type: rel.type,
      });
    });

    // Calculate generation depth for each person
    const genCache = new Map<string, number>();
    const getGen = (id: string, visited = new Set<string>()): number => {
      if (genCache.has(id)) return genCache.get(id)!;
      if (visited.has(id)) return 1;
      const nextVisited = new Set(visited);
      nextVisited.add(id);
      const parents = parentsByChild.get(id) || [];
      if (parents.length === 0) {
        genCache.set(id, 1);
        return 1;
      }
      const g = Math.max(...parents.map((pid) => getGen(pid, nextVisited))) + 1;
      genCache.set(id, g);
      return g;
    };

    let highestDegree = 1;
    const distinctGens = new Set<number>();

    const nodes: GraphNode[] = persons.map((p) => {
      const degree = degreeMap.get(p.id) || 0;
      if (degree > highestDegree) highestDegree = degree;
      const generation = getGen(p.id);
      distinctGens.add(generation);

      // Node radius scales smoothly with connection count (between 7.5 and 14)
      const radius = Math.min(14, 7.5 + Math.sqrt(degree) * 1.8);

      return {
        id: p.id,
        name: p.fullName,
        shortName: getShortName(p.fullName),
        initials: getInitials(p.fullName),
        gender: p.gender,
        yearLabel: formatShortYearLabel(p.birthDate) || '',
        photoUrl: p.photoUrl,
        degree,
        generation,
        radius,
      };
    });

    return {
      graphData: { nodes, links: validLinks },
      neighborsByNode: neighbors,
      maxDegree: highestDegree,
      generationCount: distinctGens.size,
    };
  }, [persons, relationships, layoutMode]);

  // Configure D3 forces with elastic neural physics
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    // Strong repulsion to spread family clusters apart while keeping elastic springiness
    const chargeForce = fg.d3Force('charge');
    if (chargeForce) {
      chargeForce.strength(layoutMode === 'td' ? -250 : -210).distanceMax(680);
    }

    // Responsive link spring force so dragging a node pulls its family branch like a neural web
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce
        .distance((link: GraphLink) => (link.type === 'SPOUSE' ? 46 : 90))
        .strength((link: GraphLink) => (link.type === 'SPOUSE' ? 0.85 : 0.48));
    }

    // Soft collision force so node circles + labels don't stack on top of each other
    fg.d3Force(
      'collide',
      d3
        .forceCollide()
        .radius((node: any) => (node.radius || 9) + 19)
        .strength(0.85)
        .iterations(2)
    );

    fg.d3ReheatSimulation();

    const fitTimer = setTimeout(() => {
      fg.zoomToFit(550, 60);
    }, 450);

    return () => clearTimeout(fitTimer);
  }, [graphData, layoutMode]);

  // Center & zoom smoothly when selectedPersonId changes (e.g. from search bar)
  useEffect(() => {
    if (!selectedPersonId || !graphRef.current) return;
    const node = graphData.nodes.find((n) => n.id === selectedPersonId);
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
      graphRef.current.centerAt(node.x, node.y, 500);
      const currentZoom = graphRef.current.zoom();
      if (currentZoom < 1.35) {
        graphRef.current.zoom(1.5, 500);
      }
    }
  }, [selectedPersonId, graphData.nodes]);

  const activeFocusId = hoveredNodeId || (spotlightActive ? selectedPersonId : null) || null;
  const activeNeighborSet = useMemo(() => {
    if (!activeFocusId) return null;
    return neighborsByNode.get(activeFocusId) || null;
  }, [activeFocusId, neighborsByNode]);

  const handleZoomIn = () => {
    if (!graphRef.current) return;
    graphRef.current.zoom(graphRef.current.zoom() * 1.3, 300);
  };

  const handleZoomOut = () => {
    if (!graphRef.current) return;
    graphRef.current.zoom(graphRef.current.zoom() / 1.3, 300);
  };

  const handleReset = () => {
    if (!graphRef.current) return;
    graphRef.current.d3ReheatSimulation();
    graphRef.current.zoomToFit(450, 60);
  };

  const handleCenterSelected = useCallback(() => {
    if (!selectedPersonId || !graphRef.current) return;
    const node = graphData.nodes.find((n) => n.id === selectedPersonId);
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
      graphRef.current.centerAt(node.x, node.y, 450);
      graphRef.current.zoom(1.6, 450);
    }
  }, [selectedPersonId, graphData.nodes]);

  const getNodePalette = (node: GraphNode, isSelected: boolean) => {
    if (isSelected) {
      return {
        fill: '#D97706',
        stroke: '#FDE68A',
        ring: 'rgba(245, 158, 11, 0.36)',
        text: '#FFFFFF',
        badgeText: isDark ? '#FDE68A' : '#92400E',
        badgeBorder: '#F59E0B',
      };
    }
    if (node.gender === 'male') {
      return {
        fill: isDark ? '#2563EB' : '#3B82F6',
        stroke: isDark ? '#93C5FD' : '#EFF6FF',
        ring: 'rgba(59, 130, 246, 0.24)',
        text: '#FFFFFF',
        badgeText: isDark ? '#DBEAFE' : '#1E3A8A',
        badgeBorder: isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.35)',
      };
    }
    if (node.gender === 'female') {
      return {
        fill: isDark ? '#DB2777' : '#EC4899',
        stroke: isDark ? '#F9A8D4' : '#FDF2F8',
        ring: 'rgba(236, 72, 153, 0.24)',
        text: '#FFFFFF',
        badgeText: isDark ? '#FCE7F3' : '#831843',
        badgeBorder: isDark ? 'rgba(236, 72, 153, 0.5)' : 'rgba(236, 72, 153, 0.35)',
      };
    }
    return {
      fill: isDark ? '#4B5563' : '#64748B',
      stroke: isDark ? '#D1D5DB' : '#F8FAFC',
      ring: 'rgba(100, 116, 139, 0.22)',
      text: '#FFFFFF',
      badgeText: isDark ? '#E5E7EB' : '#334155',
      badgeBorder: isDark ? 'rgba(156, 163, 175, 0.4)' : 'rgba(100, 116, 139, 0.35)',
    };
  };

  if (!persons) return null;

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none touch-none [&_canvas]:touch-none"
      ref={containerRef}
    >
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
        dagMode={layoutMode === 'td' ? 'td' : undefined}
        dagLevelDistance={layoutMode === 'td' ? 95 : undefined}
        d3AlphaDecay={0.014}
        d3VelocityDecay={0.22}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={(node: any) => onSelectPerson?.(node.id)}
        onNodeHover={(node: any) => setHoveredNodeId(node ? node.id : null)}
        onNodeDragEnd={(node: any) => {
          // Release fixed coordinates after drag so node bounces back organically with its cluster
          node.fx = undefined;
          node.fy = undefined;
        }}
        linkCurvature={(link: any) => (link.type === 'SPOUSE' ? 0.2 : 0.04)}
        linkLineDash={(link: any) => (link.type === 'SPOUSE' ? [5, 4] : null)}
        linkDirectionalArrowLength={(link: any) => (link.type === 'PARENT_CHILD' ? 4 : 0)}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalParticles={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);

          if (!neuralFlowActive) {
            return isDirectFocusLink ? 3 : 0;
          }

          if (activeFocusId && !isDirectFocusLink) {
            // Keep subtle background neural flow even when spotlighting a node
            return link.type === 'PARENT_CHILD' ? 1 : 0;
          }

          if (isDirectFocusLink) {
            return 4;
          }

          // Continuous neural synapse flow across all lineage and spouse connections
          return link.type === 'PARENT_CHILD' ? 2 : 1;
        }}
        linkDirectionalParticleWidth={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);
          if (isDirectFocusLink) return 3.6;
          return link.type === 'SPOUSE' ? 2 : 2.4;
        }}
        linkDirectionalParticleSpeed={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);
          return isDirectFocusLink ? 0.0095 : 0.0052;
        }}
        linkDirectionalParticleColor={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);

          if (isDirectFocusLink) {
            return link.type === 'SPOUSE' ? '#FB7185' : '#F59E0B';
          }
          if (link.type === 'SPOUSE') {
            return isDark ? '#F43F5E' : '#E11D48';
          }
          return isDark ? '#60A5FA' : '#3B82F6';
        }}
        linkWidth={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);
          if (isDirectFocusLink) return 2.6;
          return link.type === 'SPOUSE' ? 1.5 : 1.4;
        }}
        linkColor={(link: any) => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          const isDirectFocusLink =
            activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId);

          if (activeFocusId && !isDirectFocusLink) {
            return isDark ? 'rgba(71, 85, 105, 0.16)' : 'rgba(148, 163, 184, 0.22)';
          }

          if (link.type === 'SPOUSE') {
            return isDirectFocusLink
              ? '#F43F5E'
              : isDark
                ? 'rgba(244, 63, 94, 0.65)'
                : 'rgba(225, 29, 72, 0.6)';
          }

          return isDirectFocusLink
            ? isDark
              ? '#60A5FA'
              : '#2563EB'
            : isDark
              ? 'rgba(148, 163, 184, 0.45)'
              : 'rgba(100, 116, 139, 0.42)';
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const r = (node.radius || 9) + 6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

          const gNode = node as GraphNode;
          const isSelected = gNode.id === selectedPersonId;
          const isHovered = gNode.id === hoveredNodeId;
          const isNeighbor = activeNeighborSet ? activeNeighborSet.has(gNode.id) : true;
          const isDimmed = Boolean(activeFocusId && !isNeighbor);
          const isHub = gNode.degree >= Math.max(4, maxDegree * 0.65);

          const palette = getNodePalette(gNode, isSelected);
          const radius = gNode.radius + (isSelected ? 2.5 : isHovered ? 1.5 : 0);

          ctx.save();
          ctx.globalAlpha = isDimmed ? 0.22 : 1;

          // Subtle breathing neural halo on selected, hovered, or major family hub nodes
          if (isSelected || isHovered || (!activeFocusId && isHub)) {
            const pulseOffset =
              neuralFlowActive
                ? Math.sin(performance.now() * 0.0038 + gNode.degree) * 1.6
                : 0;
            ctx.beginPath();
            ctx.arc(
              node.x,
              node.y,
              Math.max(radius + 2, radius + 4.8 + pulseOffset),
              0,
              2 * Math.PI,
              false
            );
            ctx.fillStyle = palette.ring;
            ctx.fill();
          }

          // Node circle background
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = palette.fill;
          ctx.fill();

          // Avatar image if loaded, otherwise clean initials inside circle
          const cachedImg = gNode.photoUrl ? imageCacheRef.current.get(gNode.photoUrl) : null;
          if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius - 1, 0, 2 * Math.PI, false);
            ctx.clip();
            ctx.drawImage(
              cachedImg,
              node.x - radius,
              node.y - radius,
              radius * 2,
              radius * 2
            );
            ctx.restore();
          } else {
            const initialsFontSize = Math.max(4.5, radius * 0.78);
            ctx.font = `600 ${initialsFontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = palette.text;
            ctx.fillText(gNode.initials, node.x, node.y + 0.3);
          }

          // Node border ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.strokeStyle = isSelected ? '#F59E0B' : palette.stroke;
          ctx.lineWidth = (isSelected ? 2.4 : 1.5) / Math.sqrt(Math.max(globalScale, 0.7));
          ctx.stroke();

          // Decide whether to render the pill label below the node
          const isImportantNode =
            isSelected ||
            isHovered ||
            (activeFocusId && isNeighbor) ||
            gNode.degree >= 3 ||
            gNode.generation <= 2;

          const shouldShowLabel =
            labelMode === 'all' ||
            (labelMode === 'focus' &&
              (isSelected || isHovered || (activeFocusId && isNeighbor))) ||
            (labelMode === 'smart' &&
              (globalScale >= 1.15 ||
                (globalScale >= 0.72 && isImportantNode) ||
                isSelected ||
                isHovered));

          if (shouldShowLabel && (!isDimmed || globalScale >= 1.6)) {
            const showFullName = isSelected || isHovered || globalScale >= 1.75;
            const baseText = showFullName ? gNode.name : gNode.shortName;
            const displayLabel =
              (isSelected || isHovered || globalScale >= 1.45) && gNode.yearLabel
                ? `${baseText} (${gNode.yearLabel})`
                : baseText;

            const fontSize = Math.max(8, Math.min(13, 11 / Math.pow(globalScale, 0.75)));
            ctx.font = `${isSelected || isHovered ? 600 : 500} ${fontSize}px Inter, system-ui, sans-serif`;

            const textMetrics = ctx.measureText(displayLabel);
            const padX = fontSize * 0.55;
            const padY = fontSize * 0.32;
            const pillW = textMetrics.width + padX * 2;
            const pillH = fontSize + padY * 2;
            const pillX = node.x - pillW / 2;
            const pillY = node.y + radius + 3.5 / Math.sqrt(Math.max(globalScale, 0.8));

            // Pill background
            drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
            ctx.fillStyle = isSelected
              ? isDark
                ? 'rgba(120, 53, 15, 0.94)'
                : 'rgba(254, 243, 199, 0.96)'
              : isDark
                ? 'rgba(15, 23, 42, 0.86)'
                : 'rgba(255, 255, 255, 0.92)';
            ctx.fill();

            // Pill border
            ctx.strokeStyle = palette.badgeBorder;
            ctx.lineWidth = (isSelected ? 1.4 : 0.85) / globalScale;
            ctx.stroke();

            // Pill text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = palette.badgeText;
            ctx.fillText(displayLabel, node.x, pillY + pillH / 2 + 0.3);
          }

          ctx.restore();
        }}
      />

      {/* Top-Left Toolbar: Layout Mode, Label Filter, Neural Impulse Toggle & Spotlight */}
      <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-1.5">
        {/* Layout Switcher */}
        <Card className="pointer-events-auto flex items-center gap-0.5 p-1 bg-card/90 backdrop-blur-md border-border/70 shadow-sm rounded-xl">
          <Button
            variant={layoutMode === 'free' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs rounded-lg gap-1.5"
            onClick={() => setLayoutMode('free')}
            title="Susunan klaster jaringan neural organik"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Klaster</span>
          </Button>
          <Button
            variant={layoutMode === 'td' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs rounded-lg gap-1.5"
            onClick={() => setLayoutMode('td')}
            title="Susunan berjenjang dari leluhur ke keturunan"
          >
            <GitFork className="w-3.5 h-3.5 rotate-180" />
            <span>Hierarki</span>
          </Button>
        </Card>

        {/* Label Density Switcher */}
        <Card className="pointer-events-auto flex items-center gap-0.5 p-1 bg-card/90 backdrop-blur-md border-border/70 shadow-sm rounded-xl">
          <Tag className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-1 hidden sm:inline" />
          {(
            [
              { value: 'smart', label: 'Otomatis', title: 'Tampilkan nama tokoh utama & detail saat di-zoom' },
              { value: 'all', label: 'Semua', title: 'Tampilkan semua label nama' },
              { value: 'focus', label: 'Fokus', title: 'Hanya tampilkan nama saat dipilih atau di-hover' },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              variant={labelMode === opt.value ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-2 text-xs rounded-lg',
                labelMode === opt.value && 'font-medium text-primary bg-primary/10'
              )}
              onClick={() => setLabelMode(opt.value)}
              title={opt.title}
            >
              {opt.label}
            </Button>
          ))}
        </Card>

        {/* Neural Synapse Impulse & Spotlight Group */}
        <Card className="pointer-events-auto flex items-center gap-0.5 p-1 bg-card/90 backdrop-blur-md border-border/70 shadow-sm rounded-xl">
          <Button
            variant={neuralFlowActive ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 px-2.5 text-xs rounded-lg gap-1.5',
              neuralFlowActive && 'font-medium text-primary bg-primary/10'
            )}
            onClick={() => setNeuralFlowActive((prev) => !prev)}
            title={
              neuralFlowActive
                ? 'Aliran sinapsis aktif (klik untuk mematikan partikel)'
                : 'Aktifkan animasi aliran partikel neural'
            }
          >
            <Activity className={cn('w-3.5 h-3.5', neuralFlowActive && 'animate-pulse')} />
            <span className="hidden sm:inline">Impuls</span>
          </Button>

          {selectedPersonId && (
            <Button
              variant={spotlightActive ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs rounded-lg gap-1.5"
              onClick={() => setSpotlightActive((prev) => !prev)}
              title="Sorot keluarga terdekat dari anggota yang dipilih"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sorot Relasi</span>
            </Button>
          )}
        </Card>
      </div>

      {/* Bottom-Left Legend Card */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20">
        {showLegend ? (
          <Card className="pointer-events-auto p-3 bg-card/95 backdrop-blur-md border-border/70 shadow-md rounded-xl text-xs space-y-2.5 w-[264px] sm:w-[272px] max-w-[calc(100vw-1.5rem)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Legenda Jaringan
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap shrink-0 rounded-full"
                >
                  {persons.length} org · {generationCount} gen
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="h-5 w-5 inline-flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 transition-colors"
                title="Sembunyikan legenda"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/25 shrink-0" />
                <span>Laki-laki</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500 ring-2 ring-pink-500/25 shrink-0" />
                <span>Perempuan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-400/40 shrink-0" />
                <span>Anggota Terpilih</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/60 flex items-center justify-center text-[8px] font-bold shrink-0">
                  +
                </span>
                <span>Ukuran = Jml Relasi</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-border/60 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="relative inline-flex items-center w-5 h-0.5 bg-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto" />
                </span>
                <span>Aliran Ortu → Anak</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-rose-500" />
                <span>Pasangan</span>
              </div>
            </div>
          </Card>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="pointer-events-auto h-8 gap-1.5 rounded-xl bg-card/90 backdrop-blur-md shadow-sm text-xs"
            onClick={() => setShowLegend(true)}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Legenda</span>
          </Button>
        )}
      </div>

      {/* Bottom-Right Zoom & Center Controls */}
      <Card className="pointer-events-auto absolute bottom-3 right-3 z-10 p-1 flex items-center gap-0.5 bg-card/90 backdrop-blur-md border-border/70 shadow-sm rounded-xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleZoomOut}
          title="Perkecil (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        {selectedPersonId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-primary"
            onClick={handleCenterSelected}
            title="Pusatkan ke anggota terpilih"
          >
            <Crosshair className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleReset}
          title="Segarkan simulasi & sesuaikan ke layar"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleZoomIn}
          title="Perbesar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </Card>
    </div>
  );
}
