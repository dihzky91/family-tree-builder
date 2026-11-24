import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Flag,
  Calendar,
  Users,
  Sparkles,
  Award,
  Clock,
  Heart,
  Baby,
  X,
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
type StatusFilter = 'all' | 'living' | 'deceased';

interface Milestone {
  year: number;
  shortLabel: string;
  fullLabel: string;
}

interface LifeEventMarker {
  year: number;
  type: 'marriage' | 'childBirth';
  label: string;
}

interface LifespanRow {
  person: Person;
  initials: string;
  startYear: number;
  endYear: number;
  isLiving: boolean;
  isEstimatedStart: boolean;
  age: number;
  generation: number;
  events: LifeEventMarker[];
}

const HISTORICAL_MILESTONES: Milestone[] = [
  { year: 1945, shortLabel: '1945 · Kemerdekaan', fullLabel: '1945 · Kemerdekaan RI' },
  { year: 1965, shortLabel: '1965 · Orde Baru', fullLabel: '1965 · Awal Orde Baru' },
  { year: 1998, shortLabel: '1998 · Reformasi', fullLabel: '1998 · Era Reformasi' },
  { year: 2020, shortLabel: '2020 · Pandemi', fullLabel: '2020 · Pandemi COVID-19' },
];

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  if (!match) return null;
  const y = Number(match[0]);
  return Number.isFinite(y) && y > 1500 && y <= 2200 ? y : null;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LifespanGanttView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: LifespanGanttViewProps) {
  const RealYear = new Date().getFullYear();
  // Ensure realistic current year fallback if system clock is set in the future
  const currentYear = RealYear > 2030 ? 2026 : RealYear;

  const [sortMode, setSortMode] = useState<SortMode>('birthAsc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [highlightOverlap, setHighlightOverlap] = useState<boolean>(true);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [lockedYear, setLockedYear] = useState<number | null>(null);

  const inspectedYear = lockedYear ?? activeYear;

  // Compute generation per person and life events (child births, marriages)
  const { generationMap, eventsByPerson } = useMemo(() => {
    const personById = new Map(persons.map((p) => [p.id, p]));
    const parentsByChild = new Map<string, string[]>();
    const evMap = new Map<string, LifeEventMarker[]>();

    persons.forEach((p) => evMap.set(p.id, []));

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        if (!parentsByChild.has(r.toPersonId)) parentsByChild.set(r.toPersonId, []);
        parentsByChild.get(r.toPersonId)!.push(r.fromPersonId);

        const child = personById.get(r.toPersonId);
        const childBirthYear = parseYear(child?.birthDate);
        if (child && childBirthYear !== null) {
          evMap.get(r.fromPersonId)?.push({
            year: childBirthYear,
            type: 'childBirth',
            label: `Kelahiran anak: ${child.fullName} (${childBirthYear})`,
          });
        }
      } else if (r.type === 'SPOUSE') {
        const marriageYear = parseYear(r.meta?.startDate);
        const pA = personById.get(r.fromPersonId);
        const pB = personById.get(r.toPersonId);
        if (marriageYear !== null) {
          if (pA && pB) {
            evMap.get(pA.id)?.push({
              year: marriageYear,
              type: 'marriage',
              label: `Menikah dengan ${pB.fullName} (${marriageYear})`,
            });
            evMap.get(pB.id)?.push({
              year: marriageYear,
              type: 'marriage',
              label: `Menikah dengan ${pA.fullName} (${marriageYear})`,
            });
          }
        }
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
    return { generationMap: cache, eventsByPerson: evMap };
  }, [persons, relationships]);

  // Prepare all lifespan rows & family longevity summary stats
  const { allRows, rows, minYear, maxYear, missingCount, stats } = useMemo(() => {
    const valid: LifespanRow[] = [];
    let missing = 0;

    persons.forEach((person) => {
      const birth = parseYear(person.birthDate);
      const death = parseYear(person.deathDate);

      if (birth === null && death === null) {
        missing++;
        return;
      }

      const isEstimatedStart = birth === null;
      const startYear = birth ?? death! - 60;
      const isLiving = death === null;
      const endYear = death ?? Math.max(startYear + 1, currentYear);
      const age = Math.max(0, endYear - startYear);

      const rawEvents = eventsByPerson.get(person.id) || [];
      const validEvents = rawEvents
        .filter((e) => e.year >= startYear && e.year <= endYear)
        .sort((a, b) => a.year - b.year);

      valid.push({
        person,
        initials: getInitials(person.fullName),
        startYear,
        endYear,
        isLiving,
        isEstimatedStart,
        age,
        generation: generationMap.get(person.id) || 1,
        events: validEvents,
      });
    });

    const filtered = valid.filter((r) => {
      if (statusFilter === 'living') return r.isLiving;
      if (statusFilter === 'deceased') return !r.isLiving;
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'birthAsc') return a.startYear - b.startYear || a.person.fullName.localeCompare(b.person.fullName);
      if (sortMode === 'birthDesc') return b.startYear - a.startYear || a.person.fullName.localeCompare(b.person.fullName);
      if (sortMode === 'lifespanDesc') return b.age - a.age || a.startYear - b.startYear;
      if (a.generation !== b.generation) return a.generation - b.generation;
      return a.startYear - b.startYear;
    });

    if (valid.length === 0) {
      return {
        allRows: [],
        rows: [],
        minYear: 1920,
        maxYear: currentYear,
        missingCount: missing,
        stats: null,
      };
    }

    const rawMin = Math.min(...valid.map((r) => r.startYear));
    const rawMax = Math.max(...valid.map((r) => r.endYear), currentYear);
    const paddedMin = Math.floor((rawMin - 4) / 10) * 10;
    const paddedMax = Math.ceil((rawMax + 3) / 5) * 5;

    const longestLived = [...valid].sort((a, b) => b.age - a.age)[0];
    const avgAge = Math.round(valid.reduce((acc, r) => acc + r.age, 0) / valid.length);
    const livingCount = valid.filter((r) => r.isLiving).length;
    const deceasedCount = valid.length - livingCount;

    return {
      allRows: valid,
      rows: filtered,
      minYear: paddedMin,
      maxYear: Math.max(paddedMin + 20, paddedMax),
      missingCount: missing,
      stats: {
        earliestBirth: rawMin,
        latestYear: rawMax,
        totalSpan: rawMax - rawMin,
        avgAge,
        longestLived,
        livingCount,
        deceasedCount,
      },
    };
  }, [persons, generationMap, eventsByPerson, sortMode, statusFilter, currentYear]);

  const selectedRow = useMemo(
    () => (selectedPersonId ? allRows.find((r) => r.person.id === selectedPersonId) ?? null : null),
    [allRows, selectedPersonId]
  );

  // Count how many people overlapped with selectedRow
  const selectedContemporariesCount = useMemo(() => {
    if (!selectedRow) return 0;
    return rows.filter(
      (r) =>
        r.person.id !== selectedRow.person.id &&
        Math.min(r.endYear, selectedRow.endYear) >= Math.max(r.startYear, selectedRow.startYear)
    ).length;
  }, [rows, selectedRow]);

  const span = Math.max(1, maxYear - minYear);
  const yearToPct = (y: number) => Math.max(0, Math.min(100, ((y - minYear) / span) * 100));

  // Decade ticks
  const ticks = useMemo(() => {
    const step = span > 130 ? 20 : span > 60 ? 10 : 5;
    const list: number[] = [];
    const first = Math.ceil(minYear / step) * step;
    for (let y = first; y <= maxYear; y += step) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear, span]);

  // People alive in inspectedYear
  const aliveInInspectedYear = useMemo(() => {
    if (inspectedYear === null) return [];
    return rows.filter((r) => r.startYear <= inspectedYear && r.endYear >= inspectedYear);
  }, [rows, inspectedYear]);

  const visibleMilestones = useMemo(
    () => HISTORICAL_MILESTONES.filter((m) => m.year >= minYear && m.year <= maxYear),
    [minYear, maxYear]
  );

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (lockedYear !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setActiveYear(Math.round(minYear + pct * span));
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedY = Math.round(minYear + pct * span);
    setLockedYear((prev) => (prev === clickedY ? null : clickedY));
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background/60">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/90 px-3 sm:px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Sort Selector */}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 w-[168px] sm:w-[185px] bg-background/90 text-xs rounded-lg">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="birthAsc" className="text-xs">Lahir Terlama → Terbaru</SelectItem>
              <SelectItem value="birthDesc" className="text-xs">Lahir Terbaru → Terlama</SelectItem>
              <SelectItem value="generation" className="text-xs">Kelompok Generasi (G1..Gn)</SelectItem>
              <SelectItem value="lifespanDesc" className="text-xs">Usia Terpanjang</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter Pills */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/35 p-0.5">
            {(
              [
                { value: 'all', label: 'Semua', count: allRows.length },
                { value: 'living', label: 'Masih Hidup', count: stats?.livingCount ?? 0 },
                { value: 'deceased', label: 'Wafat', count: stats?.deceasedCount ?? 0 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                  statusFilter === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span className="ml-1 text-[10px] opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Historical Milestones Toggle */}
          <Button
            variant={showMilestones ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'h-8 gap-1.5 px-2.5 text-xs rounded-lg',
              showMilestones && 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            )}
            onClick={() => setShowMilestones((prev) => !prev)}
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Penanda Sejarah</span>
          </Button>

          {/* Contemporaries Overlap Spotlight Toggle when someone is selected */}
          {selectedRow && (
            <Button
              variant={highlightOverlap ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs rounded-lg"
              onClick={() => setHighlightOverlap((prev) => !prev)}
              title="Sorot anggota keluarga yang pernah hidup sezaman dengan anggota terpilih"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sorot Sezaman</span>
              <Badge
                variant="secondary"
                className="ml-0.5 px-1.5 py-0 text-[10px] rounded-full bg-background/20 text-current"
              >
                {selectedContemporariesCount}
              </Badge>
            </Button>
          )}
        </div>

        {/* Right Info / Active Year Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          {inspectedYear !== null ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                Tahun <strong>{inspectedYear}</strong>: {aliveInInspectedYear.length} hidup sezaman
              </span>
              {lockedYear !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setLockedYear(null);
                    setActiveYear(null);
                  }}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20"
                  title="Lepas kunci tahun"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <span className="hidden xl:inline text-xs text-muted-foreground">
              Geser kursor atau klik sumbu tahun untuk mengunci perbandingan era
            </span>
          )}

          {missingCount > 0 && (
            <Badge variant="outline" className="text-[11px] text-muted-foreground whitespace-nowrap">
              {missingCount} tanpa tahun lahir
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Longevity & Era Banner */}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/25 px-3 sm:px-4 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Rentang Era:</span>
              <strong className="text-foreground">
                {stats.earliestBirth} – {stats.latestYear} ({stats.totalSpan} thn)
              </strong>
            </span>

            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span>Rata-rata Usia:</span>
              <strong className="text-foreground">{stats.avgAge} thn</strong>
            </span>

            {stats.longestLived && (
              <button
                type="button"
                onClick={() => onSelectPerson(stats.longestLived.person.id)}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Klik untuk fokus ke anggota dengan usia terpanjang"
              >
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>Usia Terpanjang:</span>
                <strong className="text-foreground underline decoration-dotted underline-offset-2">
                  {stats.longestLived.person.fullName} ({stats.longestLived.age} thn)
                </strong>
              </button>
            )}
          </div>

          {/* Visual Bar Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 inline-block" />
              <span>Masih Hidup (Titik Aktif)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full bg-slate-600/80 border border-white/40 inline-block" />
              <span>Telah Wafat</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 ring-1 ring-amber-700 inline-block" />
              <span>Lahir Anak / Menikah</span>
            </span>
          </div>
        </div>
      )}

      {/* Main Scrollable Gantt Container */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">Belum ada data rentang hidup</p>
            <p className="mt-1 text-xs max-w-md">
              Tambahkan tanggal lahir pada anggota keluarga atau ubah filter status di atas untuk melihat grafik rentang hidup.
            </p>
          </div>
        ) : (
          <div
            data-export-target="true"
            className="mx-auto max-w-7xl min-w-[740px] px-3 sm:px-6 pb-8"
          >
            {/* Sticky Top Header: Year Axis + Dedicated Historical Milestones Lane */}
            <div className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md">
              {/* Row 1: Year Numbers */}
              <div className="flex items-center pt-2.5 pb-1.5">
                <div className="sticky left-0 z-30 w-52 sm:w-60 shrink-0 bg-background/95 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Anggota ({rows.length})</span>
                  {selectedRow && highlightOverlap && (
                    <span className="text-[10px] font-normal text-primary capitalize">
                      Irisan: {selectedRow.startYear}–{selectedRow.endYear}
                    </span>
                  )}
                </div>

                <div
                  className="relative flex-1 h-6 cursor-crosshair select-none"
                  onMouseMove={handleTrackMouseMove}
                  onMouseLeave={() => setActiveYear(null)}
                  onClick={handleTrackClick}
                  title="Klik untuk mengunci garis tahun"
                >
                  {ticks.map((y) => {
                    const pct = yearToPct(y);
                    // Skip regular tick if it collides with the currentYear emerald badge
                    if (Math.abs(y - currentYear) <= 5) return null;
                    return (
                      <div
                        key={y}
                        className={cn(
                          'absolute top-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground',
                          pct <= 2
                            ? 'translate-x-0.5'
                            : pct >= 98
                              ? '-translate-x-full'
                              : '-translate-x-1/2'
                        )}
                        style={{ left: `${pct}%` }}
                      >
                        {y}
                      </div>
                    );
                  })}

                  {/* Current Year Marker on Axis */}
                  <div
                    className="absolute top-0.5 -translate-x-1/2 rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                    style={{ left: `${yearToPct(currentYear)}%` }}
                  >
                    {currentYear}
                  </div>

                  {/* Active Cursor Pill on Axis */}
                  {inspectedYear !== null && (
                    <div
                      className="pointer-events-none absolute -top-0.5 z-20 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow"
                      style={{ left: `${yearToPct(inspectedYear)}%` }}
                    >
                      {inspectedYear}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Dedicated Historical Milestones Lane (Staggered & Anti-Collision) */}
              {showMilestones && visibleMilestones.length > 0 && (
                <div className="flex items-center border-t border-border/40 bg-amber-500/[0.04] py-1">
                  <div className="sticky left-0 z-30 w-52 sm:w-60 shrink-0 bg-background/95 pr-3 flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    <Flag className="h-3 w-3 shrink-0" />
                    <span>Peristiwa Sejarah</span>
                  </div>
                  <div
                    className="relative flex-1 h-9 cursor-crosshair"
                    onMouseMove={handleTrackMouseMove}
                    onMouseLeave={() => setActiveYear(null)}
                    onClick={handleTrackClick}
                  >
                    {visibleMilestones.map((m, idx) => {
                      const pct = yearToPct(m.year);
                      const isTopRow = idx % 2 === 0;
                      const alignLeftOfLine = pct > 86;
                      return (
                        <div
                          key={m.year}
                          className={cn(
                            'absolute flex items-center',
                            isTopRow ? 'top-0' : 'bottom-0'
                          )}
                          style={{ left: `${pct}%` }}
                          title={m.fullLabel}
                        >
                          <span className="h-3.5 w-0.5 bg-amber-500 rounded-full shrink-0" />
                          <span
                            className={cn(
                              'whitespace-nowrap rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0 text-[9.5px] leading-tight font-semibold text-amber-800 dark:text-amber-200 shadow-2xs',
                              alignLeftOfLine ? 'mr-1 -translate-x-full' : 'ml-1'
                            )}
                          >
                            {m.shortLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Gantt Body with Shared Vertical Overlays */}
            <div className="relative pt-2">
              {/* Background Vertical Grid, Selected Overlap Band & Milestone Lines */}
              <div className="pointer-events-none absolute inset-y-0 left-52 sm:left-60 right-0 z-0">
                {/* Selected Person Lifespan Overlap Band */}
                {selectedRow && highlightOverlap && (
                  <div
                    className="absolute inset-y-0 bg-primary/[0.07] dark:bg-primary/[0.12] border-x border-primary/30 transition-all duration-300"
                    style={{
                      left: `${yearToPct(selectedRow.startYear)}%`,
                      width: `${Math.max(0.5, yearToPct(selectedRow.endYear) - yearToPct(selectedRow.startYear))}%`,
                    }}
                  />
                )}

                {/* Decade Vertical Grid Lines */}
                {ticks.map((y) => (
                  <div
                    key={`grid-${y}`}
                    className="absolute inset-y-0 border-l border-border/45"
                    style={{ left: `${yearToPct(y)}%` }}
                  />
                ))}

                {/* Current Year Vertical Line */}
                <div
                  className="absolute inset-y-0 border-l border-emerald-500/40"
                  style={{ left: `${yearToPct(currentYear)}%` }}
                />

                {/* Historical Milestone Dashed Vertical Lines */}
                {showMilestones &&
                  visibleMilestones.map((m) => (
                    <div
                      key={`line-${m.year}`}
                      className="absolute inset-y-0 border-l border-dashed border-amber-500/45"
                      style={{ left: `${yearToPct(m.year)}%` }}
                    />
                  ))}

                {/* Active/Locked Year Vertical Cursor Line */}
                {inspectedYear !== null && (
                  <div
                    className="absolute inset-y-0 z-20 border-l-2 border-primary shadow-xs"
                    style={{ left: `${yearToPct(inspectedYear)}%` }}
                  />
                )}
              </div>

              {/* Rows (with Generation Section Headers when sorted by generation) */}
              <div className="relative z-10 space-y-1">
                {rows.map((row, index) => {
                  const prevRow = index > 0 ? rows[index - 1] : null;
                  const showGenHeader =
                    sortMode === 'generation' &&
                    (!prevRow || prevRow.generation !== row.generation);

                  const leftPct = yearToPct(row.startYear);
                  const widthPct = Math.max(1.8, yearToPct(row.endYear) - leftPct);
                  const isSelected = selectedPersonId === row.person.id;

                  // Check overlap with inspectedYear cursor
                  const isAliveAtCursor =
                    inspectedYear !== null &&
                    row.startYear <= inspectedYear &&
                    row.endYear >= inspectedYear;
                  const ageAtCursor =
                    isAliveAtCursor && inspectedYear !== null
                      ? inspectedYear - row.startYear
                      : null;

                  // Check overlap with selected person's lifespan
                  const overlapStart = selectedRow
                    ? Math.max(row.startYear, selectedRow.startYear)
                    : 0;
                  const overlapEnd = selectedRow
                    ? Math.min(row.endYear, selectedRow.endYear)
                    : -1;
                  const overlapYears =
                    selectedRow && overlapEnd >= overlapStart
                      ? overlapEnd - overlapStart
                      : null;
                  const isContemporaryWithSelected =
                    !selectedRow ||
                    !highlightOverlap ||
                    isSelected ||
                    overlapYears !== null;

                  const isDimmed =
                    (inspectedYear !== null && !isAliveAtCursor) ||
                    (inspectedYear === null &&
                      selectedRow &&
                      highlightOverlap &&
                      !isContemporaryWithSelected);

                  // Distinct styling for Living vs Deceased and Male vs Female
                  const barStyle =
                    row.person.gender === 'male'
                      ? row.isLiving
                        ? 'bg-gradient-to-r from-sky-600 via-sky-500 to-teal-500 text-white shadow-xs'
                        : 'bg-sky-800/80 dark:bg-sky-900/85 text-sky-50 border border-sky-400/30'
                      : row.person.gender === 'female'
                        ? row.isLiving
                          ? 'bg-gradient-to-r from-rose-600 via-pink-500 to-amber-500 text-white shadow-xs'
                          : 'bg-rose-800/80 dark:bg-rose-900/85 text-rose-50 border border-rose-400/30'
                        : row.isLiving
                          ? 'bg-gradient-to-r from-slate-600 to-teal-600 text-white'
                          : 'bg-slate-700/80 text-slate-100';

                  return (
                    <div key={row.person.id}>
                      {showGenHeader && (
                        <div className="sticky left-0 z-20 mt-3 mb-1.5 flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          >
                            Generasi {row.generation}
                          </Badge>
                          <div className="h-px flex-1 bg-border/60" />
                        </div>
                      )}

                      <div
                        className={cn(
                          'group flex items-center rounded-lg py-1 transition-all',
                          isSelected
                            ? 'bg-primary/12 ring-1 ring-primary/30'
                            : 'hover:bg-muted/40',
                          isDimmed && 'opacity-30'
                        )}
                      >
                        {/* Sticky Left Name Column */}
                        <button
                          type="button"
                          onClick={() => onSelectPerson(row.person.id)}
                          className={cn(
                            'sticky left-0 z-20 flex w-52 sm:w-60 shrink-0 items-center justify-between gap-1.5 pr-3 pl-1.5 py-0.5 text-left transition-colors rounded-l-lg',
                            isSelected
                              ? 'bg-background/95'
                              : 'bg-background/90 group-hover:bg-background/95'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {/* Avatar / Initials Dot */}
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs',
                                row.person.gender === 'male'
                                  ? 'bg-sky-500'
                                  : row.person.gender === 'female'
                                    ? 'bg-pink-500'
                                    : 'bg-slate-500'
                              )}
                            >
                              {row.initials}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className={cn(
                                    'truncate text-xs font-medium text-foreground group-hover:text-primary',
                                    isSelected && 'font-semibold text-primary'
                                  )}
                                  title={row.person.fullName}
                                >
                                  {row.person.fullName}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right mini-meta on name column: Gen badge or Overlap years */}
                          <div className="flex items-center gap-1 shrink-0">
                            {selectedRow &&
                              highlightOverlap &&
                              !isSelected &&
                              overlapYears !== null && (
                                <span
                                  className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[9px] font-semibold text-primary"
                                  title={`Hidup sezaman dengan ${selectedRow.person.fullName} selama ${overlapYears} tahun (${overlapStart}–${overlapEnd})`}
                                >
                                  {overlapYears}th
                                </span>
                              )}
                            <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
                              G{row.generation}
                            </span>
                          </div>
                        </button>

                        {/* Timeline Bar Track */}
                        <div
                          className="relative h-7 flex-1 cursor-crosshair"
                          onMouseMove={handleTrackMouseMove}
                          onMouseLeave={() => setActiveYear(null)}
                          onClick={handleTrackClick}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(row.person.id);
                            }}
                            className={cn(
                              'absolute top-0.5 flex h-6 items-center justify-between overflow-hidden rounded-full px-2.5 text-[10px] font-semibold transition-all hover:brightness-105',
                              barStyle,
                              row.isEstimatedStart && 'border-l-2 border-dashed border-amber-300',
                              isSelected && 'ring-2 ring-amber-500 ring-offset-1 ring-offset-background z-10'
                            )}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={`${row.person.fullName} (${row.isEstimatedStart ? '~' : ''}${row.startYear} – ${
                              row.isLiving ? 'Sekarang' : row.endYear
                            } · ${row.age} thn)${
                              overlapYears !== null && !isSelected && selectedRow
                                ? ` • Sezaman dengan ${selectedRow.person.fullName}: ${overlapYears} thn`
                                : ''
                            }`}
                          >
                            {/* Left: Birth–Death years */}
                            <span className="truncate flex items-center gap-1">
                              <span>
                                {row.isEstimatedStart ? '~' : ''}
                                {row.startYear}
                                {!row.isLiving ? `–${row.endYear}` : ''}
                              </span>
                            </span>

                            {/* Life Event Markers inside the bar (Marriages & Child Births) */}
                            {(isSelected || widthPct > 18) &&
                              row.events.map((ev, evIdx) => {
                                const evPct =
                                  row.endYear > row.startYear
                                    ? ((ev.year - row.startYear) /
                                        (row.endYear - row.startYear)) *
                                      100
                                    : 50;
                                if (evPct < 12 || evPct > 86) return null;
                                return (
                                  <span
                                    key={`${ev.type}-${ev.year}-${evIdx}`}
                                    style={{ left: `${evPct}%` }}
                                    title={ev.label}
                                    className={cn(
                                      'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 w-2 rounded-full ring-1 ring-black/30 transition-transform group-hover:scale-125',
                                      ev.type === 'marriage'
                                        ? 'bg-rose-200'
                                        : 'bg-amber-300'
                                    )}
                                  />
                                );
                              })}

                            {/* Right: Age + Living Pulse Indicator */}
                            <span className="ml-1.5 flex items-center gap-1 shrink-0">
                              <span className="tabular-nums opacity-95">
                                {ageAtCursor !== null
                                  ? `${ageAtCursor} thn`
                                  : `${row.age} thn`}
                              </span>
                              {row.isLiving && (
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-emerald-200/40 animate-pulse shrink-0"
                                  title="Masih hidup"
                                />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Selected Person Life Events Quick Bar */}
      {selectedRow && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-card/95 px-3 sm:px-4 py-2 text-xs backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge variant="default" className="rounded-full text-[11px]">
              {selectedRow.person.fullName}
            </Badge>
            <span className="text-muted-foreground">
              {selectedRow.startYear} – {selectedRow.isLiving ? `Sekarang (${selectedRow.age} thn)` : `${selectedRow.endYear} (Wafat usia ${selectedRow.age} thn)`}
            </span>
            <span className="text-muted-foreground hidden sm:inline">·</span>
            <span className="text-primary font-medium">
              Hidup sezaman dengan {selectedContemporariesCount} anggota keluarga
            </span>
          </div>

          {selectedRow.events.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
              {selectedRow.events.slice(0, 4).map((ev, idx) => (
                <span
                  key={`${ev.year}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] whitespace-nowrap"
                  title={ev.label}
                >
                  {ev.type === 'marriage' ? (
                    <Heart className="h-3 w-3 text-rose-500 shrink-0" />
                  ) : (
                    <Baby className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[160px]">{ev.label}</span>
                </span>
              ))}
              {selectedRow.events.length > 4 && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  +{selectedRow.events.length - 4} peristiwa lainnya
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
