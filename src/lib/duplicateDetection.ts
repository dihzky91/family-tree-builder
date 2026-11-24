import type { Person, Relationship } from '@/types';
import { parseFlexibleDate } from '@/lib/flexibleDateUtils';

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
 * Common Indonesian given-name prefixes that frequently appear as the first word
 * of distinct people's names (e.g., "Siti Badriah" vs "Siti Zamronah", "Muhammad A" vs "Muhammad B").
 */
const COMMON_NAME_PREFIXES = new Set([
  'siti',
  'muhammad',
  'mohammad',
  'mohamad',
  'muhamad',
  'mochamad',
  'mochammad',
  'moch',
  'muh',
  'moh',
  'm',
  'ahmad',
  'achmad',
  'abdul',
  'abd',
  'nur',
  'noor',
  'sri',
  'ade',
  'andi',
  'raden',
  'tubagus',
  'nyimas',
  'kemas',
  'teuku',
  'cut',
  'lalu',
  'baiq',
  'i',
  'ni',
]);

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
 * Raw character-level Levenshtein similarity (0-100)
 */
function rawLevenshteinSimilarity(strA: string, strB: string): number {
  if (strA === strB && strA.length > 0) return 100;
  if (strA.length === 0 || strB.length === 0) return 0;

  const maxLen = Math.max(strA.length, strB.length);
  const distance = levenshteinDistance(strA, strB);

  return Math.round((1 - distance / maxLen) * 100);
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

  if (!useNameNormalization) {
    return rawLevenshteinSimilarity(strA, strB);
  }

  // Token-aware comparison for person names
  const tokensA = strA.split(' ').filter(Boolean);
  const tokensB = strB.split(' ').filter(Boolean);

  // Strip common opening prefixes ONLY when further tokens exist on that side
  const coreA =
    tokensA.length > 1 && COMMON_NAME_PREFIXES.has(tokensA[0]) ? tokensA.slice(1) : tokensA;
  const coreB =
    tokensB.length > 1 && COMMON_NAME_PREFIXES.has(tokensB[0]) ? tokensB.slice(1) : tokensB;

  const coreStrA = coreA.join(' ');
  const coreStrB = coreB.join(' ');
  const coreSim = rawLevenshteinSimilarity(coreStrA, coreStrB);

  // When both names have multiple words, evaluate token-by-token alignment so that
  // sharing only a first/last name while the other distinctive tokens differ strongly
  // does not produce a false duplicate (e.g., "Siti Badriah" vs "Siti Zamronah",
  // "Nabila Roma Norris" vs "Atika Roma Norris", "Budi Santoso" vs "Budi Hartono").
  if (tokensA.length > 1 && tokensB.length > 1) {
    // 1. Primary given-name check:
    // After stripping common prefixes (Siti, Muhammad, etc.), the first core token is the
    // person's primary given name (e.g. "nabila" vs "atika" in "Nabila Roma Norris" vs "Atika Roma Norris").
    // If both have >= 2 core tokens and share the trailing family/middle name(s), their first core tokens
    // MUST match (or be an initial abbreviation).
    const firstCoreA = coreA[0];
    const firstCoreB = coreB[0];
    const firstCoreInitialMatch =
      (firstCoreA.length === 1 && firstCoreB.startsWith(firstCoreA)) ||
      (firstCoreB.length === 1 && firstCoreA.startsWith(firstCoreB));
    const firstCoreSim = firstCoreInitialMatch
      ? 85
      : rawLevenshteinSimilarity(firstCoreA, firstCoreB);

    if (coreA.length > 1 && coreB.length > 1 && firstCoreSim < 75) {
      // Check if first core token of A matches elsewhere in B (in case of reversed word order)
      const bestElsewhereA = Math.max(
        ...coreB.slice(1).map((t) => rawLevenshteinSimilarity(firstCoreA, t))
      );
      const bestElsewhereB = Math.max(
        ...coreA.slice(1).map((t) => rawLevenshteinSimilarity(firstCoreB, t))
      );
      // If neither is a swapped word order (i.e. both mismatch), they have different given names
      // despite sharing a middle/last family name ("Nabila Roma Norris" vs "Atika Roma Norris")
      if (bestElsewhereA < 80 || bestElsewhereB < 80) {
        return Math.min(firstCoreSim, 45);
      }
    }

    // 2. Check best token match for each core token
    const minCoreTokens = Math.min(coreA.length, coreB.length);
    const maxCoreTokens = Math.max(coreA.length, coreB.length);
    const shorterCore = coreA.length <= coreB.length ? coreA : coreB;
    const longerCore = coreA.length <= coreB.length ? coreB : coreA;

    let matchedTokenScoreSum = 0;
    let strongTokenMatches = 0;

    for (const tok of shorterCore) {
      let bestSim = 0;
      for (const candidateTok of longerCore) {
        // Also handle initial abbreviations like "M" -> "Muhammad"
        const isInitialMatch =
          (tok.length === 1 && candidateTok.startsWith(tok)) ||
          (candidateTok.length === 1 && tok.startsWith(candidateTok));
        const sim = isInitialMatch ? 85 : rawLevenshteinSimilarity(tok, candidateTok);
        if (sim > bestSim) bestSim = sim;
      }
      matchedTokenScoreSum += bestSim;
      if (bestSim >= 75) strongTokenMatches++;
    }

    // If none of the core distinctive tokens match strongly (< 75%), reject/cap score
    if (strongTokenMatches === 0) {
      return Math.min(coreSim, 45);
    }

    // Require EVERY token of the shorter core name to have a strong match (>= 75%) in the longer core name.
    // For example:
    // - "Ahmad Fauzi" vs "Ahmad Rizki" -> only 1 of 2 matches -> rejected
    // - "Nabila Roma Norris" vs "Atika Roma Norris" -> only 2 of 3 matches -> rejected
    // - "Nabila Norris" vs "Nabila Roma Norris" -> 2 of 2 in shorterCore match -> allowed!
    const avgCoreTokenSim = matchedTokenScoreSum / minCoreTokens;
    if (minCoreTokens > 1 && strongTokenMatches < minCoreTokens) {
      return Math.min(firstCoreSim, Math.round(avgCoreTokenSim * 0.65), 50);
    }

    // Coverage penalty if one name has extra words
    const coverageRatio = minCoreTokens / maxCoreTokens;
    const tokenWeightedSim = Math.round(
      avgCoreTokenSim * (0.75 + 0.25 * coverageRatio)
    );

    return Math.min(coreSim, tokenWeightedSim);
  }

  // Single-word vs multi-word (e.g. "Badriah" vs "Siti Badriah", or "Siti" vs "Siti Badriah")
  if (tokensA.length !== tokensB.length) {
    const singleTok = tokensA.length === 1 ? tokensA[0] : tokensB[0];
    const multiTokens = tokensA.length === 1 ? tokensB : tokensA;
    const multiCore = tokensA.length === 1 ? coreB : coreA;

    // If the single-word name is ONLY a generic prefix (e.g. "Siti" vs "Siti Badriah"), keep score modest
    if (COMMON_NAME_PREFIXES.has(singleTok) && !multiCore.includes(singleTok)) {
      return Math.min(rawLevenshteinSimilarity(strA, strB), 50);
    }

    // If the single word matches the core name of the multi-word person (e.g. "Badriah" vs "Siti Badriah")
    const bestMatchInCore = Math.max(
      ...multiCore.map((t) => rawLevenshteinSimilarity(singleTok, t)),
      ...multiTokens.map((t) => rawLevenshteinSimilarity(singleTok, t))
    );
    if (bestMatchInCore >= 85) {
      return Math.round(bestMatchInCore * 0.88);
    }
  }

  return coreSim;
}

/**
 * Calculate similarity between two dates (0-100), supporting exact and flexible dates
 */
function dateSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  if (a === b) return 100;

  const pA = parseFlexibleDate(a);
  const pB = parseFlexibleDate(b);
  if (!pA || !pB) return 0;

  const yA = pA.estimatedYear;
  const yB = pB.estimatedYear;
  if (yA === null || yB === null) return 0;

  if (yA === yB) {
    if (pA.date1.month && pB.date1.month && pA.date1.month === pB.date1.month) {
      if (pA.date1.day && pB.date1.day) {
        const dayDiff = Math.abs(pA.date1.day - pB.date1.day);
        if (dayDiff === 0) return 95;
        if (dayDiff <= 7) return 90;
      }
      return 75;
    }
    return 60;
  }

  const yearDiff = Math.abs(yA - yB);
  if (yearDiff === 1) return 35;
  if ((pA.isApproximate || pB.isApproximate) && yearDiff <= 3) return 45;

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
 * Check if two people share at least one common parent in the tree (i.e. recorded siblings)
 */
function shareCommonParent(
  id1: string,
  id2: string,
  relationships?: Relationship[]
): boolean {
  if (!relationships || relationships.length === 0) return false;
  const parents1 = new Set<string>();
  for (const r of relationships) {
    if (r.type === 'PARENT_CHILD' && r.toPersonId === id1) {
      parents1.add(r.fromPersonId);
    }
  }
  if (parents1.size === 0) return false;
  for (const r of relationships) {
    if (r.type === 'PARENT_CHILD' && r.toPersonId === id2 && parents1.has(r.fromPersonId)) {
      return true;
    }
  }
  return false;
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

  // Hard contradiction 3: Birth date contradictions
  if (person1.birthDate && person2.birthDate) {
    const p1 = parseFlexibleDate(person1.birthDate);
    const p2 = parseFlexibleDate(person2.birthDate);
    const y1 = p1?.estimatedYear ?? null;
    const y2 = p2?.estimatedYear ?? null;
    if (y1 !== null && y2 !== null) {
      // More than 5 years apart -> definitely different people
      if (Math.abs(y1 - y2) > 5) {
        return null;
      }
      // Different year AND different exact month/day -> distinct birth records unless name is practically identical (>= 92%)
      if (
        y1 !== y2 &&
        p1?.isExactFullDate &&
        p2?.isExactFullDate &&
        (p1.date1.month !== p2.date1.month || p1.date1.day !== p2.date1.day)
      ) {
        const quickNameSim = stringSimilarity(person1.fullName, person2.fullName, true);
        if (quickNameSim < 92) {
          return null;
        }
      }
    }
  }

  const reasons: string[] = [];
  const fieldMatches: DuplicateCandidate['fieldMatches'] = [];

  // 1. Name similarity (normalized for honorifics)
  const nameSim = stringSimilarity(person1.fullName, person2.fullName, true);
  if (nameSim < 60) {
    return null;
  }

  // Hard contradiction 4: Recorded siblings (share a parent) with different names or different birth dates
  if (shareCommonParent(person1.id, person2.id, options.relationships)) {
    const differentBirthDates =
      Boolean(person1.birthDate && person2.birthDate) && person1.birthDate !== person2.birthDate;
    if (nameSim < 88 || differentBirthDates) {
      return null;
    }
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

  // Dynamic weighted average across available fields so missing optional dates don't unfairly tank identical names.
  // Note: Gender match is already enforced as a hard filter above, so we don't inflate similarity scores just for sharing the same gender.
  let weightedSum = nameSim * 0.65;
  let totalWeight = 0.65;

  if (hasBothBirthDates) {
    weightedSum += birthSim * 0.25;
    totalWeight += 0.25;
  }
  if (hasBothPlaces) {
    weightedSum += placeSim * 0.05;
    totalWeight += 0.05;
  }
  if (hasBothDeathDates) {
    weightedSum += deathSim * 0.05;
    totalWeight += 0.05;
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
