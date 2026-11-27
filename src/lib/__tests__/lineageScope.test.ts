import { describe, it, expect } from 'vitest';
import {
  buildTrahClusters,
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

  it('extended direction includes siblings of grandparent via Buyut without bleeding into spouse Buyut', () => {
    const extendedPersons: Person[] = [
      ...persons,
      makePerson('grand-uncle-gm', 'Kakak Nenek Ayah', 'male'),
      makePerson('grand-cousin-gm', 'Anak Kakak Nenek', 'female'),
      makePerson('grand-uncle-gf', 'Adik Kakek Ayah', 'male'),
    ];
    const extendedRels: Relationship[] = [
      ...relationships,
      parentChild('r16', 'pat-gm-father', 'grand-uncle-gm'),
      parentChild('r17', 'grand-uncle-gm', 'grand-cousin-gm'),
      parentChild('r18', 'pat-gf-father', 'grand-uncle-gf'),
    ];

    const gmExtended = getLineagePersonIds('pat-gm', 'extended', extendedPersons, extendedRels);
    expect(gmExtended.has('pat-gm-father')).toBe(true);
    expect(gmExtended.has('grand-uncle-gm')).toBe(true);
    expect(gmExtended.has('grand-cousin-gm')).toBe(true);
    // Must NOT bleed into Kakek Ayah's Buyut or Kakek Ayah's sibling
    expect(gmExtended.has('pat-gf-father')).toBe(false);
    expect(gmExtended.has('grand-uncle-gf')).toBe(false);
  });

  it('buildTrahClusters assigns objective Trah names, keeps spouses separate, and gives in-laws fallback cluster', () => {
    const { clusters, personToClusters } = buildTrahClusters({
      homePersonId: 'me',
      pinnedLineageIds: [],
      persons,
      relationships,
    });

    expect(clusters).toHaveLength(4);
    expect(clusters.find((c) => c.id === 'pat-gm')?.name).toBe('Trah R. Ngt. Suhadiyah');
    expect(clusters.find((c) => c.id === 'pat-gm')?.relativeLabel).toBe('Nenek · Ayah');

    // Kakek Ayah only gets his own Trah badge (not his wife's Trah)
    expect(personToClusters.get('pat-gf')?.map((c) => c.id)).toEqual(['pat-gf']);
    expect(personToClusters.get('pat-gm')?.map((c) => c.id)).toEqual(['pat-gm']);

    // Father is blood child of both pat-gf and pat-gm -> gets both badges
    expect(personToClusters.get('father')?.map((c) => c.id)).toEqual(['pat-gf', 'pat-gm']);

    // Me is blood descendant of all 4 -> gets all 4 badges
    expect(personToClusters.get('me')?.map((c) => c.id)).toEqual([
      'pat-gf',
      'pat-gm',
      'mat-gf',
      'mat-gm',
    ]);

    // Aunt-inlaw (married to uncle-pat, no blood Trah of her own) inherits pat-gm Trah
    expect(personToClusters.get('aunt-inlaw')?.map((c) => c.id)).toEqual(['pat-gm']);
  });
});
