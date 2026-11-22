import type { Person, Relationship } from '@/types';

export interface DuplicateCandidate {
  person1: Person;
  person2: Person;
  score: number; // 0-100
  reasons: string[];
  fieldMatches: {
    field: string;
    value1: string | null;
    value2: string | null;
    match: boolean;
  }[];
}

export interface DuplicateScanOptions {
  relationships?: Relationship[];
  minScore?: number;
  includeIgnored?: boolean;
}

const IGNORED_STORAGE_KEY = 'silsilah_ignored_duplicate_pairs';
export const IGNORED_DUPLICATES_EVENT = 'silsilah:ignored-duplicates-changed';

export function makePairKey(id1: string, id2: string): string {
  return [id1, id2].sort().join('-');
}

export function getIgnoredDuplicatePairs(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(IGNORED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveIgnoredDuplicatePairs(pairs: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify(Array.from(pairs)));
    window.dispatchEvent(new CustomEvent(IGNORED_DUPLICATES_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function addIgnoredDuplicatePair(pairKey: string): Set<string> {
  const pairs = getIgnoredDuplicatePairs();
  pairs.add(pairKey);
  saveIgnoredDuplicatePairs(pairs);
  return pairs;
}

export function removeIgnoredDuplicatePair(pairKey: string): Set<string> {
  const pairs = getIgnoredDuplicatePairs();
  pairs.delete(pairKey);
  saveIgnoredDuplicatePairs(pairs);
  return pairs;
}

export function clearIgnoredDuplicatePairs(): Set<string> {
  const empty = new Set<string>();
  saveIgnoredDuplicatePairs(empty);
  return empty;
}

/**
 * Normalize Indonesian honorifics & whitespace for fairer name comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(h\.|hj\.|dr\.|dra\.|drs\.|ir\.|prof\.|kh\.|r\.a\.|r\.|alm\.|almh\.)\s*/gi, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-100)
 */
function stringSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
  useNameNormalization = false
): number {
  if (!a || !b) return 0;

  const strA = useNameNormalization ? normalizeName(a) : a.toLowerCase().trim();
  const strB = useNameNormalization ? normalizeName(b) : b.toLowerCase().trim();

  if (strA === strB && strA.length > 0) return 100;
  if (strA.length === 0 || strB.length === 0) return 0;

  const maxLen = Math.max(strA.length, strB.length);
  const distance = levenshteinDistance(strA, strB);

  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calculate similarity between two dates (0-100)
 */
function dateSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;

  const dateA = new Date(a);
  const dateB = new Date(b);

  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;

  if (a === b) return 100;

  if (dateA.getFullYear() === dateB.getFullYear()) {
    if (dateA.getMonth() === dateB.getMonth()) {
      const dayDiff = Math.abs(dateA.getDate() - dateB.getDate());
      if (dayDiff <= 7) return 90;
      return 75;
    }
    return 60;
  }

  const yearDiff = Math.abs(dateA.getFullYear() - dateB.getFullYear());
  if (yearDiff === 1) return 35;

  return 0;
}

function areDirectlyRelated(
  id1: string,
  id2: string,
  relationships?: Relationship[]
): boolean {
  if (!relationships || relationships.length === 0) return false;
  return relationships.some(
    (r) =>
      (r.type === 'PARENT_CHILD' || r.type === 'SPOUSE') &&
      ((r.fromPersonId === id1 && r.toPersonId === id2) ||
        (r.fromPersonId === id2 && r.toPersonId === id1))
  );
}

/**
 * Calculate overall similarity score between two persons with hard contradiction checks
 */
export function calculateSimilarity(
  person1: Person,
  person2: Person,
  options: DuplicateScanOptions = {}
): DuplicateCandidate | null {
  const minScore = options.minScore ?? 55;

  // Hard contradiction 1: Opposite known genders cannot be the same person
  if (
    person1.gender !== 'unknown' &&
    person2.gender !== 'unknown' &&
    person1.gender !== person2.gender
  ) {
    return null;
  }

  // Hard contradiction 2: Directly related as parent-child or spouse
  if (areDirectlyRelated(person1.id, person2.id, options.relationships)) {
    return null;
  }

  // Hard contradiction 3: Both have valid birth dates more than 5 years apart
  if (person1.birthDate && person2.birthDate) {
    const y1 = new Date(person1.birthDate).getFullYear();
    const y2 = new Date(person2.birthDate).getFullYear();
    if (!Number.isNaN(y1) && !Number.isNaN(y2) && Math.abs(y1 - y2) > 5) {
      return null;
    }
  }

  const reasons: string[] = [];
  const fieldMatches: DuplicateCandidate['fieldMatches'] = [];

  // 1. Name similarity (normalized for honorifics)
  const nameSim = stringSimilarity(person1.fullName, person2.fullName, true);
  if (nameSim < 60) {
    return null;
  }

  fieldMatches.push({
    field: 'Nama',
    value1: person1.fullName,
    value2: person2.fullName,
    match: nameSim >= 75,
  });

  if (nameSim === 100) {
    reasons.push('Nama identik');
  } else if (nameSim >= 85) {
    reasons.push(`Nama sangat mirip (${nameSim}%)`);
  } else {
    reasons.push(`Nama mirip (${nameSim}%)`);
  }

  // 2. Birth date similarity
  const hasBothBirthDates = Boolean(person1.birthDate && person2.birthDate);
  const birthSim = hasBothBirthDates ? dateSimilarity(person1.birthDate, person2.birthDate) : 0;
  fieldMatches.push({
    field: 'Tanggal Lahir',
    value1: person1.birthDate || null,
    value2: person2.birthDate || null,
    match: birthSim >= 60,
  });

  if (birthSim === 100) {
    reasons.push('Tanggal lahir sama persis');
  } else if (birthSim >= 75) {
    reasons.push('Tanggal lahir sangat dekat');
  } else if (birthSim >= 60) {
    reasons.push('Tahun lahir sama');
  }

  // 3. Gender match
  const hasBothGenders = person1.gender !== 'unknown' && person2.gender !== 'unknown';
  const genderMatch = hasBothGenders && person1.gender === person2.gender;
  fieldMatches.push({
    field: 'Gender',
    value1: person1.gender,
    value2: person2.gender,
    match: genderMatch,
  });

  // 4. Birth place / residence match
  const place1 = person1.birthPlace || person1.residence || null;
  const place2 = person2.birthPlace || person2.residence || null;
  const hasBothPlaces = Boolean(place1 && place2);
  const placeSim = hasBothPlaces ? stringSimilarity(place1, place2) : 0;
  if (place1 || place2) {
    fieldMatches.push({
      field: 'Lokasi',
      value1: place1,
      value2: place2,
      match: placeSim >= 80,
    });
    if (placeSim >= 80) {
      reasons.push('Lokasi sama');
    }
  }

  // 5. Death date similarity
  const hasBothDeathDates = Boolean(person1.deathDate && person2.deathDate);
  const deathSim = hasBothDeathDates ? dateSimilarity(person1.deathDate, person2.deathDate) : 0;
  if (person1.deathDate || person2.deathDate) {
    fieldMatches.push({
      field: 'Tanggal Wafat',
      value1: person1.deathDate || null,
      value2: person2.deathDate || null,
      match: deathSim >= 60,
    });
    if (deathSim >= 60) {
      reasons.push('Tahun wafat sama');
    }
  }

  // Dynamic weighted average across available fields so missing optional dates don't unfairly tank identical names
  let weightedSum = nameSim * 0.6;
  let totalWeight = 0.6;

  if (hasBothBirthDates) {
    weightedSum += birthSim * 0.25;
    totalWeight += 0.25;
  }
  if (hasBothGenders) {
    weightedSum += (genderMatch ? 100 : 0) * 0.08;
    totalWeight += 0.08;
  }
  if (hasBothPlaces) {
    weightedSum += placeSim * 0.07;
    totalWeight += 0.07;
  }
  if (hasBothDeathDates) {
    weightedSum += deathSim * 0.08;
    totalWeight += 0.08;
  }

  const score = Math.round(weightedSum / totalWeight);

  if (score < minScore) {
    return null;
  }

  return {
    person1,
    person2,
    score,
    reasons,
    fieldMatches,
  };
}

/**
 * Find all potential duplicates in a list of persons
 */
export function findAllDuplicates(
  persons: Person[],
  options: DuplicateScanOptions = {}
): DuplicateCandidate[] {
  const duplicates: DuplicateCandidate[] = [];
  const seen = new Set<string>();
  const ignoredPairs = options.includeIgnored ? new Set<string>() : getIgnoredDuplicatePairs();

  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const pairKey = makePairKey(persons[i].id, persons[j].id);
      if (seen.has(pairKey) || ignoredPairs.has(pairKey)) continue;
      seen.add(pairKey);

      const candidate = calculateSimilarity(persons[i], persons[j], options);
      if (candidate) {
        duplicates.push(candidate);
      }
    }
  }

  return duplicates.sort((a, b) => b.score - a.score);
}

/**
 * Merge two persons into one, keeping the best data from each (including location fields!)
 */
export interface MergeDecision {
  fullName: 'person1' | 'person2';
  gender: 'person1' | 'person2';
  birthDate: 'person1' | 'person2' | 'none';
  deathDate: 'person1' | 'person2' | 'none';
  birthPlace: 'person1' | 'person2' | 'none';
  deathPlace: 'person1' | 'person2' | 'none';
  residence: 'person1' | 'person2' | 'none';
  photoUrl: 'person1' | 'person2' | 'none';
  notes: 'merge' | 'person1' | 'person2';
  tags: 'merge';
  keepId: 'person1' | 'person2';
}

export function getDefaultMergeDecision(candidate: DuplicateCandidate): MergeDecision {
  const { person1, person2 } = candidate;

  return {
    fullName: person1.fullName.length >= person2.fullName.length ? 'person1' : 'person2',
    gender: person1.gender !== 'unknown' ? 'person1' : 'person2',
    birthDate: person1.birthDate ? 'person1' : person2.birthDate ? 'person2' : 'none',
    deathDate: person1.deathDate ? 'person1' : person2.deathDate ? 'person2' : 'none',
    birthPlace: person1.birthPlace ? 'person1' : person2.birthPlace ? 'person2' : 'none',
    deathPlace: person1.deathPlace ? 'person1' : person2.deathPlace ? 'person2' : 'none',
    residence: person1.residence ? 'person1' : person2.residence ? 'person2' : 'none',
    photoUrl: person1.photoUrl ? 'person1' : person2.photoUrl ? 'person2' : 'none',
    notes: 'merge',
    tags: 'merge',
    keepId: new Date(person1.createdAt) < new Date(person2.createdAt) ? 'person1' : 'person2',
  };
}

export function applyMergeDecision(
  candidate: DuplicateCandidate,
  decision: MergeDecision
): { merged: Omit<Person, 'createdAt' | 'updatedAt'>; deleteId: string } {
  const { person1, person2 } = candidate;

  const getValue = <T>(field: 'person1' | 'person2' | 'none', v1: T, v2: T, none: T): T => {
    if (field === 'person1') return v1;
    if (field === 'person2') return v2;
    return none;
  };

  let notes = '';
  if (decision.notes === 'merge') {
    const n1 = person1.notes?.trim() || '';
    const n2 = person2.notes?.trim() || '';
    if (n1 && n2 && n1 === n2) notes = n1;
    else notes = [n1, n2].filter(Boolean).join('\n---\n');
  } else if (decision.notes === 'person1') {
    notes = person1.notes || '';
  } else {
    notes = person2.notes || '';
  }

  const allTags = [...new Set([...person1.tags, ...person2.tags])];
  const confidenceScore = Math.max(person1.confidenceScore, person2.confidenceScore);

  const keepPerson = decision.keepId === 'person1' ? person1 : person2;
  const deletePerson = decision.keepId === 'person1' ? person2 : person1;

  return {
    merged: {
      id: keepPerson.id,
      fullName: decision.fullName === 'person1' ? person1.fullName : person2.fullName,
      gender: decision.gender === 'person1' ? person1.gender : person2.gender,
      birthDate: getValue(decision.birthDate, person1.birthDate, person2.birthDate, null),
      deathDate: getValue(decision.deathDate, person1.deathDate, person2.deathDate, null),
      birthPlace: getValue(decision.birthPlace, person1.birthPlace ?? null, person2.birthPlace ?? null, null),
      deathPlace: getValue(decision.deathPlace, person1.deathPlace ?? null, person2.deathPlace ?? null, null),
      residence: getValue(decision.residence, person1.residence ?? null, person2.residence ?? null, null),
      photoUrl: getValue(decision.photoUrl, person1.photoUrl, person2.photoUrl, null),
      notes: notes || null,
      tags: allTags,
      confidenceScore,
    },
    deleteId: deletePerson.id,
  };
}
