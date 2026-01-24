import { Users } from 'lucide-react';
import { FamilyUnitAccordion } from './FamilyUnitAccordion';
import type { NuclearFamily, Person } from '@/types';

interface FamilyUnitsViewProps {
  families: NuclearFamily[];
  onEditPerson?: (person: Person) => void;
}

/**
 * Container component for rendering all nuclear family units
 * Groups families by generation and manages expand/collapse
 */
export function FamilyUnitsView({ families, onEditPerson }: FamilyUnitsViewProps) {
  if (families.length === 0) {
    return (
      <div className="empty-state py-20">
        <Users className="empty-state-icon" />
        <h3 className="text-lg font-medium mb-2">Belum Ada Keluarga Inti</h3>
        <p className="text-muted-foreground">
          Tambahkan anggota keluarga dan relasi pasangan untuk melihat pengelompokan keluarga inti.
        </p>
      </div>
    );
  }

  // Group families by generation
  const familiesByGeneration = families.reduce((acc, family) => {
    const gen = family.generation;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(family);
    return acc;
  }, {} as Record<number, NuclearFamily[]>);

  const generations = Object.keys(familiesByGeneration)
    .map(Number)
    .sort((a, b) => b - a); // Highest generation first (oldest)

  return (
    <div className="space-y-8">
      {generations.map(gen => (
        <div key={gen}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Generasi {gen}
            </h3>
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">
              {familiesByGeneration[gen].length} keluarga
            </span>
          </div>
          
          <div className="space-y-3">
            {familiesByGeneration[gen].map((family, index) => (
              <FamilyUnitAccordion
                key={family.id}
                family={family}
                onEditPerson={onEditPerson}
                defaultOpen={gen === Math.max(...generations) && index === 0}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
