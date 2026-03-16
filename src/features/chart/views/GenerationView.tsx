import { memo, useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { PersonNode } from '../components/PersonNode';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerationViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

interface FamilyUnitData {
  parents: Person[];
  children: Person[];
}

function getYear(date?: string) {
  return date ? new Date(date).getFullYear() : null;
}

function getRangeLabel(people: Person[]) {
  const years = people
    .map((person) => getYear(person.birthDate))
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);

  if (years.length === 0) return 'Tahun tidak diketahui';
  if (years.length === 1) return `${years[0]}`;
  return `${years[0]} - ${years[years.length - 1]}`;
}

export const GenerationView = memo(function GenerationView({ persons, relationships, selectedPersonId, onSelectPerson }: GenerationViewProps) {
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

    relationships.forEach(r => {
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
      parents.forEach(parentId => {
        const parentGen = getGeneration(parentId, new Set(visited));
        maxParentGen = Math.max(maxParentGen, parentGen);
      });
      
      const gen = maxParentGen + 1;
      personGeneration.set(personId, gen);
      return gen;
    };

    // Calculate generation for all persons
    persons.forEach(p => getGeneration(p.id));

    // Group persons by generation
    const genGroups = new Map<number, Person[]>();
    persons.forEach(p => {
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

        people.forEach(person => {
          if (processedInUnit.has(person.id)) return;

          // Get spouses in same generation
          const spouses = Array.from(spouseMap.get(person.id) || [])
            .map(id => personById.get(id))
            .filter((p): p is Person => !!p && personGeneration.get(p.id) === gen);

          const parents = [person];
          spouses.forEach(s => {
            if (!processedInUnit.has(s.id)) {
              parents.push(s);
            }
          });

          // Mark all parents as processed
          parents.forEach(p => processedInUnit.add(p.id));

          // Get children of this couple
          const childrenIds = new Set<string>();
          parents.forEach(parent => {
            const kids = parentToChildren.get(parent.id);
            if (kids) {
              kids.forEach(id => childrenIds.add(id));
            }
          });

          const children = Array.from(childrenIds)
            .map(id => personById.get(id))
            .filter((p): p is Person => !!p)
            .sort((a, b) => {
              const da = a.birthDate ? new Date(a.birthDate).getTime() : 0;
              const db = b.birthDate ? new Date(b.birthDate).getTime() : 0;
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
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8">
      {generationData.map(({ generation, familyUnits }) => (
        <section
          key={generation}
          className="rounded-[28px] border border-border/60 bg-background/88 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm"
        >
          <div className="mb-5 flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                G{generation}
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Cluster generasi</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-foreground">Generasi {generation}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {familyUnits.reduce((acc, unit) => acc + unit.parents.length + unit.children.length, 0)} anggota terlihat dalam {familyUnits.length} unit keluarga.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">
                {familyUnits.reduce((acc, unit) => acc + unit.parents.length, 0)} orang tua/pasangan
              </span>
              <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">
                {familyUnits.reduce((acc, unit) => acc + unit.children.length, 0)} anak terhubung
              </span>
            </div>
          </div>

          <div className="grid gap-5 pl-0 md:grid-cols-2 2xl:grid-cols-3">
            {familyUnits.map((unit, idx) => (
              <FamilyUnitCard
                key={idx}
                unit={unit}
                selectedPersonId={selectedPersonId}
                onSelectPerson={onSelectPerson}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

GenerationView.displayName = 'GenerationView';

interface FamilyUnitCardProps {
  unit: FamilyUnitData;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

const FamilyUnitCard = memo(function FamilyUnitCard({ unit, selectedPersonId, onSelectPerson }: FamilyUnitCardProps) {
  const hasChildren = unit.children.length > 0;
  const familyRange = getRangeLabel([...unit.parents, ...unit.children]);
  const selectedInsideUnit = [...unit.parents, ...unit.children].some((person) => person.id === selectedPersonId);

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[24px] border bg-card/88 p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.55)] transition-colors',
        selectedInsideUnit ? 'border-primary/50 bg-primary/[0.04]' : 'border-border/70'
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),transparent)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Unit keluarga</p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">
            {unit.parents.map((parent) => parent.fullName.split(' ')[0]).join(' & ')}
          </h4>
        </div>
        <div className="flex flex-col items-end gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1">
            {hasChildren ? `${unit.children.length} anak` : 'Belum ada anak'}
          </span>
          <span>{familyRange}</span>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Pasangan inti</span>
          {unit.parents.length > 1 && <Heart className="h-3.5 w-3.5 fill-accent text-accent" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unit.parents.map((parent, idx) => (
            <div key={parent.id} className="flex items-center gap-2">
              {idx > 0 && <Heart className="h-4 w-4 text-accent/80 fill-accent/80" />}
              <PersonNode
                person={parent}
                isSelected={selectedPersonId === parent.id}
                onClick={() => onSelectPerson(parent.id)}
                reduceMotion
              />
            </div>
          ))}
        </div>
      </div>

      {hasChildren && (
        <>
          <div className="mx-auto my-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-xs font-semibold text-muted-foreground">
            {unit.children.length}
          </div>
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">Anak dalam unit ini</p>
                <p className="text-[11px] text-muted-foreground">Tampilan dipadatkan agar mudah discan.</p>
              </div>
              <span className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                {getRangeLabel(unit.children)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-start">
              {unit.children.map(child => (
                <PersonNode
                  key={child.id}
                  person={child}
                  isSelected={selectedPersonId === child.id}
                  onClick={() => onSelectPerson(child.id)}
                  size="small"
                  reduceMotion
                />
              ))}
            </div>
          </div>
        </>
      )}
    </article>
  );
});

FamilyUnitCard.displayName = 'FamilyUnitCard';
