import { memo, useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { FamilyMainView } from './FamilyMainView';
import { transformToFamilyChartData } from '../utils/familyChartMapper';

interface FamilyViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent' | 'spouse' | 'child') => void;
}

export const FamilyView = memo(function FamilyView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
}: FamilyViewProps) {
  // Auto-select sensible default root so the tree renders immediately even before clicking
  const focusPerson = useMemo(() => {
    if (selectedPersonId) {
      const found = persons.find((p) => p.id === selectedPersonId);
      if (found) return found;
    }
    if (persons.length === 0) return null;

    // Prefer a person who has both/either parents or children (most connected)
    const connectionCount = new Map<string, number>();
    relationships.forEach((r) => {
      connectionCount.set(r.fromPersonId, (connectionCount.get(r.fromPersonId) || 0) + 1);
      connectionCount.set(r.toPersonId, (connectionCount.get(r.toPersonId) || 0) + 1);
    });

    return [...persons].sort(
      (a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0)
    )[0];
  }, [persons, relationships, selectedPersonId]);

  const summary = useMemo(() => {
    if (!focusPerson) return undefined;

    const parentIds = new Set<string>();
    const spouseIds = new Set<string>();
    const childIds = new Set<string>();

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        if (r.toPersonId === focusPerson.id) parentIds.add(r.fromPersonId);
        if (r.fromPersonId === focusPerson.id) childIds.add(r.toPersonId);
      } else if (r.type === 'SPOUSE') {
        if (r.fromPersonId === focusPerson.id) spouseIds.add(r.toPersonId);
        if (r.toPersonId === focusPerson.id) spouseIds.add(r.fromPersonId);
      }
    });

    // Include spouse's children
    spouseIds.forEach((sid) => {
      relationships.forEach((r) => {
        if (r.type === 'PARENT_CHILD' && r.fromPersonId === sid) {
          childIds.add(r.toPersonId);
        }
      });
    });

    const siblingIds = new Set<string>();
    if (parentIds.size > 0) {
      relationships.forEach((r) => {
        if (
          r.type === 'PARENT_CHILD' &&
          parentIds.has(r.fromPersonId) &&
          r.toPersonId !== focusPerson.id
        ) {
          siblingIds.add(r.toPersonId);
        }
      });
    }

    return {
      parents: parentIds.size,
      spouses: spouseIds.size,
      children: childIds.size,
      siblings: siblingIds.size,
    };
  }, [focusPerson, relationships]);

  const familyChartData = useMemo(
    () => transformToFamilyChartData(persons, relationships),
    [persons, relationships]
  );

  if (!focusPerson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">Belum ada anggota keluarga untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <FamilyMainView
      data={familyChartData}
      rootId={focusPerson.id}
      rootPerson={focusPerson}
      summary={summary}
      onSelectPerson={onSelectPerson}
      onAddRelationship={(id) => onAddRelationship?.(id, 'child')}
    />
  );
});

FamilyView.displayName = 'FamilyView';
