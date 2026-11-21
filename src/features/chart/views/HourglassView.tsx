import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { useTheme } from 'next-themes';
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

export function HourglassView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: HourglassViewProps) {
  const [centerPersonId, setCenterPersonId] = useState<string | null>(selectedPersonId);
  const [ancestorDepth, setAncestorDepth] = useState<number>(3);
  const [descendantDepth, setDescendantDepth] = useState<number>(3);
  const [zoomScale, setZoomScale] = useState<number>(0.95);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomScale((z) => Math.max(0.45, Math.min(2, z * factor)));
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
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleReset = () => {
    setZoomScale(0.95);
    setPan({ x: 0, y: 0 });
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/85 px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={centerPersonId || ''}
            onValueChange={(val) => {
              setCenterPersonId(val);
              onSelectPerson(val);
              handleReset();
            }}
          >
            <SelectTrigger className="h-8 w-[185px] bg-background/90 text-xs">
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
            <SelectTrigger className="h-8 w-[138px] bg-background/90 text-xs">
              <ArrowUp className="mr-1 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" className="text-xs">Leluhur: 1 gen</SelectItem>
              <SelectItem value="2" className="text-xs">Leluhur: 2 gen</SelectItem>
              <SelectItem value="3" className="text-xs">Leluhur: 3 gen</SelectItem>
              <SelectItem value="4" className="text-xs">Leluhur: 4 gen</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(descendantDepth)}
            onValueChange={(v) => setDescendantDepth(Number(v))}
          >
            <SelectTrigger className="h-8 w-[148px] bg-background/90 text-xs">
              <ArrowDown className="mr-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" className="text-xs">Keturunan: 1 gen</SelectItem>
              <SelectItem value="2" className="text-xs">Keturunan: 2 gen</SelectItem>
              <SelectItem value="3" className="text-xs">Keturunan: 3 gen</SelectItem>
              <SelectItem value="4" className="text-xs">Keturunan: 4 gen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
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
              onClick={() => setZoomScale((z) => Math.max(0.45, z * 0.85))}
              title="Perkecil"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none border-x"
              onClick={handleReset}
              title="Reset posisi"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={() => setZoomScale((z) => Math.min(2, z * 1.15))}
              title="Perbesar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

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
        </div>
      </div>

      {/* Canvas */}
      <div
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          'relative flex-1 overflow-auto select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          className="mx-auto origin-top"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
            transformOrigin: 'top center',
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
                    onClick={() => onSelectPerson(p.id)}
                    onDoubleClick={() => {
                      setCenterPersonId(p.id);
                      onSelectPerson(p.id);
                    }}
                    className={cn(
                      'flex h-full w-full items-center gap-2 rounded-xl border-2 bg-card px-2.5 py-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
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
                        <img src={p.photoUrl} alt={p.fullName} className="h-full w-full object-cover" />
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
        <div className="pointer-events-none hidden sm:block fixed bottom-4 right-4 z-10 rounded-lg border border-border/60 bg-card/85 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
          Klik 2x kartu untuk memindahkan pusat jam pasir
        </div>
      </div>
    </div>
  );
}
