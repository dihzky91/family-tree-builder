import type { Person, Relationship } from '@/types';
import type { Datum } from 'family-chart';

/**
 * Transforms Person and Relationship data to the format required by family-chart.js
 * 
 * family-chart expects a flat array where each person has:
 * - id: unique identifier
 * - data: display information (name, birthday, gender, avatar)
 * - rels: relationship references (spouses, children, parents as ID arrays)
 */
export function transformToFamilyChartData(
  persons: Person[],
  relationships: Relationship[]
): Datum[] {
  // Build lookup maps for efficient relationship queries
  const spouseMap = new Map<string, Set<string>>();
  const childrenMap = new Map<string, Set<string>>();
  const parentsMap = new Map<string, Set<string>>();

  // Process all relationships once
  relationships.forEach(rel => {
    if (rel.type === 'SPOUSE') {
      // Spouse relationships are bidirectional
      if (!spouseMap.has(rel.fromPersonId)) {
        spouseMap.set(rel.fromPersonId, new Set());
      }
      if (!spouseMap.has(rel.toPersonId)) {
        spouseMap.set(rel.toPersonId, new Set());
      }
      spouseMap.get(rel.fromPersonId)!.add(rel.toPersonId);
      spouseMap.get(rel.toPersonId)!.add(rel.fromPersonId);
    } else if (rel.type === 'PARENT_CHILD') {
      // fromPersonId is parent, toPersonId is child
      if (!childrenMap.has(rel.fromPersonId)) {
        childrenMap.set(rel.fromPersonId, new Set());
      }
      childrenMap.get(rel.fromPersonId)!.add(rel.toPersonId);

      // Track parents for the child
      if (!parentsMap.has(rel.toPersonId)) {
        parentsMap.set(rel.toPersonId, new Set());
      }
      parentsMap.get(rel.toPersonId)!.add(rel.fromPersonId);
    }
  });

  // Transform each person to family-chart format
  return persons.map(person => {
    const nameParts = person.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const spouses = Array.from(spouseMap.get(person.id) || []);
    const children = Array.from(childrenMap.get(person.id) || []);
    const parents = Array.from(parentsMap.get(person.id) || []);

    return {
      id: person.id,
      data: {
        'first name': firstName,
        'last name': lastName,
        birthday: person.birthDate || '',
        gender: (person.gender === 'male' ? 'M' : 'F') as 'M' | 'F',
        avatar: person.photoUrl || undefined,
      },
      rels: {
        spouses: spouses,
        children: children,
        parents: parents,
      },
    };
  });
}

/**
 * Find the best root person for the tree (oldest ancestor with no parents)
 */
export function findRootPerson(
  persons: Person[],
  relationships: Relationship[]
): string | null {
  if (persons.length === 0) return null;

  // Build parent map
  const hasParent = new Set<string>();
  relationships.forEach(rel => {
    if (rel.type === 'PARENT_CHILD') {
      hasParent.add(rel.toPersonId);
    }
  });

  // Find persons without parents (roots)
  const roots = persons.filter(p => !hasParent.has(p.id));

  if (roots.length > 0) {
    // Prefer oldest root by birth date
    const sorted = roots.sort((a, b) => {
      if (!a.birthDate) return 1;
      if (!b.birthDate) return -1;
      return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
    });
    return sorted[0].id;
  }

  // Fallback to first person
  return persons[0].id;
}
