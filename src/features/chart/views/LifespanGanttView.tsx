import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Flag,
  Calendar,
  Users,
} from 'lucide-react';
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

interface LifespanGanttViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

type SortMode = 'birthAsc' | 'birthDesc' | 'generation' | 'lifespanDesc';

interface Milestone {
  year: number;
  label: string;
}

const HISTORICAL_MILESTONES: Milestone[] = [
  { year: 1945, label: '1945 · Kemerdekaan RI' },
  { year: 1965, label: '1965 · Orde Baru' },
  { year: 1998, label: '1998 · Reformasi' },
  { year: 2020, label: '2020 · Pandemi' },
];

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  if (!match) return null;
  const y = Number(match[0]);
  return Number.isFinite(y) && y > 1500 && y <= 2200 ? y : null;
}

export function LifespanGanttView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: LifespanGanttViewProps) {
  const currentYear = new Date().getFullYear();
  const [sortMode, setSortMode] = useState<SortMode>('birthAsc');
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  // Compute generation per person
  const generationMap = useMemo(() => {
    const parentsByChild = new Map<string, string[]>();
    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        if (!parentsByChild.has(r.toPersonId)) parentsByChild.set(r.toPersonId, []);
        parentsByChild.get(r.toPersonId)!.push(r.fromPersonId);
      }
    });

    const cache = new Map<string, number>();
    const getGen = (id: string, visited = new Set<string>()): number => {
      if (cache.has(id)) return cache.get(id)!;
      if (visited.has(id)) return 1;
      const nextVisited = new Set(visited);
      nextVisited.add(id);
      const parents = parentsByChild.get(id) || [];
      if (parents.length === 0) {
        cache.set(id, 1);
        return 1;
      }
      const g = Math.max(...parents.map((p) => getGen(p, nextVisited))) + 1;
      cache.set(id, g);
      return g;
    };

    persons.forEach((p) => getGen(p.id));
    return cache;
  }, [persons, relationships]);

  // Prepare lifespan rows
  const { rows, minYear, maxYear, missingCount } = useMemo(() => {
    const valid: {
      person: Person;
      startYear: number;
      endYear: number;
      isLiving: boolean;
      age: number;
      generation: number;
    }[] = [];

    let missing = 0;

    persons.forEach((person) => {
      const birth = parseYear(person.birthDate);
      const death = parseYear(person.deathDate);

      if (birth === null && death === null) {
        missing++;
        return;
      }

      const startYear = birth ?? (death! - 60);
      const isLiving = death === null;
      const endYear = death ?? Math.max(startYear + 1, currentYear);
      const age = Math.max(0, endYear - startYear);

      valid.push({
        person,
        startYear,
        endYear,
        isLiving,
        age,
        generation: generationMap.get(person.id) || 1,
      });
    });

    valid.sort((a, b) => {
      if (sortMode === 'birthAsc') return a.startYear - b.startYear;
      if (sortMode === 'birthDesc') return b.startYear - a.startYear;
      if (sortMode === 'lifespanDesc') return b.age - a.age;
      // generation
      if (a.generation !== b.generation) return a.generation - b.generation;
      return a.startYear - b.startYear;
    });

    if (valid.length === 0) {
      return {
        rows: [],
        minYear: 1920,
        maxYear: currentYear,
        missingCount: missing,
      };
    }

    const rawMin = Math.min(...valid.map((r) => r.startYear));
    const rawMax = Math.max(...valid.map((r) => r.endYear), currentYear);
    const paddedMin = Math.floor((rawMin - 5) / 10) * 10;
    const paddedMax = Math.ceil((rawMax + 2) / 5) * 5;

    return {
      rows: valid,
      minYear: paddedMin,
      maxYear: Math.max(paddedMin + 20, paddedMax),
      missingCount: missing,
    };
  }, [persons, generationMap, sortMode, currentYear]);

  const span = Math.max(1, maxYear - minYear);
  const yearToPct = (y: number) => ((y - minYear) / span) * 100;

  // Decade ticks
  const ticks = useMemo(() => {
    const step = span > 120 ? 20 : span > 60 ? 10 : 5;
    const list: number[] = [];
    const first = Math.ceil(minYear / step) * step;
    for (let y = first; y <= maxYear; y += step) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear, span]);

  // People alive in activeYear
  const aliveInActiveYear = useMemo(() => {
    if (activeYear === null) return [];
    return rows.filter((r) => r.startYear <= activeYear && r.endYear >= activeYear);
  }, [rows, activeYear]);

  const visibleMilestones = useMemo(
    () => HISTORICAL_MILESTONES.filter((m) => m.year >= minYear && m.year <= maxYear),
    [minYear, maxYear]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/85 px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 w-[180px] bg-background/90 text-xs">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="birthAsc" className="text-xs">Lahir Terlama → Terbaru</SelectItem>
              <SelectItem value="birthDesc" className="text-xs">Lahir Terbaru → Terlama</SelectItem>
              <SelectItem value="generation" className="text-xs">Urutan Generasi</SelectItem>
              <SelectItem value="lifespanDesc" className="text-xs">Usia Terpanjang</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showMilestones ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => setShowMilestones((prev) => !prev)}
          >
            <Flag className="h-3.5 w-3.5" />
            Penanda Sejarah
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeYear !== null ? (
            <Badge className="gap-1.5 bg-primary text-primary-foreground text-[11px]">
              <Calendar className="h-3 w-3" />
              Tahun {activeYear}: {aliveInActiveYear.length} anggota hidup sezaman
            </Badge>
          ) : (
            <span className="hidden md:inline text-xs text-muted-foreground">
              Arahkan kursor / klik batang tahun untuk melihat siapa yang hidup sezaman
            </span>
          )}
          {missingCount > 0 && (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {missingCount} tanpa tahun lahir
            </Badge>
          )}
        </div>
      </div>

      {/* Main Gantt Area */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">Belum ada data tahun lahir</p>
            <p className="mt-1 text-xs">
              Tambahkan tanggal lahir pada anggota keluarga untuk melihat grafik rentang hidup.
            </p>
          </div>
        ) : (
          <div data-export-target="true" className="mx-auto max-w-6xl min-w-[680px] p-2">
            {/* Year Axis Header */}
            <div className="sticky top-0 z-20 flex border-b bg-background/95 pb-2 pt-1 backdrop-blur-sm">
              <div className="w-48 shrink-0 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Anggota ({rows.length})
              </div>
              <div
                className="relative flex-1 h-7 cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setActiveYear(Math.round(minYear + pct * span));
                }}
                onMouseLeave={() => setActiveYear(null)}
              >
                {ticks.map((y) => (
                  <div
                    key={y}
                    className="absolute top-0 -translate-x-1/2 text-[10px] font-medium text-muted-foreground"
                    style={{ left: `${yearToPct(y)}%` }}
                  >
                    {y}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows with shared timeline overlay */}
            <div className="relative mt-2 space-y-1.5">
              {/* Background vertical grid lines & milestones */}
              <div className="pointer-events-none absolute inset-y-0 left-48 right-0">
                {ticks.map((y) => (
                  <div
                    key={`grid-${y}`}
                    className="absolute inset-y-0 border-l border-border/40"
                    style={{ left: `${yearToPct(y)}%` }}
                  />
                ))}

                {showMilestones &&
                  visibleMilestones.map((m) => (
                    <div
                      key={m.year}
                      className="absolute inset-y-0 border-l border-dashed border-amber-500/60"
                      style={{ left: `${yearToPct(m.year)}%` }}
                    >
                      <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                        {m.label}
                      </span>
                    </div>
                  ))}

                {activeYear !== null && (
                  <div
                    className="absolute inset-y-0 z-10 border-l-2 border-primary"
                    style={{ left: `${yearToPct(activeYear)}%` }}
                  />
                )}
              </div>

              {rows.map((row) => {
                const leftPct = yearToPct(row.startYear);
                const widthPct = Math.max(1.2, yearToPct(row.endYear) - leftPct);
                const isSelected = selectedPersonId === row.person.id;
                const isAliveAtCursor =
                  activeYear !== null &&
                  row.startYear <= activeYear &&
                  row.endYear >= activeYear;
                const ageAtCursor =
                  isAliveAtCursor && activeYear !== null ? activeYear - row.startYear : null;

                const barColor =
                  row.person.gender === 'male'
                    ? row.isLiving
                      ? 'bg-sky-500/85 hover:bg-sky-500'
                      : 'bg-sky-700/70 hover:bg-sky-700'
                    : row.person.gender === 'female'
                      ? row.isLiving
                        ? 'bg-rose-500/85 hover:bg-rose-500'
                        : 'bg-rose-700/70 hover:bg-rose-700'
                      : 'bg-slate-500/80 hover:bg-slate-500';

                return (
                  <div
                    key={row.person.id}
                    className={cn(
                      'group flex items-center rounded-lg py-1 transition-colors',
                      isSelected && 'bg-primary/10',
                      activeYear !== null && !isAliveAtCursor && 'opacity-45'
                    )}
                  >
                    {/* Left Label */}
                    <button
                      type="button"
                      onClick={() => onSelectPerson(row.person.id)}
                      className="flex w-48 shrink-0 items-center gap-2 pr-3 text-left"
                    >
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        G{row.generation}
                      </span>
                      <span
                        className="truncate text-xs font-medium text-foreground group-hover:text-primary"
                        title={row.person.fullName}
                      >
                        {row.person.fullName}
                      </span>
                    </button>

                    {/* Timeline Bar Track */}
                    <div
                      className="relative h-7 flex-1 cursor-crosshair"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        setActiveYear(Math.round(minYear + pct * span));
                      }}
                      onMouseLeave={() => setActiveYear(null)}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPerson(row.person.id)}
                        className={cn(
                          'absolute top-1 flex h-5 items-center justify-between overflow-hidden rounded-full px-2 text-[10px] font-semibold text-white shadow-sm transition-all',
                          barColor,
                          isSelected && 'ring-2 ring-primary ring-offset-1'
                        )}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        title={`${row.person.fullName} (${row.startYear}–${row.isLiving ? 'sekarang' : row.endYear}, ${row.age} thn)`}
                      >
                        <span className="truncate">
                          {row.startYear}
                          {!row.isLiving ? `–${row.endYear}` : ''}
                        </span>
                        <span className="ml-1 shrink-0 opacity-90">
                          {ageAtCursor !== null ? `${ageAtCursor} thn` : `${row.age} thn`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
