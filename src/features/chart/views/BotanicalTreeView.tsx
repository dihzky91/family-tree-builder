import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  TreeDeciduous,
  Sparkles,
  User,
  Heart,
  Download,
  Palette,
  GitFork,
  Compass,
  Minus,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportTreeAsImage } from '@/features/chart/utils/exportTreeAsImage';
import { cn } from '@/lib/utils';
import type { Person, Relationship } from '@/types';

interface BotanicalTreeViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

type TreeDirectionMode = 'descendants' | 'ancestors';
type SeasonTheme = 'emerald' | 'sakura' | 'autumn';

interface BotanicalTreeNode {
  person: Person;
  spouses: Person[];
  children: BotanicalTreeNode[];
  depth: number;
  leaves: number; // jumlah daun (node ujung) di bawah node ini, min 1
  w: number;
  h: number;
  compact: boolean;
  hiddenCount: number; // anak yang tidak ditampilkan (dilipat / batas generasi)
  isCollapsed: boolean; // dilipat manual oleh user
}

interface PlacedNode {
  node: BotanicalTreeNode;
  parent: PlacedNode | null;
  depth: number;
  angle: number; // radian, 0 = lurus ke atas
  span: number; // lebar sudut yang dialokasikan
  x: number;
  y: number;
}

interface PositionedBotanicalNode {
  key: string;
  person: Person;
  spouses: Person[];
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  isRoot: boolean;
  compact: boolean;
  hiddenCount: number;
  isCollapsed: boolean;
  canCollapse: boolean;
}

interface TaperedBranch {
  id: string;
  fillPath: string;
  highlightPath: string;
  depth: number;
}

interface LeafSprite {
  id: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
  variant: 0 | 1 | 2;
}

interface CanopyCluster {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tone: 'deep' | 'mid' | 'light';
}

interface BotanicalLayout {
  nodes: PositionedBotanicalNode[];
  branches: TaperedBranch[];
  leaves: LeafSprite[];
  canopyClusters: CanopyCluster[];
  trunk: { fillPath: string; highlightPath: string } | null;
  halo: { cx: number; cy: number; rx: number; ry: number };
  width: number;
  height: number;
  trunkBaseX: number;
  trunkBaseY: number;
  rootX: number;
  rootY: number;
  totalMembers: number;
  actualGenerations: number;
}

/* ---------- Konstanta layout ---------- */
const FULL_W = 176;
const FULL_H = 82;
const LEAF_W = 148;
const LEAF_H = 64;

const RING_GAP = 44; // jarak minimal antar cincin generasi (di luar ukuran kartu)
const MIN_RING_STEP = 150;
const SLOT_GAP = 22; // jarak minimal antar kartu bersaudara
const TRUNK_H = 170;
const GROUND_PAD = 90;
const FOLIAGE = 130;
const EDGE_PAD = 30;

const MIN_FAN_DEG = 70;
const MAX_FAN_DEG = 170;
const FAN_DEG_PER_LEAF = 20;

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2.5;

const SEASON_PALETTES: Record<
  SeasonTheme,
  {
    label: string;
    skyLight: string;
    skyDark: string;
    trunkStart: string;
    trunkEnd: string;
    trunkHighlight: string;
    canopyDeep: string;
    canopyMid: string;
    canopyLight: string;
    leafFill: string;
    leafStroke: string;
    hillPrimary: string;
    hillSecondary: string;
    accentBadge: string;
  }
> = {
  emerald: {
    label: 'Rindang Zamrud',
    skyLight: 'radial-gradient(circle at 50% 18%, rgba(16,185,129,0.16), rgba(254,249,195,0.22) 48%, transparent 78%)',
    skyDark: 'radial-gradient(circle at 50% 18%, rgba(16,185,129,0.20), rgba(6,78,59,0.25) 52%, transparent 80%)',
    trunkStart: '#5c3a21',
    trunkEnd: '#855834',
    trunkHighlight: '#a67b51',
    canopyDeep: '#15803d',
    canopyMid: '#22c55e',
    canopyLight: '#86efac',
    leafFill: '#16a34a',
    leafStroke: '#14532d',
    hillPrimary: '#15803d',
    hillSecondary: '#166534',
    accentBadge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  },
  sakura: {
    label: 'Sakura Mekar',
    skyLight: 'radial-gradient(circle at 50% 18%, rgba(244,114,182,0.18), rgba(254,242,242,0.3) 50%, transparent 78%)',
    skyDark: 'radial-gradient(circle at 50% 18%, rgba(236,72,153,0.22), rgba(131,24,67,0.24) 52%, transparent 80%)',
    trunkStart: '#4a2c2a',
    trunkEnd: '#6e4744',
    trunkHighlight: '#946864',
    canopyDeep: '#db2777',
    canopyMid: '#f472b6',
    canopyLight: '#fbcfe8',
    leafFill: '#ec4899',
    leafStroke: '#9d174d',
    hillPrimary: '#4d7c0f',
    hillSecondary: '#3f6212',
    accentBadge: 'border-pink-500/40 bg-pink-500/10 text-pink-800 dark:text-pink-200',
  },
  autumn: {
    label: 'Pusaka Keemasan',
    skyLight: 'radial-gradient(circle at 50% 18%, rgba(245,158,11,0.20), rgba(254,243,199,0.28) 50%, transparent 78%)',
    skyDark: 'radial-gradient(circle at 50% 18%, rgba(217,119,6,0.22), rgba(120,53,15,0.26) 52%, transparent 80%)',
    trunkStart: '#452714',
    trunkEnd: '#6e4021',
    trunkHighlight: '#9c6239',
    canopyDeep: '#b45309',
    canopyMid: '#f59e0b',
    canopyLight: '#fde68a',
    leafFill: '#d97706',
    leafStroke: '#78350f',
    hillPrimary: '#92400e',
    hillSecondary: '#78350f',
    accentBadge: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  },
};

const EMPTY_LAYOUT: BotanicalLayout = {
  nodes: [],
  branches: [],
  leaves: [],
  canopyClusters: [],
  trunk: null,
  halo: { cx: 480, cy: 300, rx: 300, ry: 200 },
  width: 960,
  height: 680,
  trunkBaseX: 480,
  trunkBaseY: 560,
  rootX: 480,
  rootY: 400,
  totalMembers: 0,
  actualGenerations: 0,
};

/* ---------- Helper umum ---------- */
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
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Hash string -> uint32 (FNV-1a). Dipakai sebagai seed supaya "acak" tapi konsisten tiap render. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ketebalan cabang mengikuti jumlah daun di bawahnya. */
const branchRadius = (leaves: number) => Math.min(18, 2.2 + Math.sqrt(leaves) * 1.7);

interface Pt {
  x: number;
  y: number;
}
interface BranchSample {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * Cabang meruncing mengikuti kurva bezier kubik (p0 -> p3) dengan radius r0 -> r1.
 * Mengembalikan poligon isi, garis highlight, dan titik-titik sampel (untuk menempel daun).
 */
function buildTaperedBranch(p0: Pt, p1: Pt, p2: Pt, p3: Pt, r0: number, r1: number) {
  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const steps = clamp(Math.round(dist / 30), 12, 40);
  const samples: BranchSample[] = [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const hl: Pt[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
    let dx = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
    let dy = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85);
    const nx = -dy;
    const ny = dx;
    left.push({ x: x + nx * r, y: y + ny * r });
    right.push({ x: x - nx * r, y: y - ny * r });
    hl.push({ x: x + nx * r * 0.35, y: y + ny * r * 0.35 });
    samples.push({ x, y, dx, dy });
  }

  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const fillPath = `M ${f(left[0])} ${left
    .slice(1)
    .map((p) => `L ${f(p)}`)
    .join(' ')} ${[...right]
      .reverse()
      .map((p) => `L ${f(p)}`)
      .join(' ')} Z`;
  const highlightPath = `M ${f(hl[0])} ${hl
    .slice(1)
    .map((p) => `L ${f(p)}`)
    .join(' ')}`;

  return { fillPath, highlightPath, samples };
}

export function BotanicalTreeView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: BotanicalTreeViewProps) {
  const [rootPersonId, setRootPersonId] = useState<string | null>(selectedPersonId);
  const [directionMode, setDirectionMode] = useState<TreeDirectionMode>('descendants');
  const [maxGenerations, setMaxGenerations] = useState<number>(4);
  const [season, setSeason] = useState<SeasonTheme>('emerald');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState({ x: 0, y: 0, k: 0.9 });
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const palette = SEASON_PALETTES[season];

  /* ---------- Graph maps ---------- */
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

    const countDescendants = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const kids = childrenOf.get(id) || [];
      let total = kids.length;
      kids.forEach((k) => {
        total += countDescendants(k.id, visited);
      });
      return total;
    };

    const bestAncestorRoot = [...persons].sort((a, b) => {
      const aHasNoParents = (parentsOf.get(a.id)?.length || 0) === 0 ? 1000 : 0;
      const bHasNoParents = (parentsOf.get(b.id)?.length || 0) === 0 ? 1000 : 0;
      const aDesc = countDescendants(a.id);
      const bDesc = countDescendants(b.id);
      return bHasNoParents + bDesc - (aHasNoParents + aDesc);
    })[0];

    return { personMap, parentsOf, childrenOf, spousesOf, bestAncestorRoot };
  }, [persons, relationships]);

  /* ---------- Pilih root awal ---------- */
  useEffect(() => {
    if (rootPersonId && persons.some((p) => p.id === rootPersonId)) return;
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) {
      const selectedHasKids = (graphMaps.childrenOf.get(selectedPersonId)?.length || 0) > 0;
      if (selectedHasKids || directionMode === 'ancestors') {
        setRootPersonId(selectedPersonId);
        return;
      }
    }
    if (graphMaps.bestAncestorRoot) {
      setRootPersonId(graphMaps.bestAncestorRoot.id);
    } else if (persons.length > 0) {
      setRootPersonId(persons[0].id);
    }
  }, [persons, selectedPersonId, rootPersonId, graphMaps, directionMode]);

  // Lipatan dibersihkan kalau akar / arah berubah
  useEffect(() => {
    setCollapsed(new Set());
  }, [rootPersonId, directionMode]);

  /* ---------- Layout kipas (fan) ---------- */
  const layout = useMemo<BotanicalLayout>(() => {
    if (!rootPersonId) return EMPTY_LAYOUT;
    const rootPerson = graphMaps.personMap.get(rootPersonId);
    if (!rootPerson) return EMPTY_LAYOUT;

    /* 1. Bangun pohon (dengan batas generasi + lipatan) */
    const buildTree = (person: Person, depth: number, visited: Set<string>): BotanicalTreeNode => {
      const nextVisited = new Set(visited);
      nextVisited.add(person.id);

      const raw =
        directionMode === 'descendants'
          ? graphMaps.childrenOf.get(person.id) || []
          : graphMaps.parentsOf.get(person.id) || [];
      const valid = raw.filter((p) => !nextVisited.has(p.id));

      const atLimit = depth >= maxGenerations - 1;
      const isCollapsed = !atLimit && depth > 0 && valid.length > 0 && collapsed.has(person.id);
      const hide = atLimit || isCollapsed;

      const children = hide ? [] : valid.map((c) => buildTree(c, depth + 1, nextVisited));
      const hiddenCount = hide ? valid.length : 0;
      const leaves = children.length ? children.reduce((acc, c) => acc + c.leaves, 0) : 1;
      const compact = depth > 0 && children.length === 0 && hiddenCount === 0;

      return {
        person,
        spouses: graphMaps.spousesOf.get(person.id) || [],
        depth,
        children,
        leaves,
        compact,
        hiddenCount,
        isCollapsed,
        w: compact ? LEAF_W : FULL_W,
        h: compact ? LEAF_H : FULL_H,
      };
    };

    const tree = buildTree(rootPerson, 0, new Set());

    /* 2. Bagi sudut kipas sebanding jumlah daun */
    const fan =
      (clamp(tree.leaves * FAN_DEG_PER_LEAF, MIN_FAN_DEG, MAX_FAN_DEG) * Math.PI) / 180;
    const placed: PlacedNode[] = [];

    const assign = (node: BotanicalTreeNode, parent: PlacedNode | null, a0: number, a1: number) => {
      const p: PlacedNode = {
        node,
        parent,
        depth: node.depth,
        angle: (a0 + a1) / 2,
        span: a1 - a0,
        x: 0,
        y: 0,
      };
      placed.push(p);
      let a = a0;
      node.children.forEach((c) => {
        const share = ((a1 - a0) * c.leaves) / node.leaves;
        assign(c, p, a, a + share);
        a += share;
      });
    };
    assign(tree, null, -fan / 2, fan / 2);

    /* 3. Radius tiap cincin generasi: cukup jauh supaya kartu tidak bertabrakan */
    const maxDepth = placed.reduce((m, p) => Math.max(m, p.depth), 0);
    const radii: number[] = [0];
    for (let d = 1; d <= maxDepth; d++) {
      let radialNeed = MIN_RING_STEP;
      let slotRadius = 0;
      placed.forEach((p) => {
        if (p.depth !== d || !p.parent) return;
        const s = Math.abs(Math.sin(p.angle));
        const c = Math.abs(Math.cos(p.angle));
        const par = p.parent.node;
        // jarak orang tua -> anak sepanjang arah radial
        radialNeed = Math.max(
          radialNeed,
          s * (par.w + p.node.w) * 0.5 + c * (par.h + p.node.h) * 0.5 + RING_GAP
        );
        // jarak antar saudara sepanjang busur (tangensial)
        const slot = c * p.node.w + s * p.node.h + SLOT_GAP;
        slotRadius = Math.max(slotRadius, slot / Math.max(p.span, 0.001));
      });
      radii[d] = Math.max(radii[d - 1] + radialNeed, slotRadius);
    }

    placed.forEach((p) => {
      const r = radii[p.depth];
      p.x = r * Math.sin(p.angle);
      p.y = -r * Math.cos(p.angle);
    });

    /* 4. Bounding box -> ukuran kanvas + offset */
    let nMinX = Infinity;
    let nMaxX = -Infinity;
    let nMinY = Infinity;
    let nMaxY = -Infinity;
    placed.forEach((p) => {
      nMinX = Math.min(nMinX, p.x - p.node.w / 2);
      nMaxX = Math.max(nMaxX, p.x + p.node.w / 2);
      nMinY = Math.min(nMinY, p.y - p.node.h / 2);
      nMaxY = Math.max(nMaxY, p.y + p.node.h / 2);
    });

    const minX = Math.min(-300, nMinX - FOLIAGE) - EDGE_PAD;
    const maxX = Math.max(300, nMaxX + FOLIAGE) + EDGE_PAD;
    const minY = nMinY - FOLIAGE - EDGE_PAD;
    const maxY = Math.max(nMaxY, 0) + TRUNK_H + GROUND_PAD;

    const width = Math.max(860, maxX - minX);
    const height = maxY - minY;
    const ox = width / 2 - (minX + maxX) / 2;
    const oy = -minY;

    placed.forEach((p) => {
      p.x += ox;
      p.y += oy;
    });

    const rootX = ox;
    const rootY = oy;
    const trunkBaseY = oy + TRUNK_H;

    /* 5. Cabang, daun, kanopi */
    const dirOf = (q: PlacedNode): Pt =>
      q.depth === 0 ? { x: 0, y: -1 } : { x: Math.sin(q.angle), y: -Math.cos(q.angle) };

    const branches: TaperedBranch[] = [];
    const leaves: LeafSprite[] = [];
    const canopyClusters: CanopyCluster[] = [];

    placed.forEach((p, idx) => {
      const id = p.node.person.id;
      const rnd = mulberry32(hashString(`${id}-${idx}`));
      const out = dirOf(p);

      // Kanopi lembut di sekitar tiap node (condong ke arah luar kipas)
      canopyClusters.push({
        id: `canopy-${p.depth}-${id}-${idx}`,
        cx: p.x + out.x * 30,
        cy: p.y + out.y * 30,
        rx: p.node.compact ? 105 : 135,
        ry: p.node.compact ? 80 : 92,
        tone: p.depth === maxDepth ? 'light' : p.depth === 0 ? 'deep' : 'mid',
      });

      // Taburan daun di sekitar kartu
      const leafCount = p.node.compact ? 9 : 6;
      for (let i = 0; i < leafCount; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = Math.sqrt(rnd());
        leaves.push({
          id: `leaf-n-${idx}-${i}`,
          x: p.x + out.x * 26 + Math.cos(a) * rr * (p.node.w * 0.62 + 30),
          y: p.y + out.y * 26 + Math.sin(a) * rr * (p.node.h * 0.9 + 30),
          rot: Math.floor(rnd() * 360),
          scale: 0.5 + rnd() * 0.5,
          variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
        });
      }

      // Cabang dari orang tua ke node ini
      if (!p.parent) return;
      const par = p.parent;
      const P0: Pt = { x: par.x, y: par.y };
      const P3: Pt = { x: p.x, y: p.y };
      const len = Math.hypot(P3.x - P0.x, P3.y - P0.y) || 1;
      const dp = dirOf(par);
      const dc = dirOf(p);
      const perpX = -(P3.y - P0.y) / len;
      const perpY = (P3.x - P0.x) / len;
      const sway = (rnd() - 0.5) * 0.16 * len;

      const P1: Pt = { x: P0.x + dp.x * len * 0.45 + perpX * sway, y: P0.y + dp.y * len * 0.45 + perpY * sway };
      const P2: Pt = { x: P3.x - dc.x * len * 0.35 + perpX * sway, y: P3.y - dc.y * len * 0.35 + perpY * sway };

      const rad = branchRadius(p.node.leaves);
      const b = buildTaperedBranch(P0, P1, P2, P3, rad * 1.2 + 0.8, Math.max(1.8, rad * 0.65));

      branches.push({
        id: `branch-${par.node.person.id}-${id}-${idx}`,
        fillPath: b.fillPath,
        highlightPath: b.highlightPath,
        depth: p.depth,
      });

      // Daun yang tumbuh dari sisi cabang
      const picks: Array<[number, number]> = [
        [Math.floor(b.samples.length * 0.5), 1],
        [Math.floor(b.samples.length * 0.5), -1],
        [Math.floor(b.samples.length * 0.8), 1],
        [Math.floor(b.samples.length * 0.8), -1],
      ];
      picks.forEach(([si, side], k) => {
        const s = b.samples[si];
        const base = (Math.atan2(s.dy, s.dx) * 180) / Math.PI;
        leaves.push({
          id: `leaf-b-${idx}-${k}`,
          x: s.x,
          y: s.y,
          rot: base + side * (40 + rnd() * 25),
          scale: 0.55 + rnd() * 0.3,
          variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
        });
      });
    });

    /* 6. Batang utama */
    const rootRad = branchRadius(tree.leaves);
    const topR = rootRad * 1.25 + 2;
    const baseR = topR * 1.8 + 10;
    const trunkSway = (mulberry32(hashString(rootPerson.id))() - 0.5) * 40;
    const trunkShape = buildTaperedBranch(
      { x: ox, y: trunkBaseY + 12 },
      { x: ox + trunkSway, y: oy + TRUNK_H * 0.62 },
      { x: ox - trunkSway * 0.4, y: oy + TRUNK_H * 0.28 },
      { x: ox, y: oy },
      baseR,
      topR
    );

    const nodes: PositionedBotanicalNode[] = placed.map((p, idx) => ({
      key: `botanical-${p.depth}-${p.node.person.id}-${idx}`,
      person: p.node.person,
      spouses: p.node.spouses,
      x: p.x,
      y: p.y,
      w: p.node.w,
      h: p.node.h,
      depth: p.depth,
      isRoot: p.depth === 0,
      compact: p.node.compact,
      hiddenCount: p.node.hiddenCount,
      isCollapsed: p.node.isCollapsed,
      canCollapse: p.depth > 0 && p.node.children.length > 0,
    }));

    return {
      nodes,
      branches,
      leaves,
      canopyClusters,
      trunk: { fillPath: trunkShape.fillPath, highlightPath: trunkShape.highlightPath },
      halo: {
        cx: (nMinX + nMaxX) / 2 + ox,
        cy: (nMinY + nMaxY) / 2 + oy,
        rx: (nMaxX - nMinX) / 2 + 120,
        ry: (nMaxY - nMinY) / 2 + 110,
      },
      width,
      height,
      trunkBaseX: ox,
      trunkBaseY,
      rootX,
      rootY,
      totalMembers: nodes.length,
      actualGenerations: maxDepth + 1,
    };
  }, [rootPersonId, directionMode, maxGenerations, graphMaps, collapsed]);

  /* ---------- Zoom & pan (transform saja, tanpa scrollbar) ---------- */
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return;
    const k = clamp(Math.min(cw / layout.width, ch / layout.height) * 0.96, MIN_ZOOM, 1);
    setView({ k, x: (cw - layout.width * k) / 2, y: (ch - layout.height * k) / 2 });
  }, [layout.width, layout.height]);

  // Auto-fit setiap kali ukuran pohon berubah (ganti akar, generasi, lipat/buka)
  useEffect(() => {
    const id = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(id);
  }, [fitToView, rootPersonId, directionMode, maxGenerations]);

  // Auto-fit kalau ukuran container berubah (mis. mode layar penuh)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);

  // Wheel listener native (passive: false) supaya preventDefault() bekerja; zoom ke arah kursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const zoomFromCenter = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select')) return;
    setIsPanning(true);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setIsPanning(false);
  };

  /* ---------- Aksi ---------- */
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePickOldestRoot = () => {
    if (graphMaps.bestAncestorRoot) {
      setRootPersonId(graphMaps.bestAncestorRoot.id);
      onSelectPerson(graphMaps.bestAncestorRoot.id);
      setDirectionMode('descendants');
    }
  };

  const handleExport = (format: 'png' | 'svg') => {
    if (!exportContentRef.current) return;
    void exportTreeAsImage(exportContentRef.current, {
      format,
      filename: `pohon-silsilah-${season}`,
      backgroundColor: isDark ? '#0c1914' : '#faf8f2',
      scale: 2,
    });
  };

  const rootPerson = rootPersonId ? graphMaps.personMap.get(rootPersonId) : null;
  const leafFills = [palette.leafFill, palette.canopyMid, palette.canopyDeep];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Botanical Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/90 px-3 sm:px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Root Person Picker */}
          <Select
            value={rootPersonId || ''}
            onValueChange={(val) => {
              setRootPersonId(val);
              onSelectPerson(val);
            }}
          >
            <SelectTrigger className="h-8 w-[175px] sm:w-[195px] bg-background/90 text-xs">
              <Crosshair className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <SelectValue placeholder="Pilih akar pohon..." />
            </SelectTrigger>
            <SelectContent>
              {persons.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Direction Mode */}
          <Select
            value={directionMode}
            onValueChange={(v) => setDirectionMode(v as TreeDirectionMode)}
          >
            <SelectTrigger className="h-8 w-[160px] bg-background/90 text-xs">
              <GitFork className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="descendants" className="text-xs">
                Tumbuh Keturunan (Trah)
              </SelectItem>
              <SelectItem value="ancestors" className="text-xs">
                Tumbuh Leluhur (Silsilah)
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Generation Depth */}
          <Select
            value={String(maxGenerations)}
            onValueChange={(v) => setMaxGenerations(Number(v))}
          >
            <SelectTrigger className="h-8 w-[118px] bg-background/90 text-xs">
              <TreeDeciduous className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n} Generasi
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Season Theme */}
          <Select value={season} onValueChange={(v) => setSeason(v as SeasonTheme)}>
            <SelectTrigger className="h-8 w-[148px] bg-background/90 text-xs">
              <Palette className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="emerald" className="text-xs">🌿 Rindang Zamrud</SelectItem>
              <SelectItem value="sakura" className="text-xs">🌸 Sakura Mekar</SelectItem>
              <SelectItem value="autumn" className="text-xs">🍂 Pusaka Keemasan</SelectItem>
            </SelectContent>
          </Select>

          {graphMaps.bestAncestorRoot && rootPersonId !== graphMaps.bestAncestorRoot.id && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs bg-background/90"
              onClick={handlePickOldestRoot}
              title="Mulai pohon dari leluhur tertua yang memiliki keturunan terbanyak"
            >
              <Compass className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden xl:inline">Akar Tertua</span>
            </Button>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('hidden md:inline-flex gap-1 text-[11px]', palette.accentBadge)}>
            <Sparkles className="h-3 w-3" />
            {layout.totalMembers} dahan · {layout.actualGenerations} generasi
          </Badge>

          <div className="flex items-center rounded-lg border border-border/70 bg-background/85">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none"
              onClick={() => zoomFromCenter(0.85)}
              title="Perkecil"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none border-x"
              onClick={fitToView}
              title="Pas ke layar"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={() => zoomFromCenter(1.15)}
              title="Perbesar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs bg-background/90">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Unduh Poster</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleExport('png')} className="text-xs">
                Simpan Gambar PNG (HD)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('svg')} className="text-xs">
                Simpan Vektor SVG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Interactive Botanical Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          'relative flex-1 touch-none overflow-hidden select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{ backgroundImage: isDark ? palette.skyDark : palette.skyLight }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
          }}
        >
          <div
            ref={exportContentRef}
            data-export-target="true"
            className="relative"
            style={{ width: layout.width, height: layout.height }}
          >
            {/* SVG: kanopi, batang, akar, cabang meruncing, daun */}
            <svg
              width={layout.width}
              height={layout.height}
              className="pointer-events-none absolute inset-0"
            >
              <defs>
                <linearGradient id={`wood-grad-${season}`} x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor={palette.trunkStart} />
                  <stop offset="100%" stopColor={palette.trunkEnd} />
                </linearGradient>

                <radialGradient id={`canopy-deep-${season}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={palette.canopyDeep} stopOpacity={isDark ? '0.26' : '0.22'} />
                  <stop offset="70%" stopColor={palette.canopyDeep} stopOpacity={isDark ? '0.12' : '0.10'} />
                  <stop offset="100%" stopColor={palette.canopyDeep} stopOpacity="0" />
                </radialGradient>

                <radialGradient id={`canopy-mid-${season}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={palette.canopyMid} stopOpacity={isDark ? '0.28' : '0.25'} />
                  <stop offset="70%" stopColor={palette.canopyMid} stopOpacity={isDark ? '0.14' : '0.12'} />
                  <stop offset="100%" stopColor={palette.canopyMid} stopOpacity="0" />
                </radialGradient>

                <radialGradient id={`canopy-light-${season}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={palette.canopyLight} stopOpacity={isDark ? '0.32' : '0.38'} />
                  <stop offset="75%" stopColor={palette.canopyMid} stopOpacity={isDark ? '0.14' : '0.16'} />
                  <stop offset="100%" stopColor={palette.canopyLight} stopOpacity="0" />
                </radialGradient>

                {/* 3 variasi warna daun supaya kanopi tidak flat */}
                {leafFills.map((fill, i) => (
                  <g key={i} id={`botanical-leaf-${i}`}>
                    <path
                      d="M 0 0 C 8 -10, 22 -10, 28 0 C 22 10, 8 10, 0 0 Z"
                      fill={fill}
                      fillOpacity="0.85"
                      stroke={palette.leafStroke}
                      strokeWidth="0.8"
                    />
                    <path
                      d="M 1 0 Q 14 -1, 26 0"
                      fill="none"
                      stroke={palette.canopyLight}
                      strokeWidth="0.7"
                      strokeOpacity="0.8"
                    />
                  </g>
                ))}
              </defs>

              {/* 1. Kanopi: halo besar + gumpalan lembut per node */}
              <g>
                <ellipse
                  cx={layout.halo.cx}
                  cy={layout.halo.cy}
                  rx={layout.halo.rx}
                  ry={layout.halo.ry}
                  fill={`url(#canopy-mid-${season})`}
                />
                {layout.canopyClusters.map((c) => (
                  <ellipse
                    key={c.id}
                    cx={c.cx}
                    cy={c.cy}
                    rx={c.rx}
                    ry={c.ry}
                    fill={`url(#canopy-${c.tone}-${season})`}
                  />
                ))}
              </g>

              {/* 2. Bukit & akar */}
              <g>
                <ellipse
                  cx={layout.trunkBaseX}
                  cy={layout.trunkBaseY + 26}
                  rx={270}
                  ry={34}
                  fill={palette.hillSecondary}
                  fillOpacity={isDark ? '0.38' : '0.26'}
                />
                <ellipse
                  cx={layout.trunkBaseX}
                  cy={layout.trunkBaseY + 18}
                  rx={210}
                  ry={24}
                  fill={palette.hillPrimary}
                  fillOpacity={isDark ? '0.52' : '0.38'}
                />

                <path
                  d={`M ${layout.trunkBaseX - 35} ${layout.trunkBaseY + 4} Q ${layout.trunkBaseX - 85} ${layout.trunkBaseY + 18}, ${layout.trunkBaseX - 135} ${layout.trunkBaseY + 24} Q ${layout.trunkBaseX - 75} ${layout.trunkBaseY + 8}, ${layout.trunkBaseX - 18} ${layout.trunkBaseY - 8} Z`}
                  fill={`url(#wood-grad-${season})`}
                />
                <path
                  d={`M ${layout.trunkBaseX + 35} ${layout.trunkBaseY + 4} Q ${layout.trunkBaseX + 85} ${layout.trunkBaseY + 18}, ${layout.trunkBaseX + 135} ${layout.trunkBaseY + 24} Q ${layout.trunkBaseX + 75} ${layout.trunkBaseY + 8}, ${layout.trunkBaseX + 18} ${layout.trunkBaseY - 8} Z`}
                  fill={`url(#wood-grad-${season})`}
                />
                <path
                  d={`M ${layout.trunkBaseX - 16} ${layout.trunkBaseY + 8} Q ${layout.trunkBaseX - 38} ${layout.trunkBaseY + 26}, ${layout.trunkBaseX - 64} ${layout.trunkBaseY + 30} Q ${layout.trunkBaseX - 24} ${layout.trunkBaseY + 16}, ${layout.trunkBaseX - 4} ${layout.trunkBaseY} Z`}
                  fill={`url(#wood-grad-${season})`}
                />
                <path
                  d={`M ${layout.trunkBaseX + 16} ${layout.trunkBaseY + 8} Q ${layout.trunkBaseX + 38} ${layout.trunkBaseY + 26}, ${layout.trunkBaseX + 64} ${layout.trunkBaseY + 30} Q ${layout.trunkBaseX + 24} ${layout.trunkBaseY + 16}, ${layout.trunkBaseX + 4} ${layout.trunkBaseY} Z`}
                  fill={`url(#wood-grad-${season})`}
                />
              </g>

              {/* 3. Batang utama */}
              {layout.trunk && (
                <g>
                  <path d={layout.trunk.fillPath} fill={`url(#wood-grad-${season})`} />
                  <path
                    d={layout.trunk.highlightPath}
                    fill="none"
                    stroke={palette.trunkHighlight}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.55"
                  />
                </g>
              )}

              {/* 4. Cabang meruncing: tebal = banyak keturunan, tipis = anak tunggal */}
              <g>
                {layout.branches.map((b) => (
                  <g key={b.id}>
                    <path d={b.fillPath} fill={`url(#wood-grad-${season})`} />
                    <path
                      d={b.highlightPath}
                      fill="none"
                      stroke={palette.trunkHighlight}
                      strokeWidth={Math.max(0.9, 2.4 - b.depth * 0.4)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity="0.5"
                    />
                  </g>
                ))}
              </g>

              {/* 5. Daun */}
              <g>
                {layout.leaves.map((l) => (
                  <use
                    key={l.id}
                    href={`#botanical-leaf-${l.variant}`}
                    transform={`translate(${l.x.toFixed(1)}, ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.scale.toFixed(2)})`}
                  />
                ))}
              </g>
            </svg>

            {/* Plakat akar di dasar batang */}
            {rootPerson && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 text-center"
                style={{ left: layout.trunkBaseX, top: layout.trunkBaseY + 16 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border-2 border-amber-800/40 bg-amber-950/90 px-4 py-1 text-[11px] font-display font-semibold tracking-wide text-amber-100 shadow-md">
                  <TreeDeciduous className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    {directionMode === 'descendants'
                      ? `Pohon Trah ${rootPerson.fullName}`
                      : `Pohon Leluhur ${rootPerson.fullName}`}
                  </span>
                </div>
              </div>
            )}

            {/* Kartu anggota */}
            {layout.nodes.map((node) => {
              const p = node.person;
              const isSelected = p.id === selectedPersonId;
              const life = formatLife(p);

              const genLabel =
                node.depth === 0
                  ? directionMode === 'descendants'
                    ? 'Akar / Leluhur'
                    : 'Pokok / Subjek'
                  : directionMode === 'descendants'
                    ? `Generasi ${node.depth + 1}`
                    : node.depth === 1
                      ? 'Orang Tua'
                      : node.depth === 2
                        ? 'Kakek & Nenek'
                        : node.depth === 3
                          ? 'Buyut'
                          : `Leluhur Gen ${node.depth + 1}`;

              const frameRing = node.isRoot
                ? 'border-amber-600/80 dark:border-amber-500/80 ring-4 ring-amber-500/20 bg-gradient-to-br from-amber-50/95 via-card to-emerald-50/90 dark:from-amber-950/85 dark:via-card dark:to-emerald-950/75'
                : season === 'sakura'
                  ? 'border-pink-400/75 dark:border-pink-500/60 bg-card/95'
                  : season === 'autumn'
                    ? 'border-amber-500/75 dark:border-amber-500/60 bg-card/95'
                    : 'border-emerald-500/75 dark:border-emerald-500/60 bg-card/95';

              const pillTone = node.isRoot
                ? 'bg-amber-700 text-amber-50'
                : season === 'sakura'
                  ? 'bg-pink-600 text-white'
                  : season === 'autumn'
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-700 text-emerald-50';

              const avatarTone =
                p.gender === 'male'
                  ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-400/60 dark:bg-sky-900/60 dark:text-sky-200'
                  : p.gender === 'female'
                    ? 'bg-rose-100 text-rose-800 ring-2 ring-rose-400/60 dark:bg-rose-900/60 dark:text-rose-200'
                    : 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400/60 dark:bg-emerald-900/60 dark:text-emerald-200';

              return (
                <div
                  key={node.key}
                  data-person-id={p.id}
                  className="absolute"
                  style={{
                    left: node.x - node.w / 2,
                    top: node.y - node.h / 2,
                    width: node.w,
                    height: node.h,
                  }}
                >
                  {/* Label generasi: hanya untuk akar & kartu penuh; kartu daun dibuat ringkas */}
                  {!node.compact && (
                    <span
                      className={cn(
                        'pointer-events-none absolute -top-2.5 left-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm',
                        pillTone
                      )}
                    >
                      {genLabel}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectPerson(p.id)}
                    onDoubleClick={() => {
                      setRootPersonId(p.id);
                      onSelectPerson(p.id);
                    }}
                    title={node.compact ? `${p.fullName} · ${genLabel}` : undefined}
                    className={cn(
                      'group relative flex h-full w-full items-center rounded-2xl border-2 text-left shadow-md backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
                      node.compact ? 'gap-2 px-2 py-1.5' : 'gap-2.5 px-2.5 pt-2 pb-1.5',
                      frameRing,
                      isSelected && 'ring-4 ring-primary/45 border-primary'
                    )}
                  >
                    <div
                      className={cn(
                        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold shadow-inner',
                        node.compact ? 'h-9 w-9 text-[10px]' : 'h-11 w-11 text-xs',
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
                      <p
                        className={cn(
                          'truncate font-bold leading-snug text-foreground group-hover:text-primary transition-colors',
                          node.compact ? 'text-[11px]' : 'text-xs'
                        )}
                        title={p.fullName}
                      >
                        {p.fullName}
                      </p>
                      {life ? (
                        <p className="truncate text-[10px] font-medium text-muted-foreground">{life}</p>
                      ) : (
                        <p className="truncate text-[10px] italic text-muted-foreground/75">
                          Tahun belum tercatat
                        </p>
                      )}

                      {node.spouses.length > 0 && (
                        <p
                          className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-medium text-rose-600 dark:text-rose-400"
                          title={`Pasangan: ${node.spouses.map((s) => s.fullName).join(', ')}`}
                        >
                          <Heart className="h-2.5 w-2.5 shrink-0 fill-current" />
                          <span className="truncate">{node.spouses[0].fullName}</span>
                          {node.spouses.length > 1 && (
                            <span className="shrink-0 text-muted-foreground">+{node.spouses.length - 1}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Lipat / buka cabang */}
                  {node.isCollapsed && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(p.id)}
                      title="Buka cabang"
                      className="absolute -bottom-2.5 right-3 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md transition-transform hover:scale-110"
                    >
                      +{node.hiddenCount}
                    </button>
                  )}
                  {!node.isCollapsed && node.hiddenCount > 0 && (
                    <span
                      title="Ada keturunan lagi di luar batas generasi. Klik 2x kartu untuk jadikan akar."
                      className="pointer-events-none absolute -bottom-2.5 right-3 z-10 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm"
                    >
                      +{node.hiddenCount}
                    </span>
                  )}
                  {node.canCollapse && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(p.id)}
                      title="Lipat cabang"
                      className="absolute -bottom-2.5 right-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [div:hover>&]:opacity-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Petunjuk melayang */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm sm:flex">
          <TreeDeciduous className="h-3.5 w-3.5 text-emerald-600" />
          <span>Klik kartu untuk profil · Klik 2x untuk jadikan akar · Scroll untuk zoom, seret untuk geser</span>
        </div>
      </div>
    </div>
  );
}