import { useMemo } from 'react';
import { Crown, Heart, ArrowUp, ArrowDown, User } from 'lucide-react';
import type { RelationshipResult } from '@/lib/relationshipCalculator';
import { cn } from '@/lib/utils';

interface RelationshipPathGraphProps {
  result: RelationshipResult;
  onSelectPerson?: (personId: string) => void;
  className?: string;
}

const CARD_W = 176;
const CARD_H = 88;
const X_STEP = 272;
const Y_STEP = 128;
const PAD_X = 48;
const PAD_Y = 56;

function extractYear(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatYears(birthDate?: string | null, deathDate?: string | null): string {
  const b = extractYear(birthDate);
  const d = extractYear(deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return `Lahir ${b}`;
  if (d) return `Wafat ${d}`;
  return '';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RelationshipPathGraph({
  result,
  onSelectPerson,
  className,
}: RelationshipPathGraphProps) {
  const layout = useMemo(() => {
    const steps = result.path;
    if (steps.length === 0) {
      return { nodes: [], edges: [], width: 400, height: 220, minGen: 0, maxGen: 0 };
    }

    const gens = steps.map((s) => s.generationDelta);
    const minGen = Math.min(...gens);
    const maxGen = Math.max(...gens);

    const nodes = steps.map((step, idx) => {
      const x = PAD_X + idx * X_STEP;
      const y = PAD_Y + (step.generationDelta - minGen) * Y_STEP;
      return {
        idx,
        step,
        x,
        y,
        cx: x + CARD_W / 2,
        cy: y + CARD_H / 2,
        isStart: idx === 0,
        isEnd: idx === steps.length - 1,
        isCommonAncestor: result.commonAncestorIndex === idx,
      };
    });

    const edges = nodes.slice(1).map((target, i) => {
      const source = nodes[i];
      const relType = target.step.relType;
      const startX = source.x + CARD_W;
      const startY = source.cy;
      const endX = target.x;
      const endY = target.cy;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      const d =
        relType === 'spouse'
          ? `M ${startX} ${startY} L ${endX} ${endY}`
          : `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

      return {
        id: `${source.step.person.id}-${target.step.person.id}`,
        relType,
        d,
        midX,
        midY,
      };
    });

    const width = PAD_X * 2 + Math.max(0, steps.length - 1) * X_STEP + CARD_W;
    const height = PAD_Y * 2 + (maxGen - minGen) * Y_STEP + CARD_H + 16;

    return { nodes, edges, width, height, minGen, maxGen };
  }, [result]);

  const generationLevels = useMemo(() => {
    const levels: number[] = [];
    for (let g = layout.minGen; g <= layout.maxGen; g++) {
      levels.push(g);
    }
    return levels;
  }, [layout.minGen, layout.maxGen]);

  return (
    <div
      className={cn(
        'relative w-full overflow-x-auto rounded-xl border border-border/70 bg-gradient-to-b from-card/80 to-muted/25',
        className
      )}
    >
      {/* Subtle grid background */}
      <div
        className="relative mx-auto"
        style={{ width: layout.width, height: layout.height, minWidth: '100%' }}
      >
        {/* Generation Horizontal Guide Bands */}
        {generationLevels.length > 1 &&
          generationLevels.map((g) => {
            const top = PAD_Y + (g - layout.minGen) * Y_STEP + CARD_H / 2;
            const label =
              g === 0
                ? 'Sejajar A'
                : g < 0
                  ? `${Math.abs(g)} gen di atas`
                  : `${g} gen di bawah`;
            return (
              <div
                key={g}
                className="pointer-events-none absolute inset-x-0 flex items-center"
                style={{ top }}
              >
                <div className="w-full border-t border-dashed border-border/45" />
                <span className="absolute left-3 -top-2.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}

        {/* SVG Edges Layer */}
        <svg
          width={layout.width}
          height={layout.height}
          className="pointer-events-none absolute inset-0"
        >
          <defs>
            <marker
              id="rel-arrow-parent"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" className="fill-primary/80" />
            </marker>
            <marker
              id="rel-arrow-child"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" className="fill-emerald-600/80 dark:fill-emerald-400/80" />
            </marker>
          </defs>

          {layout.edges.map((edge) => {
            const isSpouse = edge.relType === 'spouse';
            const isParent = edge.relType === 'parent';
            return (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                strokeWidth={2.25}
                strokeDasharray={isSpouse ? '6 4' : undefined}
                markerEnd={
                  isSpouse
                    ? undefined
                    : isParent
                      ? 'url(#rel-arrow-parent)'
                      : 'url(#rel-arrow-child)'
                }
                className={cn(
                  isSpouse
                    ? 'stroke-rose-500/80'
                    : isParent
                      ? 'stroke-primary/75'
                      : 'stroke-emerald-600/75 dark:stroke-emerald-400/75'
                )}
              />
            );
          })}
        </svg>

        {/* Edge Labels */}
        {layout.edges.map((edge) => {
          const isSpouse = edge.relType === 'spouse';
          const isParent = edge.relType === 'parent';
          return (
            <div
              key={`lbl-${edge.id}`}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ left: edge.midX, top: edge.midY }}
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm',
                  isSpouse
                    ? 'border-rose-300/70 bg-rose-50/95 text-rose-700 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-300'
                    : isParent
                      ? 'border-primary/35 bg-background/95 text-primary'
                      : 'border-emerald-300/70 bg-emerald-50/95 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300'
                )}
              >
                {isSpouse ? (
                  <Heart className="h-2.5 w-2.5 fill-current" />
                ) : isParent ? (
                  <ArrowUp className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDown className="h-2.5 w-2.5" />
                )}
                {isSpouse ? 'Pasangan' : isParent ? 'Orang Tua' : 'Anak'}
              </span>
            </div>
          );
        })}

        {/* Person Node Cards */}
        {layout.nodes.map((node) => {
          const { person } = node.step;
          const years = formatYears(person.birthDate, person.deathDate);

          const genderAccent =
            person.gender === 'male'
              ? 'border-sky-400/70 dark:border-sky-500/60'
              : person.gender === 'female'
                ? 'border-rose-400/70 dark:border-rose-500/60'
                : 'border-border';

          const avatarTone =
            person.gender === 'male'
              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
              : person.gender === 'female'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                : 'bg-muted text-muted-foreground';

          return (
            <div
              key={`${person.id}-${node.idx}`}
              className="absolute"
              style={{ left: node.x, top: node.y, width: CARD_W, height: CARD_H }}
            >
              {/* Top Role Pill */}
              {(node.isStart || node.isEnd || node.isCommonAncestor) && (
                <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
                  {node.isCommonAncestor ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      <Crown className="h-2.5 w-2.5" />
                      Leluhur Bersama
                    </span>
                  ) : node.isStart ? (
                    <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                      A · Titik Awal
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      B · Tujuan
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => onSelectPerson?.(person.id)}
                className={cn(
                  'group flex h-full w-full items-center gap-2.5 rounded-xl border-2 bg-card px-3 py-2 text-left shadow-sm transition-all',
                  genderAccent,
                  node.isCommonAncestor &&
                    'border-amber-500 ring-2 ring-amber-400/35 shadow-md',
                  (node.isStart || node.isEnd) && 'shadow-md',
                  onSelectPerson && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold',
                    avatarTone
                  )}
                >
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt={person.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : person.fullName ? (
                    getInitials(person.fullName)
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold text-foreground group-hover:text-primary"
                    title={person.fullName}
                  >
                    {person.fullName}
                  </p>
                  {years && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {years}
                    </p>
                  )}
                  {person.birthPlace && (
                    <p className="truncate text-[10px] text-muted-foreground/80">
                      {person.birthPlace}
                    </p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
