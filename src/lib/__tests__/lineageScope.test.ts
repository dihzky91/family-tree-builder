import { describe, it, expect } from 'vitest';
import {
  detectFourGrandparentLines,
  filterDataByLineageScope,
  getLineagePersonIds,
} from '../lineageScope';
import type { Person, Relationship } from '@/types';

const now = '2026-01-01T00:00:00.000Z';

function makePerson(id: string, fullName: string, gender: 'male' | 'female' | 'unknown'): Person {
  return {
    id,
    fullName,
    gender,
    tags: [],
    confidenceScore: 80,
    createdAt: now,
    updatedAt: now,
  };
}

function parentChild(id: string, parentId: string, childId: string): Relationship {
  return {
    id,
    type: 'PARENT_CHILD',
    fromPersonId: parentId,
    toPersonId: childId,
    meta: {},
    createdAt: now,
    updatedAt: now,
  };
}

function spouse(id: string, p1: string, p2: string): Relationship {
  return {
    id,
    type: 'SPOUSE',
    fromPersonId: p1,
    toPersonId: p2,
    meta: { status: 'married' },
    createdAt: now,
    updatedAt: now,
  };
}

describe('lineageScope', () => {
  const persons: Person[] = [
    makePerson('me', 'Saya', 'male'),
    makePerson('father', 'Ayah', 'male'),
    makePerson('mother', 'Ibu', 'female'),
    makePerson('pat-gf', 'Kakek Ayah', 'male'),
    makePerson('pat-gm', 'R. Ngt. Suhadiyah', 'female'),
    makePerson('pat-gm-father', 'Buyut Suhadiyah', 'male'),
    makePerson('pat-gf-father', 'Buyut Kakek Ayah', 'male'),
    makePerson('mat-gf', 'Kakek Ibu', 'male'),
    makePerson('mat-gm', 'Nenek Ibu', 'female'),
    makePerson('uncle-pat', 'Paman Jalur Ayah', 'male'),
    makePerson('aunt-inlaw', 'Tante Menantu', 'female'),
    makePerson('cousin-pat', 'Sepupu Ayah', 'female'),
    makePerson('uncle-mat', 'Paman Jalur Ibu', 'male'),
  ];

  const relationships: Relationship[] = [
    parentChild('r1', 'father', 'me'),
    parentChild('r2', 'mother', 'me'),
    spouse('r3', 'father', 'mother'),
    parentChild('r4', 'pat-gf', 'father'),
    parentChild('r5', 'pat-gm', 'father'),
    spouse('r6', 'pat-gf', 'pat-gm'),
    parentChild('r7', 'pat-gm-father', 'pat-gm'),
    parentChild('r8', 'pat-gf-father', 'pat-gf'),
    parentChild('r9', 'mat-gf', 'mother'),
    parentChild('r10', 'mat-gm', 'mother'),
    spouse('r11', 'mat-gf', 'mat-gm'),
    parentChild('r12', 'pat-gm', 'uncle-pat'),
    spouse('r13', 'uncle-pat', 'aunt-inlaw'),
    parentChild('r14', 'uncle-pat', 'cousin-pat'),
    parentChild('r15', 'mat-gm', 'uncle-mat'),
  ];

  it('detects all 4 grandparent lines from homePersonId', () => {
    const lines = detectFourGrandparentLines('me', persons, relationships);
    expect(lines.map((l) => l.slot)).toEqual([
      'paternal_grandfather',
      'paternal_grandmother',
      'maternal_grandfather',
      'maternal_grandmother',
    ]);
    expect(lines.find((l) => l.slot === 'paternal_grandmother')?.person.fullName).toBe(
      'R. Ngt. Suhadiyah'
    );
  });

  it('returns empty array when homePersonId is null', () => {
    expect(detectFourGrandparentLines(null, persons, relationships)).toEqual([]);
  });

  it('scopes R. Ngt. Suhadiyah (both) with her ancestors, descendants & direct spouses without bleeding into Kakek Ayah ancestors or Ibu line', () => {
    const ids = getLineagePersonIds('pat-gm', 'both', persons, relationships);

    expect(ids.has('pat-gm')).toBe(true);
    expect(ids.has('pat-gm-father')).toBe(true);
    expect(ids.has('father')).toBe(true);
    expect(ids.has('me')).toBe(true);
    expect(ids.has('uncle-pat')).toBe(true);
    expect(ids.has('aunt-inlaw')).toBe(true);
    expect(ids.has('cousin-pat')).toBe(true);
    // Direct spouses of root/descendants are included to keep couples intact
    expect(ids.has('pat-gf')).toBe(true);
    expect(ids.has('mother')).toBe(true);

    // Must NOT bleed into spouse's ancestors or unrelated maternal side
    expect(ids.has('pat-gf-father')).toBe(false);
    expect(ids.has('mat-gf')).toBe(false);
    expect(ids.has('mat-gm')).toBe(false);
    expect(ids.has('uncle-mat')).toBe(false);
  });

  it('filters relationships so no dangling edges remain', () => {
    const scoped = filterDataByLineageScope(
      { type: 'person', rootPersonId: 'pat-gm', direction: 'descendants' },
      persons,
      relationships
    );

    expect(scoped.includedIds.has('pat-gm-father')).toBe(false);
    for (const rel of scoped.relationships) {
      expect(scoped.includedIds.has(rel.fromPersonId)).toBe(true);
      expect(scoped.includedIds.has(rel.toPersonId)).toBe(true);
    }
  });
});
