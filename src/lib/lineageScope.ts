import type { Person, Relationship } from '@/types';

export type LineageDirection = 'both' | 'descendants' | 'ancestors';

export type GrandparentSlot =
  | 'paternal_grandfather'
  | 'paternal_grandmother'
  | 'maternal_grandfather'
  | 'maternal_grandmother';

export type LineageScope =
  | { type: 'all' }
  | {
      type: 'person';
      rootPersonId: string;
      direction: LineageDirection;
      slot?: GrandparentSlot;
    };

export interface GrandparentLineageInfo {
  slot: GrandparentSlot;
  label: string;
  shortLabel: string;
  dotClass: string;
  badgeClass: string;
  person: Person;
  memberCount: number;
}

export interface ScopedFamilyData {
  persons: Person[];
  relationships: Relationship[];
  includedIds: Set<string>;
}

export const GRANDPARENT_SLOT_META: Record<
  GrandparentSlot,
  { label: string; shortLabel: string; dotClass: string; badgeClass: string }
> = {
  paternal_grandfather: {
    label: 'Jalur Kakek (Ayah)',
    shortLabel: 'Kakek · Ayah',
    dotClass: 'bg-sky-500',
    badgeClass:
      'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  paternal_grandmother: {
    label: 'Jalur Nenek (Ayah)',
    shortLabel: 'Nenek · Ayah',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  maternal_grandfather: {
    label: 'Jalur Kakek (Ibu)',
    shortLabel: 'Kakek · Ibu',
    dotClass: 'bg-amber-500',
    badgeClass:
      'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  maternal_grandmother: {
    label: 'Jalur Nenek (Ibu)',
    shortLabel: 'Nenek · Ibu',
    dotClass: 'bg-violet-500',
    badgeClass:
      'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
};

export const LINEAGE_DIRECTION_LABELS: Record<LineageDirection, string> = {
  both: 'Leluhur & Keturunan',
  descendants: 'Keturunan Saja',
  ancestors: 'Leluhur Saja',
};

function buildAdjacency(relationships: Relationship[]) {
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const spousesByPerson = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.type === 'PARENT_CHILD') {
      const parents = parentsByChild.get(rel.toPersonId);
      if (parents) parents.push(rel.fromPersonId);
      else parentsByChild.set(rel.toPersonId, [rel.fromPersonId]);

      const children = childrenByParent.get(rel.fromPersonId);
      if (children) children.push(rel.toPersonId);
      else childrenByParent.set(rel.fromPersonId, [rel.toPersonId]);
    } else if (rel.type === 'SPOUSE') {
      const s1 = spousesByPerson.get(rel.fromPersonId);
      if (s1) s1.push(rel.toPersonId);
      else spousesByPerson.set(rel.fromPersonId, [rel.toPersonId]);

      const s2 = spousesByPerson.get(rel.toPersonId);
      if (s2) s2.push(rel.fromPersonId);
      else spousesByPerson.set(rel.toPersonId, [rel.fromPersonId]);
    }
  }

  return { parentsByChild, childrenByParent, spousesByPerson };
}

/**
 * Compute the set of person IDs included in a lineage scope rooted at `rootPersonId`.
 * - `descendants`: root + all descendants + spouses of root and descendants (keeps nuclear families intact without pulling in spouses' own ancestral trees).
 * - `ancestors`: root + all ancestors upward.
 * - `both`: root + all ancestors + all descendants + spouses of root and descendants.
 */
export function getLineagePersonIds(
  rootPersonId: string,
  direction: LineageDirection,
  persons: Person[],
  relationships: Relationship[]
): Set<string> {
  const personExists = persons.some((p) => p.id === rootPersonId);
  if (!personExists) return new Set();

  const { parentsByChild, childrenByParent, spousesByPerson } =
    buildAdjacency(relationships);

  const included = new Set<string>([rootPersonId]);
  const descendantSet = new Set<string>([rootPersonId]);

  if (direction === 'descendants' || direction === 'both') {
    const queue: string[] = [rootPersonId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const children = childrenByParent.get(curr) || [];
      for (const childId of children) {
        if (!descendantSet.has(childId)) {
          descendantSet.add(childId);
          included.add(childId);
          queue.push(childId);
        }
      }
    }

    // Include direct spouses of root and descendants so family units render completely,
    // without expanding into those spouses' separate ancestral lines.
    for (const memberId of descendantSet) {
      const spouses = spousesByPerson.get(memberId) || [];
      for (const spouseId of spouses) {
        included.add(spouseId);
      }
    }
  }

  if (direction === 'ancestors' || direction === 'both') {
    const queue: string[] = [rootPersonId];
    const visitedAncestors = new Set<string>([rootPersonId]);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const parents = parentsByChild.get(curr) || [];
      for (const parentId of parents) {
        if (!visitedAncestors.has(parentId)) {
          visitedAncestors.add(parentId);
          included.add(parentId);
          queue.push(parentId);
        }
      }
    }
  }

  return included;
}

/**
 * Filter persons and relationships according to the active LineageScope.
 * If the scope is `all` or the root person no longer exists, returns the full dataset.
 */
export function filterDataByLineageScope(
  scope: LineageScope,
  persons: Person[],
  relationships: Relationship[]
): ScopedFamilyData {
  if (scope.type === 'all') {
    return {
      persons,
      relationships,
      includedIds: new Set(persons.map((p) => p.id)),
    };
  }

  const includedIds = getLineagePersonIds(
    scope.rootPersonId,
    scope.direction,
    persons,
    relationships
  );

  if (includedIds.size === 0) {
    return {
      persons,
      relationships,
      includedIds: new Set(persons.map((p) => p.id)),
    };
  }

  const scopedPersons = persons.filter((p) => includedIds.has(p.id));
  const scopedRelationships = relationships.filter(
    (r) => includedIds.has(r.fromPersonId) && includedIds.has(r.toPersonId)
  );

  return {
    persons: scopedPersons,
    relationships: scopedRelationships,
    includedIds,
  };
}

function pickParentsByGender(
  parentIds: string[],
  personById: Map<string, Person>
): { father: Person | null; mother: Person | null } {
  const parents = parentIds
    .map((id) => personById.get(id))
    .filter((p): p is Person => Boolean(p));

  const father = parents.find((p) => p.gender === 'male') || null;
  const mother = parents.find((p) => p.gender === 'female') || null;

  return { father, mother };
}

/**
 * Automatically detect up to 4 grandparent lineages from `homePersonId`
 * purely from PARENT_CHILD relationships (no Branch setup required).
 */
export function detectFourGrandparentLines(
  homePersonId: string | null,
  persons: Person[],
  relationships: Relationship[]
): GrandparentLineageInfo[] {
  if (!homePersonId || persons.length === 0) return [];

  const personById = new Map<string, Person>();
  for (const p of persons) personById.set(p.id, p);
  if (!personById.has(homePersonId)) return [];

  const { parentsByChild } = buildAdjacency(relationships);
  const homeParents = pickParentsByGender(
    parentsByChild.get(homePersonId) || [],
    personById
  );

  const candidates: { slot: GrandparentSlot; person: Person | null }[] = [];

  if (homeParents.father) {
    const paternalGP = pickParentsByGender(
      parentsByChild.get(homeParents.father.id) || [],
      personById
    );
    candidates.push(
      { slot: 'paternal_grandfather', person: paternalGP.father },
      { slot: 'paternal_grandmother', person: paternalGP.mother }
    );
  }

  if (homeParents.mother) {
    const maternalGP = pickParentsByGender(
      parentsByChild.get(homeParents.mother.id) || [],
      personById
    );
    candidates.push(
      { slot: 'maternal_grandfather', person: maternalGP.father },
      { slot: 'maternal_grandmother', person: maternalGP.mother }
    );
  }

  const results: GrandparentLineageInfo[] = [];
  for (const item of candidates) {
    if (!item.person) continue;
    const meta = GRANDPARENT_SLOT_META[item.slot];
    const memberIds = getLineagePersonIds(
      item.person.id,
      'both',
      persons,
      relationships
    );
    results.push({
      slot: item.slot,
      label: meta.label,
      shortLabel: meta.shortLabel,
      dotClass: meta.dotClass,
      badgeClass: meta.badgeClass,
      person: item.person,
      memberCount: memberIds.size,
    });
  }

  return results;
}
