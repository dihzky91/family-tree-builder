import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
  GitBranch,
  MapPin,
  Link2,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { calculateGeneration } from '@/lib/familyUnits';
import { getPersonInitials } from './PersonDetailSheet';
import type { Person, Relationship } from '@/types';
import { cn } from '@/lib/utils';

interface GenerationViewProps {
  persons: Person[];
  relationships: Relationship[];
  onEditPerson?: (person: Person) => void;
}

interface GenerationGroup {
  generation: number; // Normalized 0-based index (0 = oldest)
  label: string;
  hasEstimated: boolean;
  persons: Person[];
  yearRange: { min: number | null; max: number | null };
}

const GENERATION_GAP_YEARS = 25;

export function GenerationView({ persons, relationships, onEditPerson }: GenerationViewProps) {
  const navigate = useNavigate();
  const [collapsedGens, setCollapsedGens] = useState<Record<number, boolean>>({});

  // Precompute relation counts per person for quick orphan visibility
  const relationCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    relationships.forEach((r) => {
      counts.set(r.fromPersonId, (counts.get(r.fromPersonId) || 0) + 1);
      counts.set(r.toPersonId, (counts.get(r.toPersonId) || 0) + 1);
    });
    return counts;
  }, [relationships]);

  // Calculate generation for each person and normalize so oldest is always 0 (Generasi 1 / Leluhur)
  const { generationGroups, anyEstimated } = useMemo(() => {
    const personGenMap = new Map<string, { gen: number; hasParents: boolean }>();

    persons.forEach((person) => {
      const gen = calculateGeneration(person.id, relationships);
      const hasParents = relationships.some(
        (r) => r.type === 'PARENT_CHILD' && r.toPersonId === person.id
      );
      personGenMap.set(person.id, { gen, hasParents });
    });

    const personsWithParents = persons.filter((p) => personGenMap.get(p.id)?.hasParents);
    const genYearRanges = new Map<number, { min: number; max: number }>();

    personsWithParents.forEach((person) => {
      const genInfo = personGenMap.get(person.id);
      if (!genInfo || !person.birthDate) return;
      const year = new Date(person.birthDate).getFullYear();
      if (Number.isNaN(year)) return;
      const existing = genYearRanges.get(genInfo.gen);
      if (existing) {
        existing.min = Math.min(existing.min, year);
        existing.max = Math.max(existing.max, year);
      } else {
        genYearRanges.set(genInfo.gen, { min: year, max: year });
      }
    });

    const personsWithoutParents = persons.filter((p) => !personGenMap.get(p.id)?.hasParents);

    personsWithoutParents.forEach((person) => {
      if (!person.birthDate) return;
      const birthYear = new Date(person.birthDate).getFullYear();
      if (Number.isNaN(birthYear)) return;

      let bestGen = 0;
      let bestMatch = false;

      genYearRanges.forEach((range, gen) => {
        const buffer = GENERATION_GAP_YEARS / 2;
        if (birthYear >= range.min - buffer && birthYear <= range.max + buffer) {
          bestGen = gen;
          bestMatch = true;
        }
      });

      if (!bestMatch && genYearRanges.size > 0) {
        let closestGen = 0;
        let closestDiff = Infinity;

        genYearRanges.forEach((range, gen) => {
          const midYear = (range.min + range.max) / 2;
          const diff = Math.abs(birthYear - midYear);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestGen = gen;
          }
        });

        const closestRange = genYearRanges.get(closestGen)!;
        const midYear = (closestRange.min + closestRange.max) / 2;
        const yearDiff = birthYear - midYear;
        const genOffset = Math.round(yearDiff / GENERATION_GAP_YEARS);
        bestGen = closestGen + genOffset;
      }

      personGenMap.set(person.id, { gen: bestGen, hasParents: false });
    });

    // Normalize generation indices so the minimum generation is ALWAYS 0 (no negative / "Generasi ke-0" bug)
    const allRawGens = Array.from(personGenMap.values()).map((v) => v.gen);
    const minRawGen = allRawGens.length > 0 ? Math.min(...allRawGens) : 0;

    const personsByGen: Record<number, Person[]> = {};
    persons.forEach((person) => {
      const rawGen = personGenMap.get(person.id)?.gen ?? minRawGen;
      const normalizedGen = rawGen - minRawGen;
      if (!personsByGen[normalizedGen]) personsByGen[normalizedGen] = [];
      personsByGen[normalizedGen].push(person);
    });

    let hasAnyEst = false;

    const groups: GenerationGroup[] = Object.entries(personsByGen)
      .map(([genKey, people]) => {
        const genNum = parseInt(genKey, 10);
        const years = people
          .map((p) => (p.birthDate ? new Date(p.birthDate).getFullYear() : null))
          .filter((y): y is number => y !== null && !Number.isNaN(y));

        const minYear = years.length > 0 ? Math.min(...years) : null;
        const maxYear = years.length > 0 ? Math.max(...years) : null;
        const hasEstimated = people.some((p) => !personGenMap.get(p.id)?.hasParents);
        if (hasEstimated) hasAnyEst = true;

        return {
          generation: genNum,
          label: getNormalizedGenerationLabel(genNum),
          hasEstimated,
          persons: [...people].sort((a, b) => {
            if (!a.birthDate && !b.birthDate) return a.fullName.localeCompare(b.fullName);
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
          }),
          yearRange: { min: minYear, max: maxYear },
        };
      })
      .sort((a, b) => a.generation - b.generation);

    return { generationGroups: groups, anyEstimated: hasAnyEst };
  }, [persons, relationships]);

  const toggleGroup = (gen: number) => {
    setCollapsedGens((prev) => ({ ...prev, [gen]: !prev[gen] }));
  };

  const allCollapsed =
    generationGroups.length > 0 &&
    generationGroups.every((g) => Boolean(collapsedGens[g.generation]));

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedGens({});
    } else {
      const next: Record<number, boolean> = {};
      generationGroups.forEach((g) => {
        next[g.generation] = true;
      });
      setCollapsedGens(next);
    }
  };

  const scrollToGeneration = (gen: number) => {
    setCollapsedGens((prev) => ({ ...prev, [gen]: false }));
    const el = document.getElementById(`gen-section-${gen}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (persons.length === 0) {
    return (
      <div className="empty-state py-20">
        <Users className="empty-state-icon" />
        <h3 className="text-lg font-medium mb-2">Belum Ada Anggota</h3>
        <p className="text-muted-foreground">
          Tambahkan anggota keluarga untuk melihat tampilan generasi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Jump Bar + Collapse All + Legend */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {generationGroups.map((group) => (
            <button
              key={group.generation}
              type="button"
              onClick={() => scrollToGeneration(group.generation)}
              className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              Gen {group.generation + 1}
              <span className="ml-1 text-[10px] opacity-75">({group.persons.length})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          {anyEstimated && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              title="Sebagian anggota belum memiliki relasi orang tua sehingga generasinya diperkirakan dari tahun lahir"
            >
              <Info className="w-3 h-3 shrink-0" />
              <span>* Estimasi tahun lahir</span>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {allCollapsed ? 'Buka Semua' : 'Lipat Semua'}
          </Button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20 hidden md:block" />

        <div className="space-y-4 md:space-y-6">
          {generationGroups.map((group, groupIndex) => {
            const isCollapsed = Boolean(collapsedGens[group.generation]);

            return (
              <div
                key={group.generation}
                id={`gen-section-${group.generation}`}
                className="relative scroll-mt-20 animate-fade-in"
                style={{ animationDelay: `${Math.min(groupIndex * 60, 300)}ms` }}
              >
                {/* Timeline node */}
                <div className="absolute left-4 top-1 w-5 h-5 rounded-full bg-primary border-4 border-background shadow-md hidden md:flex items-center justify-center z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-background" />
                </div>

                {/* Collapsible Generation Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.generation)}
                  className={cn(
                    'mb-3 flex w-full items-center justify-between gap-2 rounded-2xl border bg-muted/25 p-3 text-left transition-colors hover:bg-muted/40 md:ml-14 md:w-[calc(100%-3.5rem)] md:border-0 md:bg-transparent md:p-1 md:hover:bg-muted/30 md:rounded-xl'
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="default" className="px-2.5 py-0.5 text-xs">
                      {group.label}
                      {group.hasEstimated ? ' *' : ''}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.persons.length} anggota
                    </span>
                    {group.yearRange.min && (
                      <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                        {group.yearRange.min === group.yearRange.max
                          ? `${group.yearRange.min}`
                          : `${group.yearRange.min} – ${group.yearRange.max}`}
                      </span>
                    )}
                  </div>
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Persons in this generation */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:ml-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {group.persons.map((person) => {
                      const relCount = relationCountMap.get(person.id) || 0;
                      const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
                      const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null;
                      const locationText = person.residence || person.birthPlace;

                      return (
                        <Card
                          key={person.id}
                          className="group relative flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition-all hover:border-primary/40 hover:bg-accent/35 hover:shadow-md"
                          onClick={() => onEditPerson?.(person)}
                          title={person.fullName}
                        >
                          {/* Avatar / Initials */}
                          <div className="relative shrink-0 mt-0.5">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden text-xs font-bold ${
                                person.photoUrl ? 'border shadow-sm' : ''
                              } ${
                                person.gender === 'male'
                                  ? 'bg-node-male/20 text-node-male'
                                  : person.gender === 'female'
                                    ? 'bg-node-female/20 text-node-female'
                                    : 'bg-node-unknown/20 text-node-unknown'
                              }`}
                            >
                              {person.photoUrl ? (
                                <img
                                  src={person.photoUrl}
                                  alt={person.fullName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                getPersonInitials(person.fullName)
                              )}
                            </div>
                            {person.tags.includes('verified') && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                                <CheckCircle className="w-2 h-2 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <p className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                                {person.fullName}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/chart?focus=${person.id}`);
                                }}
                                title="Lihat di Silsilah"
                                aria-label={`Lihat ${person.fullName} di silsilah`}
                                className="opacity-70 md:opacity-0 md:group-hover:opacity-100 rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shrink-0 -mr-1 -mt-0.5"
                              >
                                <GitBranch className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {birthYear
                                  ? deathYear
                                    ? `${birthYear} – ${deathYear}`
                                    : `${birthYear}`
                                  : 'Tahun tidak diketahui'}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/85">
                              {locationText && (
                                <span className="inline-flex items-center gap-0.5 truncate max-w-[100px]">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{locationText}</span>
                                </span>
                              )}
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 shrink-0',
                                  relCount === 0 && 'text-amber-600 dark:text-amber-400'
                                )}
                              >
                                <Link2 className="w-2.5 h-2.5" />
                                {relCount > 0 ? `${relCount} relasi` : 'Belum terhubung'}
                              </span>
                              {person.tags.includes('needs review') && (
                                <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getNormalizedGenerationLabel(generation: number): string {
  if (generation === 0) return 'Generasi 1 · Leluhur';
  return `Generasi ${generation + 1}`;
}
