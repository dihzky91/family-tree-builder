import { useMemo } from 'react';
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

export function FamilyView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
}: FamilyViewProps) {
  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  const familyData = useMemo(() => {
    if (!selectedPerson) return null;

    const parents: Person[] = [];
    const spouses: Person[] = [];
    const children: Person[] = [];
    const siblings: Person[] = [];

    // Get parents
    const parentIds = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === selectedPerson.id)
      .map(r => r.fromPersonId);

    parentIds.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person) parents.push(person);
    });

    // Get spouses
    const spouseRels = relationships.filter(
      r => r.type === 'SPOUSE' && (r.fromPersonId === selectedPerson.id || r.toPersonId === selectedPerson.id)
    );
    spouseRels.forEach(r => {
      const spouseId = r.fromPersonId === selectedPerson.id ? r.toPersonId : r.fromPersonId;
      const person = persons.find(p => p.id === spouseId);
      if (person) spouses.push(person);
    });

    // Get children
    const childIds = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === selectedPerson.id)
      .map(r => r.toPersonId);

    spouses.forEach(spouse => {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === spouse.id)
        .forEach(r => {
          if (!childIds.includes(r.toPersonId)) {
            childIds.push(r.toPersonId);
          }
        });
    });

    childIds.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person && !children.some(c => c.id === id)) {
        children.push(person);
      }
    });

    children.sort((a, b) => {
      const da = a.birthDate ? new Date(a.birthDate).getTime() : 0;
      const db = b.birthDate ? new Date(b.birthDate).getTime() : 0;
      return da - db;
    });

    // Get siblings
    if (parentIds.length > 0) {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && parentIds.includes(r.fromPersonId) && r.toPersonId !== selectedPerson.id)
        .forEach(r => {
          const person = persons.find(p => p.id === r.toPersonId);
          if (person && !siblings.some(s => s.id === person.id)) {
            siblings.push(person);
          }
        });
    }

    // Get grandparents
    const grandparents: Person[] = [];
    parents.forEach(parent => {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === parent.id)
        .forEach(r => {
          const person = persons.find(p => p.id === r.fromPersonId);
          if (person && !grandparents.some(g => g.id === person.id)) {
            grandparents.push(person);
          }
        });
    });

    return { parents, spouses, children, siblings, grandparents };
  }, [selectedPerson, persons, relationships]);

  if (!selectedPerson || !familyData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <div className="text-center">
          <p className="mb-2">Pilih anggota keluarga untuk melihat Family View</p>
          <p className="text-sm">Klik pada salah satu nama di daftar atau gunakan pencarian</p>
        </div>
      </div>
    );
  }

  const familyChartData = useMemo(() => {
    if (!selectedPerson) return [];
    const relevantIds = new Set<string>([
      selectedPerson.id,
      ...familyData.parents.map(p => p.id),
      ...familyData.spouses.map(p => p.id),
      ...familyData.children.map(p => p.id),
      ...familyData.siblings.map(p => p.id),
      ...familyData.grandparents.map(p => p.id),
    ]);

    const filteredPersons = persons.filter(p => relevantIds.has(p.id));
    const filteredRelationships = relationships.filter(
      r => relevantIds.has(r.fromPersonId) && relevantIds.has(r.toPersonId)
    );

    return transformToFamilyChartData(filteredPersons, filteredRelationships);
  }, [selectedPerson, familyData, persons, relationships]);

  return (
    <div className="w-full h-full">
      <FamilyMainView
        data={familyChartData}
        rootId={selectedPerson.id}
        onSelectPerson={onSelectPerson}
        onAddRelationship={(id) => onAddRelationship?.(id, 'child')}
      />
    </div>
  );
}
