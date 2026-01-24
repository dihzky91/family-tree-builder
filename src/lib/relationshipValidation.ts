import type { Person, Relationship, RelationshipType } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a relationship before creation/update
 */
export function validateRelationship(
  type: RelationshipType,
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[],
  excludeRelationshipId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Self-reference check
  if (fromPersonId === toPersonId) {
    errors.push('Tidak bisa membuat relasi dengan diri sendiri');
    return { valid: false, errors, warnings };
  }

  const fromPerson = persons.find(p => p.id === fromPersonId);
  const toPerson = persons.find(p => p.id === toPersonId);

  if (!fromPerson || !toPerson) {
    errors.push('Person tidak ditemukan');
    return { valid: false, errors, warnings };
  }

  // Filter out the relationship being edited
  const existingRelationships = excludeRelationshipId
    ? relationships.filter(r => r.id !== excludeRelationshipId)
    : relationships;

  if (type === 'PARENT_CHILD') {
    // Check for loop: fromPerson (parent) should not be a descendant of toPerson (child)
    if (isDescendant(fromPersonId, toPersonId, existingRelationships)) {
      errors.push('Loop terdeteksi: Tidak bisa menjadi orang tua dari leluhur sendiri');
    }

    // Check if this parent-child already exists
    const exists = existingRelationships.some(
      r => r.type === 'PARENT_CHILD' && r.fromPersonId === fromPersonId && r.toPersonId === toPersonId
    );
    if (exists) {
      errors.push('Relasi parent-child ini sudah ada');
    }

    // Check for max 2 parents (warning, not error)
    const existingParents = existingRelationships.filter(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === toPersonId
    );
    if (existingParents.length >= 2) {
      warnings.push('Anak ini sudah memiliki 2 orang tua. Menambahkan lebih dari 2 mungkin tidak umum.');
    }

    // Age gap warning (not blocking)
    if (fromPerson.birthDate && toPerson.birthDate) {
      const parentYear = new Date(fromPerson.birthDate).getFullYear();
      const childYear = new Date(toPerson.birthDate).getFullYear();
      const ageGap = childYear - parentYear;

      if (ageGap < 0) {
        warnings.push(`Peringatan: Anak lahir ${Math.abs(ageGap)} tahun sebelum orang tua`);
      } else if (ageGap < 12) {
        warnings.push(`Peringatan: Selisih usia hanya ${ageGap} tahun`);
      }
    }
  }

  if (type === 'SPOUSE') {
    // Check if spouse relationship already exists (in either direction)
    const exists = existingRelationships.some(
      r => r.type === 'SPOUSE' && 
           ((r.fromPersonId === fromPersonId && r.toPersonId === toPersonId) ||
            (r.fromPersonId === toPersonId && r.toPersonId === fromPersonId))
    );
    if (exists) {
      errors.push('Relasi pasangan ini sudah ada');
    }

    // Check for parent-child relationship (can't be both spouse and parent-child)
    const isParentChild = existingRelationships.some(
      r => r.type === 'PARENT_CHILD' && 
           ((r.fromPersonId === fromPersonId && r.toPersonId === toPersonId) ||
            (r.fromPersonId === toPersonId && r.toPersonId === fromPersonId))
    );
    if (isParentChild) {
      errors.push('Tidak bisa menjadi pasangan dari orang tua/anak');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Checks if `potentialDescendant` is a descendant of `ancestorId`
 */
function isDescendant(
  potentialDescendant: string,
  ancestorId: string,
  relationships: Relationship[]
): boolean {
  const visited = new Set<string>();
  const queue = [ancestorId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find parents of current
    const parentRels = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === current
    );

    for (const rel of parentRels) {
      if (rel.fromPersonId === potentialDescendant) {
        return true;
      }
      queue.push(rel.fromPersonId);
    }
  }

  return false;
}

/**
 * Get relationship display info
 */
export function getRelationshipDisplayInfo(
  relationship: Relationship,
  currentPersonId: string,
  persons: Person[]
): { label: string; icon: string; person: Person | undefined } {
  const otherPersonId = relationship.fromPersonId === currentPersonId 
    ? relationship.toPersonId 
    : relationship.fromPersonId;
  const otherPerson = persons.find(p => p.id === otherPersonId);

  if (relationship.type === 'SPOUSE') {
    const status = relationship.meta?.status || 'unknown';
    const statusLabels: Record<string, string> = {
      married: 'Menikah dengan',
      divorced: 'Mantan pasangan',
      partner: 'Pasangan',
      unknown: 'Pasangan'
    };
    return {
      label: statusLabels[status],
      icon: '💕',
      person: otherPerson
    };
  }

  if (relationship.type === 'PARENT_CHILD') {
    if (relationship.fromPersonId === currentPersonId) {
      return {
        label: 'Orang tua dari',
        icon: '👶',
        person: otherPerson
      };
    } else {
      return {
        label: 'Anak dari',
        icon: '👨‍👩‍👧',
        person: otherPerson
      };
    }
  }

  return { label: 'Relasi', icon: '🔗', person: otherPerson };
}
