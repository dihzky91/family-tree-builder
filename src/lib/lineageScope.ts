import type { Person, Relationship } from '@/types';

export type LineageDirection = 'both' | 'extended' | 'descendants' | 'ancestors';

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

export interface TrahCluster {
  id: string;
  rootPerson: Person;
  /** Objective cluster name consistent for all users, e.g. "Trah Mbah Ahmad" */
  name: string;
  /** Short name for compact badges, e.g. "Mbah Ahmad" */
  shortName: string;
  /** Optional relative context for active homePersonId, e.g. "Kakek · Ayah" */
  relativeLabel?: string;
  slot?: GrandparentSlot;
  source: 'grandparent' | 'pinned';
  dotClass: string;
  badgeClass: string;
  /** All members included when scoping this Trah (including direct spouses) */
  memberIds: Set<string>;
  /** Blood-line members only (used to prevent spouse cross-contamination on badges) */
  bloodIds: Set<string>;
}

export interface TrahClusterIndex {
  clusters: TrahCluster[];
  personToClusters: Map<string, TrahCluster[]>;
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
  extended: 'Keluarga Besar (Trah)',
  both: 'Leluhur & Keturunan',
  descendants: 'Keturunan Saja',
  ancestors: 'Leluhur Saja',
};

const PINNED_TRAH_PALETTE: { dotClass: string; badgeClass: string }[] = [
  {
    dotClass: 'bg-teal-500',
    badgeClass: 'border-teal-500/35 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  {
    dotClass: 'bg-rose-500',
    badgeClass: 'border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    dotClass: 'bg-indigo-500',
    badgeClass: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  {
    dotClass: 'bg-orange-500',
    badgeClass: 'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  },
  {
    dotClass: 'bg-cyan-500',
    badgeClass: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  {
    dotClass: 'bg-fuchsia-500',
    badgeClass: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  },
];

export function formatShortTrahName(fullName: string): string {
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Trah';
  const parts = cleaned.split(' ');
  if (parts.length <= 2) return cleaned;
  // Keep common honorific prefixes + 1-2 name tokens
  const firstLower = parts[0].toLowerCase().replace(/\.$/, '');
  const honorifics = new Set(['mbah', 'eyang', 'ki', 'kyai', 'kh', 'h', 'hj', 'r', 'ra', 'raden', 'dr', 'ir', 'prof', 'nyai', 'nyi', 'bapak', 'ibu', 'pak', 'bu']);
  if (honorifics.has(firstLower)) {
    // Handle multi-word Javanese honorific like "R. Ngt. Suhadiyah"
    const secondLower = parts[1].toLowerCase().replace(/\.$/, '');
    if (['ngt', 'ng', 'mas', 'ajeng', 'ayu', 'bagus', 'panji'].includes(secondLower) && parts.length >= 3) {
      return `${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[0]} ${parts[1]}`;
  }
  return `${parts[0]} ${parts[1]}`;
}

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
 * - `extended`: climbs to the topmost ancestor(s) of root and pulls all descendants downward + direct spouses (so siblings of Kakek/Nenek via Buyut are included in the Trah without bleeding into spouses' ancestors).
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

  if (direction === 'extended') {
    const bloodIds = collectExtendedBloodIds(rootPersonId, parentsByChild, childrenByParent);
    const included = new Set<string>(bloodIds);
    for (const memberId of bloodIds) {
      const spouses = spousesByPerson.get(memberId) || [];
      for (const spouseId of spouses) {
        included.add(spouseId);
      }
    }
    return included;
  }

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
 * Collects blood-line IDs for an extended Trah rooted at `rootPersonId`:
 * climbs upward to find topmost ancestor(s) of `rootPersonId`, then traverses
 * downward through all descendants (including siblings of `rootPersonId` and their children).
 */
function collectExtendedBloodIds(
  rootPersonId: string,
  parentsByChild: Map<string, string[]>,
  childrenByParent: Map<string, string[]>
): Set<string> {
  // 1. Climb upward to find all ancestors and identify topmost ancestor(s)
  const visitedAncestors = new Set<string>([rootPersonId]);
  const ancestorQueue: string[] = [rootPersonId];
  const topAncestors: string[] = [];

  while (ancestorQueue.length > 0) {
    const curr = ancestorQueue.shift()!;
    const parents = parentsByChild.get(curr) || [];
    if (parents.length === 0) {
      topAncestors.push(curr);
    } else {
      for (const parentId of parents) {
        if (!visitedAncestors.has(parentId)) {
          visitedAncestors.add(parentId);
          ancestorQueue.push(parentId);
        }
      }
    }
  }

  // Fallback in case of cyclic data
  if (topAncestors.length === 0) {
    topAncestors.push(rootPersonId);
  }

  // 2. Traverse downward from all ancestors (topmost down to root) to get full extended clan bloodline
  const bloodIds = new Set<string>(visitedAncestors);
  const descQueue: string[] = [...visitedAncestors];
  for (const topId of topAncestors) {
    if (!bloodIds.has(topId)) {
      bloodIds.add(topId);
      descQueue.push(topId);
    }
  }

  while (descQueue.length > 0) {
    const curr = descQueue.shift()!;
    const children = childrenByParent.get(curr) || [];
    for (const childId of children) {
      if (!bloodIds.has(childId)) {
        bloodIds.add(childId);
        descQueue.push(childId);
      }
    }
  }

  return bloodIds;
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

/**
 * Builds Hybrid Trah/Bani clusters from:
 * 1. Auto-detected 4 grandparent lines (if `homePersonId` is set)
 * 2. Pinned favorite lineages (`pinnedLineageIds`)
 *
 * Uses objective Trah naming ("Trah [Nama Leluhur]") + optional personal relative label.
 * Blood-line membership is prioritized for badge assignment so a spouse who has their own Trah
 * (e.g. Kakek Ayah married to Nenek Ayah) does not receive their spouse's Trah badge,
 * while in-laws without their own blood Trah cleanly inherit their spouse's Trah badge.
 */
export function buildTrahClusters(options: {
  homePersonId: string | null;
  pinnedLineageIds?: string[];
  persons: Person[];
  relationships: Relationship[];
}): TrahClusterIndex {
  const { homePersonId, pinnedLineageIds = [], persons, relationships } = options;

  if (persons.length === 0) {
    return { clusters: [], personToClusters: new Map() };
  }

  const personById = new Map<string, Person>();
  for (const p of persons) personById.set(p.id, p);

  const { parentsByChild, childrenByParent, spousesByPerson } =
    buildAdjacency(relationships);

  const clusters: TrahCluster[] = [];
  const seenRootIds = new Set<string>();

  const createCluster = (
    person: Person,
    meta: {
      source: 'grandparent' | 'pinned';
      slot?: GrandparentSlot;
      relativeLabel?: string;
      dotClass: string;
      badgeClass: string;
    }
  ): TrahCluster => {
    const bloodIds = collectExtendedBloodIds(person.id, parentsByChild, childrenByParent);
    const memberIds = new Set<string>(bloodIds);
    for (const memberId of bloodIds) {
      const spouses = spousesByPerson.get(memberId) || [];
      for (const spouseId of spouses) {
        memberIds.add(spouseId);
      }
    }
    const shortName = formatShortTrahName(person.fullName);
    return {
      id: person.id,
      rootPerson: person,
      name: `Trah ${shortName}`,
      shortName,
      relativeLabel: meta.relativeLabel,
      slot: meta.slot,
      source: meta.source,
      dotClass: meta.dotClass,
      badgeClass: meta.badgeClass,
      memberIds,
      bloodIds,
    };
  };

  // 1. Up to 4 Grandparent Trah clusters from homePersonId
  const grandparentLines = detectFourGrandparentLines(homePersonId, persons, relationships);
  for (const line of grandparentLines) {
    if (seenRootIds.has(line.person.id)) continue;
    seenRootIds.add(line.person.id);
    clusters.push(
      createCluster(line.person, {
        source: 'grandparent',
        slot: line.slot,
        relativeLabel: line.shortLabel,
        dotClass: line.dotClass,
        badgeClass: line.badgeClass,
      })
    );
  }

  // 2. Additional Pinned Trah clusters (not already covered by grandparent lines)
  let paletteIndex = 0;
  for (const pinnedId of pinnedLineageIds) {
    if (seenRootIds.has(pinnedId)) continue;
    const person = personById.get(pinnedId);
    if (!person) continue;
    seenRootIds.add(pinnedId);
    const colors = PINNED_TRAH_PALETTE[paletteIndex % PINNED_TRAH_PALETTE.length];
    paletteIndex++;
    clusters.push(
      createCluster(person, {
        source: 'pinned',
        dotClass: colors.dotClass,
        badgeClass: colors.badgeClass,
      })
    );
  }

  // 3. Build person -> clusters lookup
  // First pass: assign blood-line clusters
  const personToClusters = new Map<string, TrahCluster[]>();
  for (const cluster of clusters) {
    for (const memberId of cluster.bloodIds) {
      const list = personToClusters.get(memberId);
      if (list) list.push(cluster);
      else personToClusters.set(memberId, [cluster]);
    }
  }

  // Second pass: for spouses/in-laws who don't belong to any blood cluster,
  // assign the cluster(s) they married into
  for (const person of persons) {
    if (personToClusters.has(person.id)) continue;
    const inLawClusters: TrahCluster[] = [];
    for (const cluster of clusters) {
      if (cluster.memberIds.has(person.id)) {
        inLawClusters.push(cluster);
      }
    }
    if (inLawClusters.length > 0) {
      personToClusters.set(person.id, inLawClusters);
    }
  }

  return { clusters, personToClusters };
}
