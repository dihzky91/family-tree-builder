import { memo, useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { Heart, CheckCircle2, Users, Baby } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getEstimatedYear,
  formatShortYearLabel,
  getSortableTimestamp,
} from '@/lib/flexibleDateUtils';

interface GenerationViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  highlightedPersonIds?: Set<string> | null;
  onSelectPerson: (id: string) => void;
}

interface FamilyUnitData {
  parents: Person[];
  children: Person[];
}

function getYear(date?: string | null) {
  return getEstimatedYear(date);
}

function getPersonYearsLabel(person: Person) {
  const birth = formatShortYearLabel(person.birthDate);
  const death = formatShortYearLabel(person.deathDate);
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `${birth}`;
  if (death) return `† ${death}`;
  return '—';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRangeLabel(people: Person[]) {
  const years = people
    .map((person) => getYear(person.birthDate))
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);

  if (years.length === 0) return null;
  if (years.length === 1) return `${years[0]}`;
  return `${years[0]} – ${years[years.length - 1]}`;
}

export const GenerationView = memo(function GenerationView({
  persons,
  relationships,
  selectedPersonId,
  highlightedPersonIds,
  onSelectPerson,
}: GenerationViewProps) {
  // Build hierarchical family structure by generation
  const generationData = useMemo(() => {
    if (persons.length === 0) return [];

    const personById = new Map(persons.map((person) => [person.id, person]));

    // Build maps for relationships
    const childToParents = new Map<string, Set<string>>();
    const parentToChildren = new Map<string, Set<string>>();
    const spouseMap = new Map<string, Set<string>>();

    const addToSetMap = (map: Map<string, Set<string>>, key: string, value: string) => {
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      map.get(key)!.add(value);
    };

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        addToSetMap(childToParents, r.toPersonId, r.fromPersonId);
        addToSetMap(parentToChildren, r.fromPersonId, r.toPersonId);
      } else if (r.type === 'SPOUSE') {
        addToSetMap(spouseMap, r.fromPersonId, r.toPersonId);
        addToSetMap(spouseMap, r.toPersonId, r.fromPersonId);
      }
    });

    // Calculate generation for each person (1 = oldest generation with no parents)
    const personGeneration = new Map<string, number>();

    const getGeneration = (personId: string, visited: Set<string> = new Set()): number => {
      if (personGeneration.has(personId)) {
        return personGeneration.get(personId)!;
      }

      if (visited.has(personId)) return 1;
      visited.add(personId);

      const parents = childToParents.get(personId);
      if (!parents || parents.size === 0) {
        personGeneration.set(personId, 1);
        return 1;
      }

      let maxParentGen = 0;
      parents.forEach((parentId) => {
        const parentGen = getGeneration(parentId, new Set(visited));
        maxParentGen = Math.max(maxParentGen, parentGen);
      });

      const gen = maxParentGen + 1;
      personGeneration.set(personId, gen);
      return gen;
    };

    // Calculate generation for all persons
    persons.forEach((p) => getGeneration(p.id));

    // Group persons by generation
    const genGroups = new Map<number, Person[]>();
    persons.forEach((p) => {
      const gen = personGeneration.get(p.id) || 1;
      if (!genGroups.has(gen)) {
        genGroups.set(gen, []);
      }
      genGroups.get(gen)!.push(p);
    });

    // Build family units per generation
    const result: { generation: number; familyUnits: FamilyUnitData[] }[] = [];
    const processedInUnit = new Set<string>();

    Array.from(genGroups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([gen, people]) => {
        const units: FamilyUnitData[] = [];

        people.forEach((person) => {
          if (processedInUnit.has(person.id)) return;

          // Get spouses in same generation
          const spouses = Array.from(spouseMap.get(person.id) || [])
            .map((id) => personById.get(id))
            .filter((p): p is Person => !!p && personGeneration.get(p.id) === gen);

          const parents = [person];
          spouses.forEach((s) => {
            if (!processedInUnit.has(s.id)) {
              parents.push(s);
            }
          });

          // Mark all parents as processed
          parents.forEach((p) => processedInUnit.add(p.id));

          // Get children of this couple
          const childrenIds = new Set<string>();
          parents.forEach((parent) => {
            const kids = parentToChildren.get(parent.id);
            if (kids) {
              kids.forEach((id) => childrenIds.add(id));
            }
          });

          const children = Array.from(childrenIds)
            .map((id) => personById.get(id))
            .filter((p): p is Person => !!p)
            .sort((a, b) => {
              const da = getSortableTimestamp(a.birthDate) ?? Number.MAX_SAFE_INTEGER;
              const db = getSortableTimestamp(b.birthDate) ?? Number.MAX_SAFE_INTEGER;
              return da - db;
            });

          units.push({ parents, children });
        });

        if (units.length > 0) {
          result.push({ generation: gen, familyUnits: units });
        }
      });

    return result;
  }, [persons, relationships]);

  if (generationData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        Tidak ada data untuk ditampilkan
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6">
      {generationData.map(({ generation, familyUnits }) => {
        const parentCount = familyUnits.reduce((acc, unit) => acc + unit.parents.length, 0);
        const childCount = familyUnits.reduce((acc, unit) => acc + unit.children.length, 0);

        return (
          <section
            key={generation}
            className="rounded-3xl border border-border/60 bg-background/90 p-4 sm:p-5 shadow-sm backdrop-blur-sm"
          >
            {/* Compact Single-Row Generation Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                  G{generation}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-foreground leading-none">
                      Generasi {generation}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      · {familyUnits.length} keluarga
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
                  <Users className="h-3 w-3 text-primary" />
                  {parentCount} anggota inti
                </span>
                {childCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
                    <Baby className="h-3 w-3 text-accent" />
                    {childCount} anak
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
              {familyUnits.map((unit, idx) => (
                <FamilyUnitCard
                  key={idx}
                  unit={unit}
                  selectedPersonId={selectedPersonId}
                  highlightedPersonIds={highlightedPersonIds}
                  onSelectPerson={onSelectPerson}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});

GenerationView.displayName = 'GenerationView';

interface CompactPersonItemProps {
  person: Person;
  isSelected: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onClick: () => void;
  variant?: 'parent' | 'child';
}

const CompactPersonItem = memo(function CompactPersonItem({
  person,
  isSelected,
  isHighlighted = false,
  isDimmed = false,
  onClick,
  variant = 'parent',
}: CompactPersonItemProps) {
  const isVerified = person.tags.includes('verified');
  const yearsLabel = getPersonYearsLabel(person);

  const genderStyles = {
    male: {
      bar: 'bg-node-male',
      avatar: 'bg-node-male/15 text-node-male ring-1 ring-node-male/30',
    },
    female: {
      bar: 'bg-node-female',
      avatar: 'bg-node-female/15 text-node-female ring-1 ring-node-female/30',
    },
    unknown: {
      bar: 'bg-node-unknown',
      avatar: 'bg-node-unknown/15 text-node-unknown ring-1 ring-node-unknown/30',
    },
  }[person.gender];

  return (
    <button
      type="button"
      onClick={onClick}
      data-person-id={person.id}
      className={cn(
        'group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border text-left transition-all',
        variant === 'parent' ? 'p-2.5' : 'p-2',
        isSelected
          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
          : isHighlighted
            ? 'border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/35 shadow-sm'
            : 'border-border/70 bg-background/95 hover:border-primary/40 hover:bg-accent/5',
        isDimmed && 'opacity-30 hover:opacity-80'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', genderStyles.bar)} />

      <div
        className={cn(
          'ml-1 flex shrink-0 items-center justify-center rounded-full font-semibold overflow-hidden',
          variant === 'parent' ? 'h-9 w-9 text-xs' : 'h-7 w-7 text-[11px]',
          genderStyles.avatar
        )}
      >
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.fullName}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span>{getInitials(person.fullName)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p
            className={cn(
              'truncate font-medium text-foreground',
              variant === 'parent' ? 'text-xs sm:text-sm' : 'text-xs'
            )}
            title={person.fullName}
          >
            {person.fullName}
          </p>
          {isVerified && (
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-label="Terverifikasi"
            />
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{yearsLabel}</p>
      </div>
    </button>
  );
});

interface FamilyUnitCardProps {
  unit: FamilyUnitData;
  selectedPersonId: string | null;
  highlightedPersonIds?: Set<string> | null;
  onSelectPerson: (id: string) => void;
}

const FamilyUnitCard = memo(function FamilyUnitCard({
  unit,
  selectedPersonId,
  highlightedPersonIds,
  onSelectPerson,
}: FamilyUnitCardProps) {
  const hasChildren = unit.children.length > 0;
  const familyRange = getRangeLabel([...unit.parents, ...unit.children]);
  const allUnitMembers = [...unit.parents, ...unit.children];
  const selectedInsideUnit = allUnitMembers.some((person) => person.id === selectedPersonId);
  const spotlightActive = Boolean(highlightedPersonIds && highlightedPersonIds.size > 0);
  const hasHighlightedInsideUnit =
    spotlightActive && allUnitMembers.some((person) => highlightedPersonIds!.has(person.id));

  const familyTitle = unit.parents
    .map((parent) => parent.fullName.split(' ')[0])
    .join(' & ');

  return (
    <article
      className={cn(
        'relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card/90 p-3.5 shadow-sm transition-all',
        selectedInsideUnit || hasHighlightedInsideUnit
          ? 'border-primary/50 bg-primary/[0.03]'
          : 'border-border/70',
        spotlightActive && !hasHighlightedInsideUnit && 'opacity-45'
      )}
    >
      <div>
        {/* Compact Card Header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground" title={familyTitle}>
              Keluarga {familyTitle}
            </h4>
            {familyRange && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                ({familyRange})
              </span>
            )}
          </div>
          {hasChildren && (
            <span className="shrink-0 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {unit.children.length} anak
            </span>
          )}
        </div>

        {/* Parents / Couple Row (Side-by-side without awkward vertical wrapping) */}
        {unit.parents.length === 2 ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <CompactPersonItem
              person={unit.parents[0]}
              isSelected={selectedPersonId === unit.parents[0].id}
              isHighlighted={spotlightActive && highlightedPersonIds!.has(unit.parents[0].id)}
              isDimmed={spotlightActive && !highlightedPersonIds!.has(unit.parents[0].id)}
              onClick={() => onSelectPerson(unit.parents[0].id)}
              variant="parent"
            />
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent"
              title="Pasangan"
            >
              <Heart className="h-3 w-3 fill-current" />
            </div>
            <CompactPersonItem
              person={unit.parents[1]}
              isSelected={selectedPersonId === unit.parents[1].id}
              isHighlighted={spotlightActive && highlightedPersonIds!.has(unit.parents[1].id)}
              isDimmed={spotlightActive && !highlightedPersonIds!.has(unit.parents[1].id)}
              onClick={() => onSelectPerson(unit.parents[1].id)}
              variant="parent"
            />
          </div>
        ) : unit.parents.length === 1 ? (
          <div className="max-w-xs">
            <CompactPersonItem
              person={unit.parents[0]}
              isSelected={selectedPersonId === unit.parents[0].id}
              isHighlighted={spotlightActive && highlightedPersonIds!.has(unit.parents[0].id)}
              isDimmed={spotlightActive && !highlightedPersonIds!.has(unit.parents[0].id)}
              onClick={() => onSelectPerson(unit.parents[0].id)}
              variant="parent"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unit.parents.map((parent) => (
              <CompactPersonItem
                key={parent.id}
                person={parent}
                isSelected={selectedPersonId === parent.id}
                isHighlighted={spotlightActive && highlightedPersonIds!.has(parent.id)}
                isDimmed={spotlightActive && !highlightedPersonIds!.has(parent.id)}
                onClick={() => onSelectPerson(parent.id)}
                variant="parent"
              />
            ))}
          </div>
        )}

        {/* Tree Connector & Children Grid */}
        {hasChildren && (
          <div className="mt-1">
            <div className="flex flex-col items-center">
              <div className="h-3 w-px bg-border" />
              <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Keturunan ({unit.children.length})
              </span>
              <div className="h-2 w-px bg-border" />
            </div>

            <div
              className={cn(
                'grid gap-1.5 rounded-xl border border-dashed border-border/70 bg-muted/20 p-2',
                unit.children.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
              )}
            >
              {unit.children.map((child) => (
                <CompactPersonItem
                  key={child.id}
                  person={child}
                  isSelected={selectedPersonId === child.id}
                  isHighlighted={spotlightActive && highlightedPersonIds!.has(child.id)}
                  isDimmed={spotlightActive && !highlightedPersonIds!.has(child.id)}
                  onClick={() => onSelectPerson(child.id)}
                  variant="child"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
});

FamilyUnitCard.displayName = 'FamilyUnitCard';
