import { useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { User, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FamilyTreeProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

export function FamilyTree({ persons, relationships, selectedPersonId, onSelectPerson }: FamilyTreeProps) {
  // Build hierarchical family structure by generation
  const generationData = useMemo(() => {
    if (persons.length === 0) return [];

    // Build maps for relationships
    const childToParents = new Map<string, Set<string>>();
    const parentToChildren = new Map<string, Set<string>>();
    const spouseMap = new Map<string, Set<string>>();

    relationships.forEach(r => {
      if (r.type === 'PARENT_CHILD') {
        // Child -> Parents
        if (!childToParents.has(r.toPersonId)) {
          childToParents.set(r.toPersonId, new Set());
        }
        childToParents.get(r.toPersonId)!.add(r.fromPersonId);

        // Parent -> Children
        if (!parentToChildren.has(r.fromPersonId)) {
          parentToChildren.set(r.fromPersonId, new Set());
        }
        parentToChildren.get(r.fromPersonId)!.add(r.toPersonId);
      } else if (r.type === 'SPOUSE') {
        if (!spouseMap.has(r.fromPersonId)) {
          spouseMap.set(r.fromPersonId, new Set());
        }
        spouseMap.get(r.fromPersonId)!.add(r.toPersonId);
        
        if (!spouseMap.has(r.toPersonId)) {
          spouseMap.set(r.toPersonId, new Set());
        }
        spouseMap.get(r.toPersonId)!.add(r.fromPersonId);
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
            .map(id => persons.find(p => p.id === id))
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
            .map(id => persons.find(p => p.id === id))
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
    <div className="p-6 space-y-10">
      {generationData.map(({ generation, familyUnits }) => (
        <div key={generation}>
          {/* Generation Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {generation}
            </span>
            <h3 className="font-display font-semibold text-lg">Generasi {generation}</h3>
            <span className="text-sm text-muted-foreground">
              ({familyUnits.reduce((acc, u) => acc + u.parents.length, 0)} orang)
            </span>
          </div>

          {/* Family Units */}
          <div className="flex flex-wrap gap-6 pl-11">
            {familyUnits.map((unit, idx) => (
              <FamilyUnitCard
                key={idx}
                unit={unit}
                selectedPersonId={selectedPersonId}
                onSelectPerson={onSelectPerson}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface FamilyUnitData {
  parents: Person[];
  children: Person[];
}

interface FamilyUnitCardProps {
  unit: FamilyUnitData;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

function FamilyUnitCard({ unit, selectedPersonId, onSelectPerson }: FamilyUnitCardProps) {
  const hasChildren = unit.children.length > 0;

  return (
    <div className="flex flex-col items-center bg-card/50 rounded-xl p-4 border border-border/50">
      {/* Parents */}
      <div className="flex items-center gap-2">
        {unit.parents.map((parent, idx) => (
          <div key={parent.id} className="flex items-center gap-2">
            {idx > 0 && <Heart className="w-4 h-4 text-accent fill-accent" />}
            <PersonCard
              person={parent}
              isSelected={selectedPersonId === parent.id}
              onClick={() => onSelectPerson(parent.id)}
            />
          </div>
        ))}
      </div>

      {/* Connector & Children */}
      {hasChildren && (
        <>
          <div className="w-px h-4 bg-border mt-3" />
          <div className="text-xs text-muted-foreground mb-2">Anak:</div>
          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {unit.children.map(child => (
              <PersonCard
                key={child.id}
                person={child}
                isSelected={selectedPersonId === child.id}
                onClick={() => onSelectPerson(child.id)}
                size="small"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface PersonCardProps {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
  size?: 'normal' | 'small';
}

function PersonCard({ person, isSelected, onClick, size = 'normal' }: PersonCardProps) {
  const yearBirth = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const yearDeath = person.deathDate ? new Date(person.deathDate).getFullYear() : null;
  const isSmall = size === 'small';

  const genderColors = {
    male: {
      border: 'border-node-male',
      bg: 'bg-node-male/15',
      avatar: 'bg-node-male/25 text-node-male'
    },
    female: {
      border: 'border-node-female',
      bg: 'bg-node-female/15',
      avatar: 'bg-node-female/25 text-node-female'
    },
    unknown: {
      border: 'border-node-unknown',
      bg: 'bg-node-unknown/15',
      avatar: 'bg-node-unknown/25 text-node-unknown'
    }
  };

  const colors = genderColors[person.gender];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-lg border-2 transition-all duration-200",
        "hover:shadow-md hover:scale-105",
        isSmall ? "p-2 min-w-[100px]" : "p-3 min-w-[130px]",
        colors.border,
        colors.bg,
        isSelected && "ring-2 ring-offset-2 ring-accent shadow-warm scale-105"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "rounded-full flex items-center justify-center",
        isSmall ? "w-8 h-8 mb-1" : "w-11 h-11 mb-1.5",
        colors.avatar
      )}>
        {person.photoUrl ? (
          <img 
            src={person.photoUrl} 
            alt={person.fullName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className={isSmall ? "w-4 h-4" : "w-5 h-5"} />
        )}
      </div>

      {/* Name */}
      <span className={cn(
        "font-medium text-center leading-tight",
        isSmall ? "text-[11px]" : "text-sm"
      )}>
        {person.fullName}
      </span>

      {/* Years */}
      <span className={cn(
        "text-muted-foreground",
        isSmall ? "text-[9px]" : "text-xs"
      )}>
        {yearBirth || '?'}{yearDeath ? ` - ${yearDeath}` : ''}
      </span>

      {/* Verified badge */}
      {person.tags.includes('verified') && !isSmall && (
        <span className="mt-1 px-1 py-0.5 text-[9px] rounded bg-success/20 text-success font-medium">
          ✓ Verified
        </span>
      )}
    </button>
  );
}
