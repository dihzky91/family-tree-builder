import { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  readOnly?: boolean;
}

type TreeDirectionMode = 'descendants' | 'ancestors';
type SeasonTheme = 'emerald' | 'sakura' | 'autumn';

interface BotanicalTreeNode {
  person: Person;
  spouses: Person[];
  children: BotanicalTreeNode[];
  depth: number;
  leaves: number;
  w: number;
  h: number;
  compact: boolean;
  hiddenCount: number;
  isCollapsed: boolean;
}

interface PlacedNode {
  node: BotanicalTreeNode;
  parent: PlacedNode | null;
  depth: number;
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

interface CanopyPuff {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface TrunkGeometry {
  fillPath: string;
  highlightPath: string;
  barkLines: string[];
  rootPaths: string[];
  hillRx: number;
  hillRy: number;
}

interface BotanicalLayout {
  nodes: PositionedBotanicalNode[];
  branches: TaperedBranch[];
  leaves: LeafSprite[];
  canopyBack: CanopyPuff[];
  canopyMid: CanopyPuff[];
  canopyLight: CanopyPuff[];
  trunk: TrunkGeometry | null;
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
const FULL_W = 168;
const FULL_H = 78;
const LEAF_W = 144;
const LEAF_H = 60;

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2.5;
const MAX_ACCENT_LEAVES = 150;

const SEASON_PALETTES: Record<
  SeasonTheme,
  {
    label: string;
    skyLight: string;
    skyDark: string;
    trunkDark: string;
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
    skyLight:
      'radial-gradient(ellipse at 50% 20%, rgba(220,252,231,0.55), rgba(254,249,195,0.25) 52%, rgba(248,250,245,0.95) 85%)',
    skyDark:
      'radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.16), rgba(6,78,59,0.22) 52%, transparent 82%)',
    trunkDark: '#3f2614',
    trunkStart: '#5a3820',
    trunkEnd: '#7c5130',
    trunkHighlight: '#a67951',
    canopyDeep: '#166534',
    canopyMid: '#22a055',
    canopyLight: '#6ee7a0',
    leafFill: '#16a34a',
    leafStroke: '#14532d',
    hillPrimary: '#15803d',
    hillSecondary: '#166534',
    accentBadge:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  },
  sakura: {
    label: 'Sakura Mekar',
    skyLight:
      'radial-gradient(ellipse at 50% 20%, rgba(252,231,243,0.65), rgba(255,241,242,0.35) 52%, rgba(255,250,250,0.95) 85%)',
    skyDark:
      'radial-gradient(ellipse at 50% 20%, rgba(236,72,153,0.18), rgba(131,24,67,0.20) 52%, transparent 82%)',
    trunkDark: '#38201e',
    trunkStart: '#4e2e2c',
    trunkEnd: '#734a47',
    trunkHighlight: '#9c6e69',
    canopyDeep: '#be185d',
    canopyMid: '#ec4899',
    canopyLight: '#fbcfe8',
    leafFill: '#f472b6',
    leafStroke: '#9d174d',
    hillPrimary: '#4d7c0f',
    hillSecondary: '#3f6212',
    accentBadge:
      'border-pink-500/40 bg-pink-500/10 text-pink-800 dark:text-pink-200',
  },
  autumn: {
    label: 'Pusaka Keemasan',
    skyLight:
      'radial-gradient(ellipse at 50% 20%, rgba(254,243,199,0.65), rgba(255,237,213,0.35) 52%, rgba(255,251,245,0.95) 85%)',
    skyDark:
      'radial-gradient(ellipse at 50% 20%, rgba(217,119,6,0.18), rgba(120,53,15,0.22) 52%, transparent 82%)',
    trunkDark: '#341c0d',
    trunkStart: '#4c2b16',
    trunkEnd: '#724423',
    trunkHighlight: '#a1673c',
    canopyDeep: '#9a3412',
    canopyMid: '#d97706',
    canopyLight: '#fcd34d',
    leafFill: '#ea580c',
    leafStroke: '#7c2d12',
    hillPrimary: '#92400e',
    hillSecondary: '#78350f',
    accentBadge:
      'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  },
};

const EMPTY_LAYOUT: BotanicalLayout = {
  nodes: [],
  branches: [],
  leaves: [],
  canopyBack: [],
  canopyMid: [],
  canopyLight: [],
  trunk: null,
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
 */
function buildTaperedBranch(p0: Pt, p1: Pt, p2: Pt, p3: Pt, r0: number, r1: number) {
  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const steps = clamp(Math.round(dist / 36), 10, 26);
  const samples: BranchSample[] = [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const hl: Pt[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y;
    let dx =
      3 * mt * mt * (p1.x - p0.x) +
      6 * mt * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x);
    let dy =
      3 * mt * mt * (p1.y - p0.y) +
      6 * mt * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    const nx = -dy;
    const ny = dx;
    left.push({ x: x + nx * r, y: y + ny * r });
    right.push({ x: x - nx * r, y: y - ny * r });
    hl.push({ x: x + nx * r * 0.36, y: y + ny * r * 0.36 });
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

/* ---------- Memoized Canvas Subtree (zero re-render on pan/zoom!) ---------- */
interface BotanicalTreeCanvasProps {
  layout: BotanicalLayout;
  season: SeasonTheme;
  isDark: boolean;
  directionMode: TreeDirectionMode;
  rootPerson: Person | null;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onSetRoot: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  exportContentRef: React.RefObject<HTMLDivElement>;
}

const BotanicalTreeCanvas = memo(function BotanicalTreeCanvas({
  layout,
  season,
  isDark,
  directionMode,
  rootPerson,
  selectedPersonId,
  onSelectPerson,
  onSetRoot,
  onToggleCollapse,
  exportContentRef,
}: BotanicalTreeCanvasProps) {
  const palette = SEASON_PALETTES[season];
  const leafFills = [palette.leafFill, palette.canopyMid, palette.canopyDeep];

  return (
    <div
      ref={exportContentRef}
      data-export-target="true"
      className="relative"
      style={{ width: layout.width, height: layout.height }}
    >
      {/* SVG: mahkota kanopi berlapis, bukit & akar, batang bertekstur, dahan meruncing, aksen daun */}
      <svg
        width={layout.width}
        height={layout.height}
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id={`wood-grad-${season}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.trunkDark} />
            <stop offset="45%" stopColor={palette.trunkStart} />
            <stop offset="100%" stopColor={palette.trunkEnd} />
          </linearGradient>

          <linearGradient id={`canopy-back-grad-${season}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={palette.canopyDeep} stopOpacity={isDark ? '0.48' : '0.42'} />
            <stop offset="100%" stopColor={palette.canopyDeep} stopOpacity={isDark ? '0.28' : '0.28'} />
          </linearGradient>

          <linearGradient id={`canopy-mid-grad-${season}`} x1="20%" y1="100%" x2="80%" y2="0%">
            <stop offset="0%" stopColor={palette.canopyDeep} stopOpacity={isDark ? '0.32' : '0.32'} />
            <stop offset="60%" stopColor={palette.canopyMid} stopOpacity={isDark ? '0.30' : '0.34'} />
            <stop offset="100%" stopColor={palette.canopyLight} stopOpacity={isDark ? '0.24' : '0.32'} />
          </linearGradient>

          <linearGradient id={`canopy-light-grad-${season}`} x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor={palette.canopyMid} stopOpacity="0.06" />
            <stop offset="100%" stopColor={palette.canopyLight} stopOpacity={isDark ? '0.26' : '0.42'} />
          </linearGradient>

          {/* 3 variasi daun aksen */}
          {leafFills.map((fill, i) => (
            <g key={i} id={`botanical-leaf-${season}-${i}`}>
              <path
                d="M 0 0 C 7 -9, 20 -9, 26 0 C 20 9, 7 9, 0 0 Z"
                fill={fill}
                fillOpacity="0.88"
                stroke={palette.leafStroke}
                strokeWidth="0.7"
              />
              <path
                d="M 2 0 Q 13 -1, 24 0"
                fill="none"
                stroke={palette.canopyLight}
                strokeWidth="0.65"
                strokeOpacity="0.75"
              />
            </g>
          ))}
        </defs>

        {/* 1. Siluet Mahkota Daun Lapisan Belakang (memberi bentuk pohon rindang yang utuh) */}
        <g>
          {layout.canopyBack.map((c) => (
            <ellipse
              key={c.id}
              cx={c.cx}
              cy={c.cy}
              rx={c.rx}
              ry={c.ry}
              fill={`url(#canopy-back-grad-${season})`}
            />
          ))}
        </g>

        {/* 2. Siluet Mahkota Daun Lapisan Tengah */}
        <g>
          {layout.canopyMid.map((c) => (
            <ellipse
              key={c.id}
              cx={c.cx}
              cy={c.cy}
              rx={c.rx}
              ry={c.ry}
              fill={`url(#canopy-mid-grad-${season})`}
            />
          ))}
        </g>

        {/* 3. Bukit & Akar Proporsional */}
        {layout.trunk && (
          <g>
            <ellipse
              cx={layout.trunkBaseX}
              cy={layout.trunkBaseY + layout.trunk.hillRy * 0.55}
              rx={layout.trunk.hillRx * 1.25}
              ry={layout.trunk.hillRy * 1.15}
              fill={palette.hillSecondary}
              fillOpacity={isDark ? '0.36' : '0.22'}
            />
            <ellipse
              cx={layout.trunkBaseX}
              cy={layout.trunkBaseY + layout.trunk.hillRy * 0.32}
              rx={layout.trunk.hillRx}
              ry={layout.trunk.hillRy * 0.85}
              fill={palette.hillPrimary}
              fillOpacity={isDark ? '0.48' : '0.36'}
            />
            {layout.trunk.rootPaths.map((d, idx) => (
              <path key={`root-${idx}`} d={d} fill={`url(#wood-grad-${season})`} />
            ))}
          </g>
        )}

        {/* 4. Batang Utama Bertekstur */}
        {layout.trunk && (
          <g>
            <path d={layout.trunk.fillPath} fill={`url(#wood-grad-${season})`} />
            <path
              d={layout.trunk.highlightPath}
              fill="none"
              stroke={palette.trunkHighlight}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
            {layout.trunk.barkLines.map((d, idx) => (
              <path
                key={`bark-${idx}`}
                d={d}
                fill="none"
                stroke={palette.trunkDark}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeOpacity="0.38"
              />
            ))}
          </g>
        )}

        {/* 5. Dahan & Ranting Meruncing */}
        <g>
          {layout.branches.map((b) => (
            <g key={b.id}>
              <path d={b.fillPath} fill={`url(#wood-grad-${season})`} />
              <path
                d={b.highlightPath}
                fill="none"
                stroke={palette.trunkHighlight}
                strokeWidth={Math.max(1, 2.6 - b.depth * 0.4)}
                strokeLinecap="round"
                strokeOpacity="0.48"
              />
            </g>
          ))}
        </g>

        {/* 6. Sorotan Cahaya Puncak Kanopi */}
        <g>
          {layout.canopyLight.map((c) => (
            <ellipse
              key={c.id}
              cx={c.cx}
              cy={c.cy}
              rx={c.rx}
              ry={c.ry}
              fill={`url(#canopy-light-grad-${season})`}
            />
          ))}
        </g>

        {/* 7. Aksen Daun Terkurasi (ringan, maksimal ~150 node) */}
        <g>
          {layout.leaves.map((l) => (
            <use
              key={l.id}
              href={`#botanical-leaf-${season}-${l.variant}`}
              transform={`translate(${l.x.toFixed(1)}, ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.scale.toFixed(2)})`}
            />
          ))}
        </g>
      </svg>

      {/* Plakat akar di dasar batang */}
      {rootPerson && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 text-center"
          style={{ left: layout.trunkBaseX, top: layout.trunkBaseY + 24 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-amber-800/45 bg-amber-950/95 px-4 py-1.5 text-xs font-display font-semibold tracking-wide text-amber-100 shadow-md">
            <TreeDeciduous className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {directionMode === 'descendants'
                ? `Pohon Trah ${rootPerson.fullName}`
                : `Pohon Leluhur ${rootPerson.fullName}`}
            </span>
          </div>
        </div>
      )}

      {/* Kartu anggota (tanpa backdrop-blur-sm agar 60fps saat pan/zoom) */}
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
          ? 'border-amber-600/85 dark:border-amber-500/80 ring-4 ring-amber-500/20 bg-amber-50 dark:bg-amber-950'
          : season === 'sakura'
            ? 'border-pink-400/80 dark:border-pink-500/65 bg-card'
            : season === 'autumn'
              ? 'border-amber-500/80 dark:border-amber-500/65 bg-card'
              : 'border-emerald-600/75 dark:border-emerald-500/65 bg-card';

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
              onDoubleClick={() => onSetRoot(p.id)}
              title={node.compact ? `${p.fullName} · ${genLabel}` : undefined}
              className={cn(
                'group relative flex h-full w-full items-center rounded-2xl border-2 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md',
                node.compact ? 'gap-2 px-2 py-1.5' : 'gap-2.5 px-2.5 pt-2 pb-1.5',
                frameRing,
                isSelected && 'ring-4 ring-primary/45 border-primary'
              )}
            >
              <div
                className={cn(
                  'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
                  node.compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs',
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
                  <p className="truncate text-[10px] font-medium text-muted-foreground">
                    {life}
                  </p>
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
                      <span className="shrink-0 text-muted-foreground">
                        +{node.spouses.length - 1}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </button>

            {node.isCollapsed && (
              <button
                type="button"
                onClick={() => onToggleCollapse(p.id)}
                title="Buka cabang"
                className="absolute -bottom-2.5 right-3 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm transition-transform hover:scale-110"
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
                onClick={() => onToggleCollapse(p.id)}
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
  );
});

export function BotanicalTreeView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  readOnly = false,
}: BotanicalTreeViewProps) {
  const [rootPersonId, setRootPersonId] = useState<string | null>(selectedPersonId);
  const [directionMode, setDirectionMode] = useState<TreeDirectionMode>('descendants');
  const [maxGenerations, setMaxGenerations] = useState<number>(4);
  const [season, setSeason] = useState<SeasonTheme>('emerald');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [isPanning, setIsPanning] = useState(false);

  // Pan & Zoom dipegang lewat ref + DOM transform langsung agar 60fps tanpa React re-render
  const viewRef = useRef({ x: 0, y: 0, k: 0.9 });
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasTransformRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const palette = SEASON_PALETTES[season];

  const applyTransform = useCallback(() => {
    const el = canvasTransformRef.current;
    if (!el) return;
    const { x, y, k } = viewRef.current;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
  }, []);

  const scheduleTransform = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransform();
    });
  }, [applyTransform]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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

  useEffect(() => {
    setCollapsed(new Set());
  }, [rootPersonId, directionMode]);

  /* ---------- Natural Dome-Crown Botanical Layout ---------- */
  const layout = useMemo<BotanicalLayout>(() => {
    if (!rootPersonId) return EMPTY_LAYOUT;
    const rootPerson = graphMaps.personMap.get(rootPersonId);
    if (!rootPerson) return EMPTY_LAYOUT;

    /* 1. Bangun struktur pohon */
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
    const totalLeaves = tree.leaves;

    /* 2. Penempatan X berbasis slot daun + stagger bertingkat agar mahkota padat alami */
    const staggerRows = totalLeaves > 26 ? 3 : totalLeaves > 12 ? 2 : 1;
    const leafSlotW =
      staggerRows === 3 ? 74 : staggerRows === 2 ? 106 : LEAF_W + 24;
    const rowStepY = 74;

    const placed: PlacedNode[] = [];
    const leafOrderMap = new Map<PlacedNode, number>();
    let leafCursor = 0;

    const assignX = (node: BotanicalTreeNode, parent: PlacedNode | null): PlacedNode => {
      const p: PlacedNode = {
        node,
        parent,
        depth: node.depth,
        x: 0,
        y: 0,
      };
      placed.push(p);

      if (node.children.length === 0) {
        p.x = leafCursor * leafSlotW;
        leafOrderMap.set(p, leafCursor);
        leafCursor += 1;
      } else {
        const childPlaced = node.children.map((c) => assignX(c, p));
        p.x = (childPlaced[0].x + childPlaced[childPlaced.length - 1].x) / 2;
      }
      return p;
    };

    const rootPlaced = assignX(tree, null);

    // Geser X supaya root tepat di x = 0
    const shiftX = -rootPlaced.x;
    placed.forEach((p) => {
      p.x += shiftX;
    });

    // Pastikan kartu non-leaf pada kedalaman yang sama tidak bertabrakan horizontal
    const maxDepth = placed.reduce((m, p) => Math.max(m, p.depth), 0);
    for (let d = 1; d <= maxDepth; d++) {
      const sameDepth = placed
        .filter((p) => p.depth === d && !p.node.compact)
        .sort((a, b) => a.x - b.x);
      for (let i = 1; i < sameDepth.length; i++) {
        const prev = sameDepth[i - 1];
        const curr = sameDepth[i];
        const minDist = (prev.node.w + curr.node.w) / 2 + 16;
        if (curr.x - prev.x < minDist) {
          curr.x = prev.x + minDist;
        }
      }
    }

    // Hitung lebar mahkota saat ini
    let rawMinX = Infinity;
    let rawMaxX = -Infinity;
    placed.forEach((p) => {
      rawMinX = Math.min(rawMinX, p.x - p.node.w / 2);
      rawMaxX = Math.max(rawMaxX, p.x + p.node.w / 2);
    });
    const halfSpan = Math.max(240, Math.max(Math.abs(rawMinX), Math.abs(rawMaxX)));

    /* 3. Penempatan Y membentuk kubah mahkota pohon (dome crown) — tidak bolong di tengah */
    const tierStepY = clamp(150 + Math.min(totalLeaves, 50) * 1.4, 155, 215);
    const crownArch = clamp(halfSpan * 0.16, 48, 175);

    placed.forEach((p, idx) => {
      if (p.depth === 0) {
        p.y = 0;
        return;
      }
      const rnd = mulberry32(hashString(`pos-${p.node.person.id}-${idx}`));
      const normX = clamp(p.x / halfSpan, -1, 1);
      // Bagian tengah mahkota sedikit lebih tinggi dari tepi kiri/kanan (siluet kubah pohon)
      const archBoost = Math.cos(normX * Math.PI * 0.48) * crownArch * (p.depth / Math.max(1, maxDepth));
      const baseRise = p.depth * tierStepY;

      let staggerOffset = 0;
      if (p.node.compact && staggerRows > 1) {
        const order = leafOrderMap.get(p) ?? 0;
        staggerOffset = (order % staggerRows) * rowStepY;
      }
      const jitterY = (rnd() - 0.5) * 16;

      p.y = -(baseRise + archBoost + staggerOffset + jitterY);
    });

    /* 4. Proporsi batang utama & kanvas yang seimbang dengan lebar mahkota */
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

    const crownW = Math.max(480, nMaxX - nMinX);
    const trunkH = clamp(crownW * 0.22, 195, 360);
    const foliagePadX = clamp(crownW * 0.11, 130, 240);
    const foliagePadTop = clamp(crownW * 0.1, 120, 210);
    const groundPad = clamp(trunkH * 0.45, 95, 145);

    const minX = nMinX - foliagePadX;
    const maxX = nMaxX + foliagePadX;
    const minY = nMinY - foliagePadTop;
    const maxY = Math.max(nMaxY, 0) + trunkH + groundPad;

    const width = Math.max(920, maxX - minX);
    const height = Math.max(640, maxY - minY);
    const ox = width / 2 - (minX + maxX) / 2;
    const oy = -minY;

    placed.forEach((p) => {
      p.x += ox;
      p.y += oy;
    });

    const rootX = rootPlaced.x;
    const rootY = rootPlaced.y;
    const trunkBaseX = rootX;
    const trunkBaseY = rootY + trunkH;

    /* 5. Batang utama kokoh + kulit kayu + akar proporsional */
    const baseR = clamp(crownW * 0.036, 30, 76);
    const topR = baseR * 0.54;
    const trunkSway = (mulberry32(hashString(rootPerson.id))() - 0.5) * baseR * 0.7;

    const trunkShape = buildTaperedBranch(
      { x: trunkBaseX, y: trunkBaseY + 14 },
      { x: trunkBaseX + trunkSway, y: rootY + trunkH * 0.65 },
      { x: trunkBaseX - trunkSway * 0.45, y: rootY + trunkH * 0.3 },
      { x: rootX, y: rootY - 6 },
      baseR,
      topR
    );

    const barkLines: string[] = [-0.45, -0.1, 0.3].map((offset) => {
      const x0 = trunkBaseX + baseR * offset;
      const x1 = trunkBaseX + trunkSway * 0.7 + baseR * offset * 0.75;
      const x2 = rootX + topR * offset * 0.7;
      return `M ${x0.toFixed(1)} ${(trunkBaseY - trunkH * 0.08).toFixed(1)} Q ${x1.toFixed(1)} ${(rootY + trunkH * 0.55).toFixed(1)}, ${x2.toFixed(1)} ${(rootY + trunkH * 0.14).toFixed(1)}`;
    });

    const rootSpread = baseR * 3.4;
    const rootPaths: string[] = [
      // Akar utama kiri
      `M ${(trunkBaseX - baseR * 0.85).toFixed(1)} ${(trunkBaseY - 4).toFixed(1)} Q ${(trunkBaseX - rootSpread * 0.55).toFixed(1)} ${(trunkBaseY + baseR * 0.45).toFixed(1)}, ${(trunkBaseX - rootSpread).toFixed(1)} ${(trunkBaseY + baseR * 0.62).toFixed(1)} Q ${(trunkBaseX - rootSpread * 0.48).toFixed(1)} ${(trunkBaseY + baseR * 0.14).toFixed(1)}, ${(trunkBaseX - baseR * 0.35).toFixed(1)} ${(trunkBaseY - baseR * 0.5).toFixed(1)} Z`,
      // Akar utama kanan
      `M ${(trunkBaseX + baseR * 0.85).toFixed(1)} ${(trunkBaseY - 4).toFixed(1)} Q ${(trunkBaseX + rootSpread * 0.55).toFixed(1)} ${(trunkBaseY + baseR * 0.45).toFixed(1)}, ${(trunkBaseX + rootSpread).toFixed(1)} ${(trunkBaseY + baseR * 0.62).toFixed(1)} Q ${(trunkBaseX + rootSpread * 0.48).toFixed(1)} ${(trunkBaseY + baseR * 0.14).toFixed(1)}, ${(trunkBaseX + baseR * 0.35).toFixed(1)} ${(trunkBaseY - baseR * 0.5).toFixed(1)} Z`,
      // Akar depan kiri
      `M ${(trunkBaseX - baseR * 0.42).toFixed(1)} ${(trunkBaseY + 6).toFixed(1)} Q ${(trunkBaseX - rootSpread * 0.32).toFixed(1)} ${(trunkBaseY + baseR * 0.68).toFixed(1)}, ${(trunkBaseX - rootSpread * 0.54).toFixed(1)} ${(trunkBaseY + baseR * 0.82).toFixed(1)} Q ${(trunkBaseX - rootSpread * 0.22).toFixed(1)} ${(trunkBaseY + baseR * 0.38).toFixed(1)}, ${(trunkBaseX - baseR * 0.08).toFixed(1)} ${(trunkBaseY - 4).toFixed(1)} Z`,
      // Akar depan kanan
      `M ${(trunkBaseX + baseR * 0.42).toFixed(1)} ${(trunkBaseY + 6).toFixed(1)} Q ${(trunkBaseX + rootSpread * 0.32).toFixed(1)} ${(trunkBaseY + baseR * 0.68).toFixed(1)}, ${(trunkBaseX + rootSpread * 0.54).toFixed(1)} ${(trunkBaseY + baseR * 0.82).toFixed(1)} Q ${(trunkBaseX + rootSpread * 0.22).toFixed(1)} ${(trunkBaseY + baseR * 0.38).toFixed(1)}, ${(trunkBaseX + baseR * 0.08).toFixed(1)} ${(trunkBaseY - 4).toFixed(1)} Z`,
    ];

    /* 6. Cabang meruncing organik + Siluet kanopi berlapis + Aksen daun terkurasi */
    const branches: TaperedBranch[] = [];
    const canopyBack: CanopyPuff[] = [];
    const canopyMid: CanopyPuff[] = [];
    const canopyLight: CanopyPuff[] = [];
    const leaves: LeafSprite[] = [];

    // Gumpalan kanopi dasar yang memeluk seluruh mahkota (mencegah lubang tengah)
    const crownCenterX = (nMinX + nMaxX) / 2 + ox;
    const crownCenterY = (nMinY + nMaxY) / 2 + oy - 10;
    const crownRx = crownW * 0.52 + 70;
    const crownRy = Math.max(160, (nMaxY - nMinY) * 0.54 + 65);

    canopyBack.push(
      {
        id: 'crown-core',
        cx: crownCenterX,
        cy: crownCenterY + 12,
        rx: crownRx,
        ry: crownRy,
      },
      {
        id: 'crown-left',
        cx: crownCenterX - crownRx * 0.46,
        cy: crownCenterY + crownRy * 0.14,
        rx: crownRx * 0.58,
        ry: crownRy * 0.72,
      },
      {
        id: 'crown-right',
        cx: crownCenterX + crownRx * 0.46,
        cy: crownCenterY + crownRy * 0.14,
        rx: crownRx * 0.58,
        ry: crownRy * 0.72,
      },
      {
        id: 'crown-top',
        cx: crownCenterX,
        cy: crownCenterY - crownRy * 0.3,
        rx: crownRx * 0.68,
        ry: crownRy * 0.62,
      }
    );

    const leafStep = Math.max(1, Math.ceil((placed.length * 3) / MAX_ACCENT_LEAVES));
    let leafCandidateIdx = 0;

    placed.forEach((p, idx) => {
      const id = p.node.person.id;
      const rnd = mulberry32(hashString(`${id}-${idx}`));

      // Gumpalan tajuk organik di sekitar dahan & kartu
      if (p.depth > 0) {
        const puffScale = p.node.compact ? 0.92 : 1.18;
        canopyBack.push({
          id: `cb-${idx}`,
          cx: p.x + (rnd() - 0.5) * 28,
          cy: p.y - 8 + (rnd() - 0.5) * 20,
          rx: (108 + rnd() * 28) * puffScale,
          ry: (76 + rnd() * 20) * puffScale,
        });
        canopyMid.push({
          id: `cm-${idx}`,
          cx: p.x - 10 + (rnd() - 0.5) * 26,
          cy: p.y - 18 + (rnd() - 0.5) * 18,
          rx: (86 + rnd() * 24) * puffScale,
          ry: (60 + rnd() * 18) * puffScale,
        });
        if (p.node.compact || p.depth >= maxDepth - 1) {
          canopyLight.push({
            id: `cl-${idx}`,
            cx: p.x - 14 + (rnd() - 0.5) * 20,
            cy: p.y - 32 + (rnd() - 0.5) * 16,
            rx: 64 + rnd() * 20,
            ry: 44 + rnd() * 14,
          });
        }
      }

      // Aksen daun di sekitar ujung ranting (dibatasi agar tetap ringan)
      const desiredLeaves = p.node.compact ? 3 : 2;
      for (let i = 0; i < desiredLeaves; i++) {
        leafCandidateIdx++;
        if (leafCandidateIdx % leafStep !== 0) continue;
        const a = rnd() * Math.PI * 2;
        const dist = 0.65 + rnd() * 0.45;
        leaves.push({
          id: `leaf-n-${idx}-${i}`,
          x: p.x + Math.cos(a) * (p.node.w * 0.52 + 16) * dist,
          y: p.y + Math.sin(a) * (p.node.h * 0.65 + 16) * dist,
          rot: Math.floor(rnd() * 360),
          scale: 0.65 + rnd() * 0.45,
          variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
        });
      }

      if (!p.parent) return;
      const par = p.parent;
      const P0: Pt = { x: par.x, y: par.y };
      const P3: Pt = { x: p.x, y: p.y };
      const dx = P3.x - P0.x;
      const dy = P3.y - P0.y;
      const len = Math.hypot(dx, dy) || 1;

      // Kurva cabang organik: naik dulu dari dahan induk lalu melengkung anggun ke anak
      const sway = (rnd() - 0.5) * Math.min(50, len * 0.14);
      const P1: Pt = {
        x: P0.x + dx * 0.18 + sway,
        y: P0.y + dy * 0.52,
      };
      const P2: Pt = {
        x: P0.x + dx * 0.78 - sway * 0.4,
        y: P0.y + dy * 0.72,
      };

      const scaleFactor = clamp(crownW / 1200, 0.85, 1.8);
      const rBase =
        p.depth === 1
          ? Math.min(topR * 0.85, (4.5 + Math.sqrt(p.node.leaves) * 2.8) * scaleFactor)
          : Math.min(18, (2.6 + Math.sqrt(p.node.leaves) * 1.9) * scaleFactor);
      const rTip = Math.max(2.2, rBase * 0.48);

      const b = buildTaperedBranch(P0, P1, P2, P3, rBase, rTip);
      branches.push({
        id: `branch-${par.node.person.id}-${id}-${idx}`,
        fillPath: b.fillPath,
        highlightPath: b.highlightPath,
        depth: p.depth,
      });
    });

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
      canopyBack,
      canopyMid,
      canopyLight,
      trunk: {
        fillPath: trunkShape.fillPath,
        highlightPath: trunkShape.highlightPath,
        barkLines,
        rootPaths,
        hillRx: Math.max(220, rootSpread * 1.28),
        hillRy: Math.max(26, baseR * 0.65),
      },
      width,
      height,
      trunkBaseX,
      trunkBaseY,
      rootX,
      rootY,
      totalMembers: nodes.length,
      actualGenerations: maxDepth + 1,
    };
  }, [rootPersonId, directionMode, maxGenerations, graphMaps, collapsed]);

  /* ---------- Zoom & pan (DOM transform langsung, 60fps tanpa re-render) ---------- */
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return;
    const k = clamp(Math.min(cw / layout.width, ch / layout.height) * 0.94, MIN_ZOOM, 1);
    viewRef.current = {
      k,
      x: (cw - layout.width * k) / 2,
      y: (ch - layout.height * k) / 2,
    };
    applyTransform();
  }, [layout.width, layout.height, applyTransform]);

  useEffect(() => {
    const id = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(id);
  }, [fitToView, rootPersonId, directionMode, maxGenerations]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const f = k / v.k;
      viewRef.current = {
        k,
        x: cx - (cx - v.x) * f,
        y: cy - (cy - v.y) * f,
      };
      scheduleTransform();
    },
    [scheduleTransform]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
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
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    viewRef.current.x = d.vx + (e.clientX - d.x);
    viewRef.current.y = d.vy + (e.clientY - d.y);
    scheduleTransform();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setIsPanning(false);
  };

  /* ---------- Aksi ---------- */
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSetRoot = useCallback(
    (id: string) => {
      setRootPersonId(id);
      onSelectPerson(id);
    },
    [onSelectPerson]
  );

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

  const rootPerson = rootPersonId ? graphMaps.personMap.get(rootPersonId) || null : null;

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
              <SelectItem value="emerald" className="text-xs">
                🌿 Rindang Zamrud
              </SelectItem>
              <SelectItem value="sakura" className="text-xs">
                🌸 Sakura Mekar
              </SelectItem>
              <SelectItem value="autumn" className="text-xs">
                🍂 Pusaka Keemasan
              </SelectItem>
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
          <Badge
            variant="outline"
            className={cn('hidden md:inline-flex gap-1 text-[11px]', palette.accentBadge)}
          >
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

          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs bg-background/90"
                >
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
          )}
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
          ref={canvasTransformRef}
          className="absolute left-0 top-0"
          style={{
            width: layout.width,
            height: layout.height,
            transformOrigin: '0 0',
            willChange: 'transform',
            contain: 'layout style',
          }}
        >
          <BotanicalTreeCanvas
            layout={layout}
            season={season}
            isDark={isDark}
            directionMode={directionMode}
            rootPerson={rootPerson}
            selectedPersonId={selectedPersonId}
            onSelectPerson={onSelectPerson}
            onSetRoot={handleSetRoot}
            onToggleCollapse={handleToggleCollapse}
            exportContentRef={exportContentRef}
          />
        </div>

        {/* Petunjuk melayang */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm sm:flex">
          <TreeDeciduous className="h-3.5 w-3.5 text-emerald-600" />
          <span>
            Klik kartu untuk profil · Klik 2x untuk jadikan akar · Scroll untuk zoom, seret untuk geser
          </span>
        </div>
      </div>
    </div>
  );
}
