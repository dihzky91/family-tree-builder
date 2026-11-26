import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  ArrowUp,
  ArrowDown,
  User,
  Heart,
  Download,
  Maximize2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';
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
import type { Person, Relationship } from '@/types';

interface HourglassViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  readOnly?: boolean;
}

interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
  depth: number; // 0 = focus, >0 = level distance
}

interface PositionedNode {
  key: string;
  person: Person;
  spouses: Person[];
  x: number;
  y: number;
  direction: 'center' | 'up' | 'down';
  depth: number;
}

interface EdgeSegment {
  id: string;
  d: string;
  direction: 'up' | 'down';
}

const CARD_W = 164;
const CARD_H = 74;
const H_GAP = 28;
const V_GAP = 64;

function extractYear(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatLife(p: Person): string {
  const b = extractYear(p.birthDate);
  const d = extractYear(p.deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return `l. ${b}`;
  if (d) return `w. ${d}`;
  return '';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const HourglassView = memo(function HourglassView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  readOnly = false,
}: HourglassViewProps) {
  const isMobile = useIsMobile();
  const [centerPersonId, setCenterPersonId] = useState<string | null>(selectedPersonId);
  const [ancestorDepth, setAncestorDepth] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 3
  );
  const [descendantDepth, setDescendantDepth] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 3
  );
  const [view, setView] = useState({ x: 0, y: 0, k: 0.9 });
  const [isPanning, setIsPanning] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentLayerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, k: 0.9 });
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(
    null
  );
  const pinchRef = useRef<{
    dist: number;
    cx: number;
    cy: number;
    k: number;
    vx: number;
    vy: number;
  } | null>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Sync centerPersonId when selectedPersonId changes externally (e.g. search or "Lihat & Jadikan Pusat")
  useEffect(() => {
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) {
      setCenterPersonId(selectedPersonId);
    }
  }, [selectedPersonId, persons]);

  // Pick a smart default focus person who has both parents and children if available
  useEffect(() => {
    if (centerPersonId && persons.some((p) => p.id === centerPersonId)) return;
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) {
      setCenterPersonId(selectedPersonId);
      return;
    }
    if (persons.length === 0) return;

    const pCount = new Map<string, number>();
    const cCount = new Map<string, number>();
    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        pCount.set(r.toPersonId, (pCount.get(r.toPersonId) || 0) + 1);
        cCount.set(r.fromPersonId, (cCount.get(r.fromPersonId) || 0) + 1);
      }
    });

    const best = [...persons].sort((a, b) => {
      const aBoth = (pCount.get(a.id) || 0) > 0 && (cCount.get(a.id) || 0) > 0 ? 100 : 0;
      const bBoth = (pCount.get(b.id) || 0) > 0 && (cCount.get(b.id) || 0) > 0 ? 100 : 0;
      const aScore = aBoth + (pCount.get(a.id) || 0) + (cCount.get(a.id) || 0);
      const bScore = bBoth + (pCount.get(b.id) || 0) + (cCount.get(b.id) || 0);
      return bScore - aScore;
    })[0];

    setCenterPersonId(best?.id ?? null);
  }, [persons, relationships, selectedPersonId, centerPersonId]);

  // Build adjacency maps
  const graphMaps = useMemo(() => {
    const personMap = new Map<string, Person>();
    persons.forEach((p) => personMap.set(p.id, p));

    const parentsOf = new Map<string, Person[]>();
    const childrenOf = new Map<string, Person[]>();
    const spousesOf = new Map<string, Person[]>();

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        const parent = personMap.get(r.fromPersonId);
        const child = personMap.get(r.toPersonId);
        if (parent && child) {
          if (!parentsOf.has(child.id)) parentsOf.set(child.id, []);
          if (!parentsOf.get(child.id)!.some((p) => p.id === parent.id)) {
            parentsOf.get(child.id)!.push(parent);
          }
          if (!childrenOf.has(parent.id)) childrenOf.set(parent.id, []);
          if (!childrenOf.get(parent.id)!.some((c) => c.id === child.id)) {
            childrenOf.get(parent.id)!.push(child);
          }
        }
      } else if (r.type === 'SPOUSE') {
        const a = personMap.get(r.fromPersonId);
        const b = personMap.get(r.toPersonId);
        if (a && b) {
          if (!spousesOf.has(a.id)) spousesOf.set(a.id, []);
          if (!spousesOf.get(a.id)!.some((s) => s.id === b.id)) spousesOf.get(a.id)!.push(b);
          if (!spousesOf.has(b.id)) spousesOf.set(b.id, []);
          if (!spousesOf.get(b.id)!.some((s) => s.id === a.id)) spousesOf.get(b.id)!.push(a);
        }
      }
    });

    // Sort children by birthDate ascending, parents male first then female
    parentsOf.forEach((list) => {
      list.sort((a, b) => (a.gender === 'male' ? -1 : b.gender === 'male' ? 1 : 0));
    });
    childrenOf.forEach((list) => {
      list.sort((a, b) => {
        const ya = a.birthDate ? new Date(a.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
        const yb = b.birthDate ? new Date(b.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ya - yb;
      });
    });

    return { personMap, parentsOf, childrenOf, spousesOf };
  }, [persons, relationships]);

  // Compute Hourglass layout
  const layout = useMemo(() => {
    if (!centerPersonId) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as EdgeSegment[],
        width: 800,
        height: 500,
        ancestorCount: 0,
        descendantCount: 0,
      };
    }

    const root = graphMaps.personMap.get(centerPersonId);
    if (!root) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as EdgeSegment[],
        width: 800,
        height: 500,
        ancestorCount: 0,
        descendantCount: 0,
      };
    }

    // Build upward (ancestor) tree
    const buildUp = (person: Person, depth: number, visited: Set<string>): TreeNode => {
      const nextVisited = new Set(visited);
      nextVisited.add(person.id);
      const parents =
        depth < ancestorDepth
          ? (graphMaps.parentsOf.get(person.id) || []).filter((p) => !nextVisited.has(p.id))
          : [];
      return {
        person,
        spouses: [],
        depth,
        children: parents.map((p) => buildUp(p, depth + 1, nextVisited)),
      };
    };

    // Build downward (descendant) tree
    const buildDown = (person: Person, depth: number, visited: Set<string>): TreeNode => {
      const nextVisited = new Set(visited);
      nextVisited.add(person.id);
      const kids =
        depth < descendantDepth
          ? (graphMaps.childrenOf.get(person.id) || []).filter((c) => !nextVisited.has(c.id))
          : [];
      return {
        person,
        spouses: graphMaps.spousesOf.get(person.id) || [],
        depth,
        children: kids.map((c) => buildDown(c, depth + 1, nextVisited)),
      };
    };

    const upTree = buildUp(root, 0, new Set());
    const downTree = buildDown(root, 0, new Set());

    // Compute subtree width in pixels
    const getSubtreeWidth = (node: TreeNode): number => {
      if (node.children.length === 0) return CARD_W;
      const childrenWidth =
        node.children.reduce((acc, c) => acc + getSubtreeWidth(c), 0) +
        (node.children.length - 1) * H_GAP;
      return Math.max(CARD_W, childrenWidth);
    };

    const getMaxDepth = (node: TreeNode): number => {
      if (node.children.length === 0) return node.depth;
      return Math.max(...node.children.map(getMaxDepth));
    };

    const upWidth = getSubtreeWidth(upTree);
    const downWidth = getSubtreeWidth(downTree);
    const maxUpDepth = getMaxDepth(upTree);
    const maxDownDepth = getMaxDepth(downTree);

    const padX = 80;
    const padY = 64;
    const totalWidth = Math.max(upWidth, downWidth, 560) + padX * 2;
    const centerX = totalWidth / 2;
    const centerY = padY + maxUpDepth * (CARD_H + V_GAP);
    const totalHeight = centerY + CARD_H + maxDownDepth * (CARD_H + V_GAP) + padY;

    const nodes: PositionedNode[] = [];
    const edges: EdgeSegment[] = [];
    let ancestorCount = 0;
    let descendantCount = 0;

    // Place center node
    nodes.push({
      key: `center-${root.id}`,
      person: root,
      spouses: graphMaps.spousesOf.get(root.id) || [],
      x: centerX - CARD_W / 2,
      y: centerY,
      direction: 'center',
      depth: 0,
    });

    // Place ancestors recursively (going UP)
    const placeUp = (node: TreeNode, parentCenterX: number, parentY: number) => {
      if (node.children.length === 0) return;
      const totalW =
        node.children.reduce((acc, c) => acc + getSubtreeWidth(c), 0) +
        (node.children.length - 1) * H_GAP;
      let cursorX = parentCenterX - totalW / 2;

      node.children.forEach((parentNode, idx) => {
        const w = getSubtreeWidth(parentNode);
        const cx = cursorX + w / 2;
        const y = centerY - parentNode.depth * (CARD_H + V_GAP);
        ancestorCount++;

        nodes.push({
          key: `up-${parentNode.depth}-${parentNode.person.id}-${idx}`,
          person: parentNode.person,
          spouses: [],
          x: cx - CARD_W / 2,
          y,
          direction: 'up',
          depth: parentNode.depth,
        });

        const startX = parentCenterX;
        const startY = parentY;
        const endX = cx;
        const endY = y + CARD_H;
        const midY = (startY + endY) / 2;

        edges.push({
          id: `edge-up-${node.person.id}-${parentNode.person.id}-${idx}`,
          direction: 'up',
          d: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
        });

        placeUp(parentNode, cx, y);
        cursorX += w + H_GAP;
      });
    };

    // Place descendants recursively (going DOWN)
    const placeDown = (node: TreeNode, parentCenterX: number, parentY: number) => {
      if (node.children.length === 0) return;
      const totalW =
        node.children.reduce((acc, c) => acc + getSubtreeWidth(c), 0) +
        (node.children.length - 1) * H_GAP;
      let cursorX = parentCenterX - totalW / 2;

      node.children.forEach((childNode, idx) => {
        const w = getSubtreeWidth(childNode);
        const cx = cursorX + w / 2;
        const y = centerY + childNode.depth * (CARD_H + V_GAP);
        descendantCount++;

        nodes.push({
          key: `down-${childNode.depth}-${childNode.person.id}-${idx}`,
          person: childNode.person,
          spouses: childNode.spouses,
          x: cx - CARD_W / 2,
          y,
          direction: 'down',
          depth: childNode.depth,
        });

        const startX = parentCenterX;
        const startY = parentY + CARD_H;
        const endX = cx;
        const endY = y;
        const midY = (startY + endY) / 2;

        edges.push({
          id: `edge-down-${node.person.id}-${childNode.person.id}-${idx}`,
          direction: 'down',
          d: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
        });

        placeDown(childNode, cx, y);
        cursorX += w + H_GAP;
      });
    };

    placeUp(upTree, centerX, centerY);
    placeDown(downTree, centerX, centerY);

    return {
      nodes,
      edges,
      width: totalWidth,
      height: totalHeight,
      ancestorCount,
      descendantCount,
    };
  }, [centerPersonId, ancestorDepth, descendantDepth, graphMaps]);

  // Direct DOM transform updater during drag/pinch so React doesn't re-render all cards at 60fps
  const applyDomTransform = useCallback((next: { x: number; y: number; k: number }) => {
    viewRef.current = next;
    const el = contentLayerRef.current;
    if (el) {
      el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.k})`;
    }
  }, []);

  const commitView = useCallback(
    (next: { x: number; y: number; k: number }) => {
      applyDomTransform(next);
      setView(next);
    },
    [applyDomTransform]
  );

  // Auto-fit entire hourglass diagram into the stage viewport
  const fitToView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || layout.width <= 0 || layout.height <= 0) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;

    const pad = cw < 640 ? 16 : 36;
    const availW = Math.max(120, cw - pad * 2);
    const availH = Math.max(120, ch - pad * 2);
    const k = Math.max(0.18, Math.min(1.05, Math.min(availW / layout.width, availH / layout.height)));
    const x = (cw - layout.width * k) / 2;
    const y = (ch - layout.height * k) / 2;
    commitView({ x, y, k });
  }, [layout.width, layout.height, commitView]);

  // Center specifically on the Focus Person at a readable scale (especially great on mobile)
  const centerOnFocusPerson = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;

    const centerNode = layout.nodes.find((n) => n.direction === 'center');
    if (!centerNode) {
      fitToView();
      return;
    }

    const targetK = cw < 640 ? 0.78 : 0.92;
    const nodeCenterX = centerNode.x + CARD_W / 2;
    const nodeCenterY = centerNode.y + CARD_H / 2;
    const x = cw / 2 - nodeCenterX * targetK;
    const y = ch / 2 - nodeCenterY * targetK;
    commitView({ x, y, k: targetK });
  }, [layout.nodes, fitToView, commitView]);

  useEffect(() => {
    const id = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(id);
  }, [fitToView, centerPersonId, ancestorDepth, descendantDepth]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  const zoomAtPoint = useCallback(
    (factor: number, focalX: number, focalY: number) => {
      const prev = viewRef.current;
      const nextK = Math.max(0.15, Math.min(2.4, prev.k * factor));
      const ratio = nextK / prev.k;
      commitView({
        k: nextK,
        x: focalX - (focalX - prev.x) * ratio,
        y: focalY - (focalY - prev.y) * ratio,
      });
    },
    [commitView]
  );

  // Native wheel listener with passive: false for smooth cursor-centered zoom
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAtPoint(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  // Multi-touch Pinch-to-Zoom + 1-finger Pan for mobile touchscreens
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('button, select')) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        dragRef.current = null;
        const rect = el.getBoundingClientRect();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        pinchRef.current = {
          dist,
          cx,
          cy,
          k: viewRef.current.k,
          vx: viewRef.current.x,
          vy: viewRef.current.y,
        };
        setIsPanning(true);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const p = pinchRef.current;
        const rect = el.getBoundingClientRect();
        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const scaleFactor = newDist / Math.max(1, p.dist);
        const nextK = Math.max(0.15, Math.min(2.4, p.k * scaleFactor));
        const ratio = nextK / p.k;
        const nextX = cx - (p.cx - p.vx) * ratio;
        const nextY = cy - (p.cy - p.vy) * ratio;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applyDomTransform({ x: nextX, y: nextY, k: nextK });
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (pinchRef.current && e.touches.length < 2) {
        pinchRef.current = null;
        setIsPanning(false);
        setView({ ...viewRef.current });
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyDomTransform]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    if ((e.target as HTMLElement).closest('button, select')) return;
    setIsPanning(true);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || pinchRef.current) return;
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        d.moved = true;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyDomTransform({
          x: d.vx + dx,
          y: d.vy + dy,
          k: viewRef.current.k,
        });
      });
    },
    [applyDomTransform]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsPanning(false);
    setView({ ...viewRef.current });
  }, []);

  const handleZoomButton = (factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    zoomAtPoint(factor, stage.clientWidth / 2, stage.clientHeight / 2);
  };

  const handleExport = (format: 'png' | 'svg') => {
    if (!exportContentRef.current) return;
    void exportTreeAsImage(exportContentRef.current, {
      format,
      filename: 'bagan-jam-pasir',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      scale: 2,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/95 px-3 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Select
            value={centerPersonId || ''}
            onValueChange={(val) => {
              setCenterPersonId(val);
              onSelectPerson(val);
            }}
          >
            <SelectTrigger className="h-8 w-[150px] sm:w-[185px] bg-background/90 text-xs">
              <Crosshair className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <SelectValue placeholder="Pilih figur pusat..." />
            </SelectTrigger>
            <SelectContent>
              {persons.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(ancestorDepth)} onValueChange={(v) => setAncestorDepth(Number(v))}>
            <SelectTrigger className="h-8 w-[112px] sm:w-[138px] bg-background/90 text-xs">
              <ArrowUp className="mr-1 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" className="text-xs">{isMobile ? 'Atas: 1 gen' : 'Leluhur: 1 gen'}</SelectItem>
              <SelectItem value="2" className="text-xs">{isMobile ? 'Atas: 2 gen' : 'Leluhur: 2 gen'}</SelectItem>
              <SelectItem value="3" className="text-xs">{isMobile ? 'Atas: 3 gen' : 'Leluhur: 3 gen'}</SelectItem>
              <SelectItem value="4" className="text-xs">{isMobile ? 'Atas: 4 gen' : 'Leluhur: 4 gen'}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(descendantDepth)}
            onValueChange={(v) => setDescendantDepth(Number(v))}
          >
            <SelectTrigger className="h-8 w-[116px] sm:w-[148px] bg-background/90 text-xs">
              <ArrowDown className="mr-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" className="text-xs">{isMobile ? 'Bawah: 1 gen' : 'Keturunan: 1 gen'}</SelectItem>
              <SelectItem value="2" className="text-xs">{isMobile ? 'Bawah: 2 gen' : 'Keturunan: 2 gen'}</SelectItem>
              <SelectItem value="3" className="text-xs">{isMobile ? 'Bawah: 3 gen' : 'Keturunan: 3 gen'}</SelectItem>
              <SelectItem value="4" className="text-xs">{isMobile ? 'Bawah: 4 gen' : 'Keturunan: 4 gen'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden md:flex items-center gap-1.5">
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-[11px] text-amber-700 dark:text-amber-300">
              <ArrowUp className="h-3 w-3" />
              {layout.ancestorCount} leluhur
            </Badge>
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-[11px] text-emerald-700 dark:text-emerald-300">
              <ArrowDown className="h-3 w-3" />
              {layout.descendantCount} keturunan
            </Badge>
          </div>

          <div className="flex items-center rounded-lg border border-border/70 bg-background/85">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none"
              onClick={() => handleZoomButton(0.84)}
              title="Perkecil"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none border-l"
              onClick={centerOnFocusPerson}
              title="Pusatkan ke Figur Pusat"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none border-x"
              onClick={fitToView}
              title="Sesuaikan seluruh bagan ke layar (Fit)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={() => handleZoomButton(1.18)}
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

      {/* Interactive GPU Stage (no nested scrollbar jank) */}
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          'relative flex-1 min-h-0 w-full overflow-hidden touch-none select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          ref={contentLayerRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: layout.width,
            height: layout.height,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <div
            ref={exportContentRef}
            data-export-target="true"
            className="relative"
            style={{ width: layout.width, height: layout.height }}
          >
            {/* Connectors */}
            <svg
              width={layout.width}
              height={layout.height}
              className="pointer-events-none absolute inset-0"
            >
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  strokeWidth={2}
                  className={
                    edge.direction === 'up'
                      ? 'stroke-amber-500/65'
                      : 'stroke-emerald-500/65'
                  }
                />
              ))}
            </svg>

            {/* Nodes */}
            {layout.nodes.map((node) => {
              const p = node.person;
              const isSelected = p.id === selectedPersonId;
              const life = formatLife(p);

              const borderClass =
                node.direction === 'center'
                  ? 'border-primary ring-2 ring-primary/30 shadow-md'
                  : p.gender === 'male'
                    ? 'border-sky-400/75 dark:border-sky-500/60'
                    : p.gender === 'female'
                      ? 'border-rose-400/75 dark:border-rose-500/60'
                      : 'border-border';

              const avatarTone =
                p.gender === 'male'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                  : p.gender === 'female'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                    : 'bg-muted text-muted-foreground';

              return (
                <div
                  key={node.key}
                  className="absolute"
                  style={{ left: node.x, top: node.y, width: CARD_W, height: CARD_H }}
                >
                  {node.direction === 'center' && (
                    <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                      Figur Pusat
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (dragRef.current?.moved) return;
                      onSelectPerson(p.id);
                    }}
                    onDoubleClick={() => {
                      setCenterPersonId(p.id);
                      onSelectPerson(p.id);
                    }}
                    className={cn(
                      'flex h-full w-full items-center gap-2 rounded-xl border-2 bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:shadow-md',
                      borderClass,
                      isSelected && node.direction !== 'center' && 'ring-2 ring-primary/40'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold',
                        avatarTone
                      )}
                    >
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={p.fullName}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : p.fullName ? (
                        getInitials(p.fullName)
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground" title={p.fullName}>
                        {p.fullName}
                      </p>
                      {life && <p className="truncate text-[10px] text-muted-foreground">{life}</p>}
                      {node.spouses.length > 0 && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[9.5px] text-rose-600 dark:text-rose-400">
                          <Heart className="h-2.5 w-2.5 shrink-0 fill-current" />
                          <span className="truncate">{node.spouses[0].fullName}</span>
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <div className="pointer-events-none hidden sm:block absolute bottom-3 right-3 z-10 rounded-lg border border-border/60 bg-card/85 px-2.5 py-1 text-[10px] text-muted-foreground">
          Geser atau cubit layar untuk zoom · Klik 2x kartu untuk pindah pusat
        </div>
      </div>
    </div>
  );
});

HourglassView.displayName = 'HourglassView';
