import { useMemo } from 'react';
import { User, Calendar, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { calculateGeneration } from '@/lib/familyUnits';
import type { Person, Relationship } from '@/types';

interface GenerationViewProps {
  persons: Person[];
  relationships: Relationship[];
  onEditPerson?: (person: Person) => void;
}

interface GenerationGroup {
  generation: number;
  label: string;
  persons: Person[];
  yearRange: { min: number | null; max: number | null };
}

// Average years between generations (used for estimation)
const GENERATION_GAP_YEARS = 25;

/**
 * Generation View - Groups persons by generation number with visual timeline
 * Uses relationship-based calculation with birth year fallback for orphan nodes
 */
export function GenerationView({ persons, relationships, onEditPerson }: GenerationViewProps) {
  // Calculate generation for each person and group them
  const generationGroups = useMemo(() => {
    // Step 1: Calculate relationship-based generations
    const personGenMap = new Map<string, { gen: number; hasParents: boolean }>();
    
    persons.forEach(person => {
      const gen = calculateGeneration(person.id, relationships);
      const hasParents = relationships.some(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === person.id
      );
      personGenMap.set(person.id, { gen, hasParents });
    });

    // Step 2: Find reference points from persons WITH parent relationships
    const personsWithParents = persons.filter(p => personGenMap.get(p.id)?.hasParents);
    
    // Build year ranges for each known generation
    const genYearRanges = new Map<number, { min: number; max: number }>();
    
    personsWithParents.forEach(person => {
      const genInfo = personGenMap.get(person.id);
      if (!genInfo || !person.birthDate) return;
      
      const year = new Date(person.birthDate).getFullYear();
      const existing = genYearRanges.get(genInfo.gen);
      
      if (existing) {
        existing.min = Math.min(existing.min, year);
        existing.max = Math.max(existing.max, year);
      } else {
        genYearRanges.set(genInfo.gen, { min: year, max: year });
      }
    });

    // Step 3: Estimate generation for persons WITHOUT parent relationships
    const personsWithoutParents = persons.filter(p => !personGenMap.get(p.id)?.hasParents);
    
    personsWithoutParents.forEach(person => {
      if (!person.birthDate) return; // Can't estimate without birth date
      
      const birthYear = new Date(person.birthDate).getFullYear();
      
      // Find the best matching generation based on year ranges
      let bestGen = 0;
      let bestMatch = false;
      
      genYearRanges.forEach((range, gen) => {
        // Check if birth year falls within or near this generation's range
        const buffer = GENERATION_GAP_YEARS / 2; // Allow some flexibility
        if (birthYear >= range.min - buffer && birthYear <= range.max + buffer) {
          bestGen = gen;
          bestMatch = true;
        }
      });
      
      // If no direct match, estimate based on year difference from known generations
      if (!bestMatch && genYearRanges.size > 0) {
        // Find the generation with closest year range
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
        
        // Adjust generation based on year difference
        const closestRange = genYearRanges.get(closestGen)!;
        const midYear = (closestRange.min + closestRange.max) / 2;
        const yearDiff = birthYear - midYear;
        const genOffset = Math.round(yearDiff / GENERATION_GAP_YEARS);
        
        bestGen = closestGen + genOffset;
      }
      
      // Update the person's generation
      personGenMap.set(person.id, { gen: bestGen, hasParents: false });
    });

    // Step 4: Group persons by their (possibly estimated) generation
    const personsByGen: Record<number, Person[]> = {};
    
    persons.forEach(person => {
      const genInfo = personGenMap.get(person.id);
      const gen = genInfo?.gen ?? 0;
      if (!personsByGen[gen]) personsByGen[gen] = [];
      personsByGen[gen].push(person);
    });

    // Step 5: Convert to array and sort
    const groups: GenerationGroup[] = Object.entries(personsByGen)
      .map(([gen, people]) => {
        const genNum = parseInt(gen);
        
        // Calculate year range for this generation
        const years = people
          .map(p => p.birthDate ? new Date(p.birthDate).getFullYear() : null)
          .filter((y): y is number => y !== null);
        
        const minYear = years.length > 0 ? Math.min(...years) : null;
        const maxYear = years.length > 0 ? Math.max(...years) : null;

        // Check if any person in this group has estimated generation
        const hasEstimated = people.some(p => !personGenMap.get(p.id)?.hasParents);

        return {
          generation: genNum,
          label: getGenerationLabel(genNum, hasEstimated),
          persons: people.sort((a, b) => {
            // Sort by birth date within generation
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
          }),
          yearRange: { min: minYear, max: maxYear }
        };
      })
      .sort((a, b) => a.generation - b.generation); // Youngest (lowest gen) first, oldest last

    return groups;
  }, [persons, relationships]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20 hidden md:block" />

      <div className="space-y-8">
        {generationGroups.map((group, groupIndex) => (
          <div key={group.generation} className="relative animate-fade-in" style={{ animationDelay: `${groupIndex * 100}ms` }}>
            {/* Timeline node */}
            <div className="absolute left-4 w-5 h-5 rounded-full bg-primary border-4 border-background shadow-lg hidden md:flex items-center justify-center z-10">
              <div className="w-2 h-2 rounded-full bg-background" />
            </div>

            {/* Generation header */}
            <div className="md:ml-14 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="default" className="text-sm px-3 py-1">
                  {group.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.persons.length} anggota
                </span>
                {group.yearRange.min && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {group.yearRange.min === group.yearRange.max 
                      ? `${group.yearRange.min}`
                      : `${group.yearRange.min} - ${group.yearRange.max}`
                    }
                  </span>
                )}
              </div>
            </div>

            {/* Persons in this generation */}
            <div className="md:ml-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {group.persons.map((person) => (
                <Card
                  key={person.id}
                  className="p-3 hover:shadow-md hover:bg-accent/50 transition-all cursor-pointer animate-scale-in"
                  onClick={() => onEditPerson?.(person)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
                        ${person.photoUrl ? 'border-2 border-border shadow-sm' : ''}
                        ${person.gender === 'male' ? 'bg-node-male/20 text-node-male' :
                          person.gender === 'female' ? 'bg-node-female/20 text-node-female' :
                            'bg-node-unknown/20 text-node-unknown'}
                      `}>
                        {person.photoUrl ? (
                          <img
                            src={person.photoUrl}
                            alt={person.fullName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      {person.tags.includes('verified') && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                          <CheckCircle className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{person.fullName}</p>
                      {person.birthDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDate(person.birthDate)}
                            {person.deathDate && (
                              <span className="text-muted-foreground/70"> - {formatDate(person.deathDate)}</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status indicator */}
                    {person.tags.includes('needs review') && (
                      <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Get human-readable label for generation number
 * Generation 0 = oldest ancestor (root), higher number = younger generation
 */
function getGenerationLabel(generation: number, hasEstimated?: boolean): string {
  const labels: Record<number, string> = {
    0: 'Leluhur (Generasi Tertua)',
    1: 'Generasi ke-2',
    2: 'Generasi ke-3',
    3: 'Generasi ke-4',
    4: 'Generasi ke-5',
    5: 'Generasi ke-6',
  };
  
  const label = labels[generation] || `Generasi ke-${generation + 1}`;
  return hasEstimated ? `${label} *` : label;
}
