import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  UserPlus,
  ArrowUpLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Person, Relationship } from '@/types';

interface PedigreeViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent') => void;
  maxGenerations?: number;
}

interface RealAncestorNode {
  kind: 'person';
  id: string;
  person: Person;
  generation: number;
  role: 'subject' | 'father' | 'mother';
  father: LayoutSourceNode | null;
  mother: LayoutSourceNode | null;
}

interface PlaceholderAncestorNode {
  kind: 'placeholder';
  id: string;
  generation: number;
  role: 'father' | 'mother';
  childPersonId: string;
  label: string;
}

type LayoutSourceNode = RealAncestorNode | PlaceholderAncestorNode;

interface PositionedNode {
  node: LayoutSourceNode;
  x: number;
  y: number;
}

interface ConnectorEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  role: 'father' | 'mother';
  isPlaceholder: boolean;
}

const CARD_W = 204;
const CARD_H = 74;
const COL_GAP = 68;
const ROW_GAP = 16;
const HEADER_H = 34;

const GEN_LABELS = ['Subjek', 'Orang Tua', 'Kakek / Nenek', 'Buyut', 'Canggah', 'Wareng'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function extractYear(date?: string | null): string | null {
  if (!date) return null;
  const match = date.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatLifeSpan(person: Person): string {
  const b = extractYear(person.birthDate);
  const d = extractYear(person.deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return `l. ${b}`;
  if (d) return `† ${d}`;
  return 'Tahun belum tercatat';
}

export const PedigreeView = memo(function PedigreeView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
  maxGenerations: initialMaxGenerations = 4,
}: PedigreeViewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [depthLimit, setDepthLimit] = useState(Math.min(5, Math.max(2, initialMaxGenerations)));
  const [showPlaceholders, setShowPlaceholders] = useState(Boolean(onAddRelationship));

  // Subject tracking (allows double-clicking an ancestor to inspect their pedigree & go back)
  const [subjectId, setSubjectId] = useState<string | null>(selectedPersonId);
  const [subjectHistory, setSubjectHistory] = useState<string[]>([]);

  // Pan & Zoom state (transformOrigin = '0 0')
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(
    null
  );

  // Sync subject when external selectedPersonId changes
  useEffect(() => {
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) {
      setSubjectId(selectedPersonId);
      setSubjectHistory([]);
    } else if (!subjectId && persons.length > 0) {
      setSubjectId(persons[0].id);
    }
  }, [selectedPersonId, persons]); // eslint-disable-line react-hooks/exhaustive-deps

  // Observe stage container size
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    update();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setStageSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fast parent lookup
  const { personById, parentsByChild } = useMemo(() => {
    const pMap = new Map(persons.map((p) => [p.id, p]));
    const parentMap = new Map<string, Person[]>();

    for (const rel of relationships) {
      if (rel.type !== 'PARENT_CHILD') continue;
      const parent = pMap.get(rel.fromPersonId);
      if (!parent) continue;
      const list = parentMap.get(rel.toPersonId);
      if (list) {
        if (!list.some((existing) => existing.id === parent.id)) {
          list.push(parent);
        }
      } else {
        parentMap.set(rel.toPersonId, [parent]);
      }
    }

    return { personById: pMap, parentsByChild: parentMap };
  }, [persons, relationships]);

  const subjectPerson = subjectId ? personById.get(subjectId) ?? null : null;

  // Build ancestor tree + measure actual recorded ancestor depth & count
  const { rootNode, recordedMaxDepth, recordedAncestorCount } = useMemo(() => {
    if (!subjectPerson) {
      return { rootNode: null, recordedMaxDepth: 0, recordedAncestorCount: 0 };
    }

    // First compute true recorded depth (up to 6) independent of depthLimit
    const measureMaxDepth = (personId: string, depth: number, visited: Set<string>): number => {
      if (depth >= 6 || visited.has(personId)) return depth;
      const nextVisited = new Set(visited);
      nextVisited.add(personId);
      const parents = parentsByChild.get(personId) ?? [];
      if (parents.length === 0) return depth;
      return Math.max(...parents.map((p) => measureMaxDepth(p.id, depth + 1, nextVisited)));
    };

    const maxRec = measureMaxDepth(subjectPerson.id, 1, new Set());
    const uniqueAncestors = new Set<string>();

    const buildNode = (
      person: Person,
      generation: number,
      role: 'subject' | 'father' | 'mother',
      visited: Set<string>
    ): RealAncestorNode => {
      if (generation > 0) uniqueAncestors.add(person.id);

      const nextVisited = new Set(visited);
      nextVisited.add(person.id);

      let father: LayoutSourceNode | null = null;
      let mother: LayoutSourceNode | null = null;

      if (generation < depthLimit - 1) {
        const candidates = (parentsByChild.get(person.id) ?? []).filter(
          (p) => !nextVisited.has(p.id)
        );

        let fatherPerson: Person | null = null;
        let motherPerson: Person | null = null;

        for (const p of candidates) {
          if (p.gender === 'male' && !fatherPerson) {
            fatherPerson = p;
          } else if (p.gender === 'female' && !motherPerson) {
            motherPerson = p;
          } else if (!fatherPerson) {
            fatherPerson = p;
          } else if (!motherPerson) {
            motherPerson = p;
          }
        }

        if (fatherPerson) {
          father = buildNode(fatherPerson, generation + 1, 'father', nextVisited);
        } else if (showPlaceholders) {
          father = {
            kind: 'placeholder',
            id: `ph-father-${person.id}-${generation + 1}`,
            generation: generation + 1,
            role: 'father',
            childPersonId: person.id,
            label: '+ Tambah Ayah',
          };
        }

        if (motherPerson) {
          mother = buildNode(motherPerson, generation + 1, 'mother', nextVisited);
        } else if (showPlaceholders) {
          mother = {
            kind: 'placeholder',
            id: `ph-mother-${person.id}-${generation + 1}`,
            generation: generation + 1,
            role: 'mother',
            childPersonId: person.id,
            label: '+ Tambah Ibu',
          };
        }
      }

      return {
        kind: 'person',
        id: `${person.id}-g${generation}-${role}`,
        person,
        generation,
        role,
        father,
        mother,
      };
    };

    const built = buildNode(subjectPerson, 0, 'subject', new Set());
    return {
      rootNode: built,
      recordedMaxDepth: maxRec,
      recordedAncestorCount: uniqueAncestors.size,
    };
  }, [subjectPerson, parentsByChild, depthLimit, showPlaceholders]);

  // Deterministic post-order layout: exact coordinates for every card & Bézier edge
  const layout = useMemo(() => {
    if (!rootNode) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as ConnectorEdge[],
        treeWidth: 0,
        treeHeight: 0,
        renderedGenerations: 0,
      };
    }

    const nodes: PositionedNode[] = [];
    const edges: ConnectorEdge[] = [];
    let nextLeafY = HEADER_H;
    let maxGen = 0;

    const place = (node: LayoutSourceNode): { x: number; y: number } => {
      const x = node.generation * (CARD_W + COL_GAP);
      maxGen = Math.max(maxGen, node.generation);

      if (node.kind === 'placeholder') {
        const y = nextLeafY;
        nextLeafY += CARD_H + ROW_GAP;
        nodes.push({ node, x, y });
        return { x, y };
      }

      const childPositions: { pos: { x: number; y: number }; child: LayoutSourceNode }[] = [];
      if (node.father) {
        childPositions.push({ pos: place(node.father), child: node.father });
      }
      if (node.mother) {
        childPositions.push({ pos: place(node.mother), child: node.mother });
      }

      let y: number;
      if (childPositions.length === 0) {
        y = nextLeafY;
        nextLeafY += CARD_H + ROW_GAP;
      } else {
        const firstY = childPositions[0].pos.y;
        const lastY = childPositions[childPositions.length - 1].pos.y;
        y = (firstY + lastY) / 2;
      }

      nodes.push({ node, x, y });

      for (const { pos, child } of childPositions) {
        edges.push({
          id: `${node.id}->${child.id}`,
          fromX: x + CARD_W,
          fromY: y + CARD_H / 2,
          toX: pos.x,
          toY: pos.y + CARD_H / 2,
          role: child.role === 'father' ? 'father' : 'mother',
          isPlaceholder: child.kind === 'placeholder',
        });
      }

      return { x, y };
    };

    place(rootNode);

    const treeWidth = (maxGen + 1) * CARD_W + maxGen * COL_GAP;
    const treeHeight = Math.max(HEADER_H + CARD_H, nextLeafY - ROW_GAP);

    return {
      nodes,
      edges,
      treeWidth,
      treeHeight,
      renderedGenerations: maxGen + 1,
    };
  }, [rootNode]);

  // Exact Fit-to-Screen calculation using transformOrigin '0 0'
  const fitToScreen = useCallback(() => {
    if (
      stageSize.width <= 0 ||
      stageSize.height <= 0 ||
      layout.treeWidth <= 0 ||
      layout.treeHeight <= 0
    ) {
      return;
    }

    const padX = stageSize.width < 640 ? 24 : 52;
    const padY = stageSize.height < 500 ? 28 : 48;
    const availW = Math.max(120, stageSize.width - padX * 2);
    const availH = Math.max(120, stageSize.height - padY * 2);

    const rawScale = Math.min(availW / layout.treeWidth, availH / layout.treeHeight, 1.1);
    const scale = Math.max(0.28, Number(rawScale.toFixed(3)));

    const x = (stageSize.width - layout.treeWidth * scale) / 2;
    const y = (stageSize.height - layout.treeHeight * scale) / 2;

    setTransform({ x, y, scale });
  }, [stageSize.width, stageSize.height, layout.treeWidth, layout.treeHeight]);

  // Auto-fit whenever tree dimensions or stage size change
  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Smooth zoom around stage center (buttons) or cursor (wheel)
  const zoomAtPoint = useCallback((factor: number, focalX: number, focalY: number) => {
    setTransform((prev) => {
      const nextScale = Math.max(0.25, Math.min(2.2, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: focalX - (focalX - prev.x) * ratio,
        y: focalY - (focalY - prev.y) * ratio,
      };
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      zoomAtPoint(factor, focalX, focalY);
    },
    [zoomAtPoint]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        x: transform.x,
        y: transform.y,
      };
    },
    [transform.x, transform.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setTransform((prev) => ({
      ...prev,
      x: panStartRef.current!.x + dx,
      y: panStartRef.current!.y + dy,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleFocusAsSubject = useCallback(
    (personId: string) => {
      if (personId === subjectId) return;
      if (subjectId) {
        setSubjectHistory((hist) => [...hist, subjectId]);
      }
      setSubjectId(personId);
      onSelectPerson(personId);
    },
    [subjectId, onSelectPerson]
  );

  const handleGoBackSubject = useCallback(() => {
    setSubjectHistory((hist) => {
      if (hist.length === 0) return hist;
      const prev = hist[hist.length - 1];
      setSubjectId(prev);
      onSelectPerson(prev);
      return hist.slice(0, -1);
    });
  }, [onSelectPerson]);

  if (!subjectPerson || !rootNode) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-muted-foreground">
        <p className="text-sm">Belum ada anggota keluarga untuk ditampilkan pada silsilah leluhur.</p>
      </div>
    );
  }

  const prevSubjectName =
    subjectHistory.length > 0
      ? personById.get(subjectHistory[subjectHistory.length - 1])?.fullName
      : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Slim Top Control Bar */}
      <div
        data-export-ignore="true"
        className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-background/75 px-3 py-2 backdrop-blur-md"
      >
        {/* Left: Subject summary + back button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-[11px] font-semibold text-primary overflow-hidden">
              {subjectPerson.photoUrl ? (
                <img
                  src={subjectPerson.photoUrl}
                  alt={subjectPerson.fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(subjectPerson.fullName)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-foreground max-w-[160px] sm:max-w-[220px]">
                  {subjectPerson.fullName}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  Tercatat {recordedMaxDepth} gen · {recordedAncestorCount} leluhur
                </span>
              </div>
            </div>
          </div>

          {subjectHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[11px]"
              onClick={handleGoBackSubject}
              title={`Kembali ke ${prevSubjectName ?? 'sebelumnya'}`}
            >
              <ArrowUpLeft className="h-3 w-3" />
              <span className="max-w-[110px] truncate">{prevSubjectName || 'Kembali'}</span>
            </Button>
          )}
        </div>

        {/* Right: Depth selector + Placeholder toggle + Legend */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Depth Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Kedalaman:</span>
            <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
              {[2, 3, 4, 5].map((gen) => {
                const isActive = depthLimit === gen;
                const exceedsData = gen > recordedMaxDepth + (showPlaceholders ? 1 : 0);
                return (
                  <button
                    key={gen}
                    type="button"
                    onClick={() => setDepthLimit(gen)}
                    title={
                      exceedsData
                        ? `${gen} generasi (data saat ini tercatat hingga ${recordedMaxDepth} gen)`
                        : `Tampilkan hingga ${gen} generasi`
                    }
                    className={cn(
                      'h-6 min-w-[26px] rounded-md px-2 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'bg-background text-foreground shadow-sm'
                        : exceedsData
                          ? 'text-muted-foreground/45 hover:text-muted-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {gen}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle Empty Placeholder Slots */}
          {onAddRelationship && (
            <Button
              variant={showPlaceholders ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 gap-1 rounded-lg px-2.5 text-[11px]"
              onClick={() => setShowPlaceholders((prev) => !prev)}
              title="Tampilkan atau sembunyikan slot + Ayah / + Ibu yang belum tercatat"
            >
              <UserPlus className="h-3 w-3" />
              <span className="hidden sm:inline">Slot Kosong</span>
            </Button>
          )}
        </div>
      </div>

      {/* Full-Viewport Interactive Stage */}
      <div
        ref={stageRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          'relative flex-1 min-h-0 w-full overflow-hidden select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${layout.treeWidth}px`,
            height: `${layout.treeHeight}px`,
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 160ms ease-out',
            willChange: 'transform',
          }}
        >
          {/* Generation Column Headers */}
          {Array.from({ length: layout.renderedGenerations }).map((_, genIdx) => (
            <div
              key={`hdr-${genIdx}`}
              style={{
                position: 'absolute',
                left: `${genIdx * (CARD_W + COL_GAP)}px`,
                top: 0,
                width: `${CARD_W}px`,
                height: `${HEADER_H - 8}px`,
              }}
              className="flex items-center justify-center"
            >
              <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm">
                {GEN_LABELS[genIdx] || `Generasi +${genIdx}`}
              </span>
            </div>
          ))}

          {/* Curved SVG Connectors */}
          <svg
            width={layout.treeWidth}
            height={layout.treeHeight}
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            {layout.edges.map((edge) => {
              const midX = (edge.fromX + edge.toX) / 2;
              const d = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
              const stroke = edge.isPlaceholder
                ? 'hsl(var(--border))'
                : edge.role === 'father'
                  ? 'hsl(var(--node-male))'
                  : 'hsl(var(--node-female))';
              return (
                <g key={edge.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={edge.isPlaceholder ? 1.5 : 2}
                    strokeDasharray={edge.isPlaceholder ? '5 4' : undefined}
                    strokeOpacity={edge.isPlaceholder ? 0.65 : 0.78}
                    strokeLinecap="round"
                  />
                  {!edge.isPlaceholder && (
                    <circle cx={edge.toX} cy={edge.toY} r={3} fill={stroke} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Positioned Cards */}
          {layout.nodes.map(({ node, x, y }) => {
            if (node.kind === 'placeholder') {
              const isFather = node.role === 'father';
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onAddRelationship?.(node.childPersonId, 'parent')}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${CARD_W}px`,
                    height: `${CARD_H}px`,
                  }}
                  className={cn(
                    'group flex items-center justify-center gap-2 rounded-2xl border border-dashed bg-background/60 px-3 text-xs font-medium text-muted-foreground transition-all hover:bg-background/95 hover:text-foreground hover:shadow-sm',
                    isFather
                      ? 'border-node-male/40 hover:border-node-male'
                      : 'border-node-female/40 hover:border-node-female'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                      isFather
                        ? 'border-node-male/30 bg-node-male/10 text-node-male'
                        : 'border-node-female/30 bg-node-female/10 text-node-female'
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span>{node.label}</span>
                </button>
              );
            }

            const { person } = node;
            const isSelected = person.id === selectedPersonId;
            const isVerified = person.tags.includes('verified');
            const isMale = person.gender === 'male';
            const isFemale = person.gender === 'female';

            return (
              <button
                key={node.id}
                type="button"
                data-person-id={person.id}
                onClick={() => onSelectPerson(person.id)}
                onDoubleClick={() => handleFocusAsSubject(person.id)}
                title={`${person.fullName} · Klik ganda untuk jadikan subjek`}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${CARD_W}px`,
                  height: `${CARD_H}px`,
                }}
                className={cn(
                  'group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border bg-card/95 px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  isSelected
                    ? 'border-accent ring-2 ring-accent/40 bg-accent/[0.06]'
                    : 'border-border/80 hover:border-primary/50'
                )}
              >
                {/* Gender side bar */}
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 w-1',
                    isMale
                      ? 'bg-node-male'
                      : isFemale
                        ? 'bg-node-female'
                        : 'bg-node-unknown'
                  )}
                />

                {/* Avatar */}
                <div
                  className={cn(
                    'ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden border',
                    isMale
                      ? 'bg-node-male/15 text-node-male border-node-male/30'
                      : isFemale
                        ? 'bg-node-female/15 text-node-female border-node-female/30'
                        : 'bg-node-unknown/15 text-node-unknown border-node-unknown/30'
                  )}
                >
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt={person.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(person.fullName)}</span>
                  )}
                </div>

                {/* Name & Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate font-display text-[13px] font-semibold text-foreground leading-tight">
                      {person.fullName}
                    </p>
                    {isVerified && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {formatLifeSpan(person)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom-Left Hint + Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 rounded-xl border border-border/60 bg-background/85 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-node-male" />
              Garis Ayah (atas)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-node-female" />
              Garis Ibu (bawah)
            </span>
            <span className="hidden lg:inline text-muted-foreground/75">
              · Klik 2× kartu untuk pindah subjek
            </span>
          </div>
        </div>

        {/* Bottom-Right Floating Zoom & Fit Controls */}
        <div
          data-export-ignore="true"
          className="absolute bottom-3 right-3 z-10 flex items-center rounded-xl border border-border/70 bg-background/88 p-0.5 shadow-sm backdrop-blur-md"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => zoomAtPoint(0.84, stageSize.width / 2, stageSize.height / 2)}
            title="Perkecil"
            aria-label="Perkecil silsilah leluhur"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-[11px] font-medium tabular-nums"
            onClick={fitToScreen}
            title="Sesuaikan layar (Fit)"
          >
            <Maximize2 className="mr-1 h-3 w-3" />
            {Math.round(transform.scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => zoomAtPoint(1.2, stageSize.width / 2, stageSize.height / 2)}
            title="Perbesar"
            aria-label="Perbesar silsilah leluhur"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

PedigreeView.displayName = 'PedigreeView';
