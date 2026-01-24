import type { Person } from '@/types';

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
function stringSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  
  const strA = a.toLowerCase().trim();
  const strB = b.toLowerCase().trim();
  
  if (strA === strB) return 100;
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
  
  // Exact match
  if (a === b) return 100;
  
  // Same year
  if (dateA.getFullYear() === dateB.getFullYear()) {
    // Same month
    if (dateA.getMonth() === dateB.getMonth()) {
      // Within 7 days
      const dayDiff = Math.abs(dateA.getDate() - dateB.getDate());
      if (dayDiff <= 7) return 90;
      return 70;
    }
    return 50;
  }
  
  // Within 1 year
  const yearDiff = Math.abs(dateA.getFullYear() - dateB.getFullYear());
  if (yearDiff === 1) return 30;
  
  return 0;
}

/**
 * Calculate overall similarity score between two persons
 */
export function calculateSimilarity(person1: Person, person2: Person): DuplicateCandidate | null {
  const reasons: string[] = [];
  const fieldMatches: DuplicateCandidate['fieldMatches'] = [];
  
  // Name similarity (weight: 50%)
  const nameSim = stringSimilarity(person1.fullName, person2.fullName);
  fieldMatches.push({
    field: 'Nama',
    value1: person1.fullName,
    value2: person2.fullName,
    match: nameSim >= 70
  });
  
  if (nameSim >= 80) {
    reasons.push(`Nama sangat mirip (${nameSim}%)`);
  } else if (nameSim >= 60) {
    reasons.push(`Nama mirip (${nameSim}%)`);
  }
  
  // Birth date similarity (weight: 30%)
  const birthSim = dateSimilarity(person1.birthDate, person2.birthDate);
  fieldMatches.push({
    field: 'Tanggal Lahir',
    value1: person1.birthDate || null,
    value2: person2.birthDate || null,
    match: birthSim >= 70
  });
  
  if (birthSim >= 80) {
    reasons.push('Tanggal lahir sama/sangat dekat');
  } else if (birthSim >= 50) {
    reasons.push('Tahun lahir sama');
  }
  
  // Gender match (weight: 10%)
  const genderMatch = person1.gender === person2.gender;
  fieldMatches.push({
    field: 'Gender',
    value1: person1.gender,
    value2: person2.gender,
    match: genderMatch
  });
  
  // Death date similarity (weight: 10%)
  const deathSim = dateSimilarity(person1.deathDate, person2.deathDate);
  if (person1.deathDate || person2.deathDate) {
    fieldMatches.push({
      field: 'Tanggal Wafat',
      value1: person1.deathDate || null,
      value2: person2.deathDate || null,
      match: deathSim >= 70
    });
  }
  
  // Calculate weighted score
  let score = 0;
  score += nameSim * 0.5;
  score += birthSim * 0.3;
  score += (genderMatch ? 100 : 0) * 0.1;
  score += deathSim * 0.1;
  
  score = Math.round(score);
  
  // Only return if there's meaningful similarity (above 40%)
  if (score < 40 || nameSim < 50) {
    return null;
  }
  
  return {
    person1,
    person2,
    score,
    reasons,
    fieldMatches
  };
}

/**
 * Find all potential duplicates in a list of persons
 */
export function findAllDuplicates(persons: Person[]): DuplicateCandidate[] {
  const duplicates: DuplicateCandidate[] = [];
  const seen = new Set<string>();
  
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const pairKey = [persons[i].id, persons[j].id].sort().join('-');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      
      const candidate = calculateSimilarity(persons[i], persons[j]);
      if (candidate) {
        duplicates.push(candidate);
      }
    }
  }
  
  // Sort by score descending
  return duplicates.sort((a, b) => b.score - a.score);
}

/**
 * Merge two persons into one, keeping the best data from each
 */
export interface MergeDecision {
  fullName: 'person1' | 'person2';
  gender: 'person1' | 'person2';
  birthDate: 'person1' | 'person2' | 'none';
  deathDate: 'person1' | 'person2' | 'none';
  photoUrl: 'person1' | 'person2' | 'none';
  notes: 'merge' | 'person1' | 'person2';
  tags: 'merge';
  keepId: 'person1' | 'person2';
}

export function getDefaultMergeDecision(candidate: DuplicateCandidate): MergeDecision {
  const { person1, person2 } = candidate;
  
  return {
    // Prefer longer/more complete name
    fullName: person1.fullName.length >= person2.fullName.length ? 'person1' : 'person2',
    // Prefer known gender
    gender: person1.gender !== 'unknown' ? 'person1' : 'person2',
    // Prefer existing date
    birthDate: person1.birthDate ? 'person1' : person2.birthDate ? 'person2' : 'none',
    deathDate: person1.deathDate ? 'person1' : person2.deathDate ? 'person2' : 'none',
    // Prefer existing photo
    photoUrl: person1.photoUrl ? 'person1' : person2.photoUrl ? 'person2' : 'none',
    // Merge notes
    notes: 'merge',
    // Always merge tags
    tags: 'merge',
    // Keep the older record
    keepId: new Date(person1.createdAt) < new Date(person2.createdAt) ? 'person1' : 'person2'
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
  
  // Merge notes
  let notes = '';
  if (decision.notes === 'merge') {
    const n1 = person1.notes || '';
    const n2 = person2.notes || '';
    notes = [n1, n2].filter(Boolean).join('\n---\n');
  } else if (decision.notes === 'person1') {
    notes = person1.notes || '';
  } else {
    notes = person2.notes || '';
  }
  
  // Merge tags (always unique)
  const allTags = [...new Set([...person1.tags, ...person2.tags])];
  
  // Pick higher confidence score
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
      photoUrl: getValue(decision.photoUrl, person1.photoUrl, person2.photoUrl, null),
      notes: notes || null,
      tags: allTags,
      confidenceScore,
    },
    deleteId: deletePerson.id
  };
}
