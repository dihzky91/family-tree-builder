import { Person, Relationship } from '@/types';

// Helper to parse name parts
export function parseNameParts(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ');
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || parts[0] || ''
  };
}

// Calculate age from birth date
export function calculateAge(birthDate: string | null | undefined, deathDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  let age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Get zodiac sign from birth date
export function getZodiacSign(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

// Get month name
export function getMonthName(monthIndex: number): string {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return months[monthIndex] || '';
}

// Get decade from year
export function getDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}an`;
}

// Overview statistics
export function calculateOverviewStats(persons: Person[], relationships: Relationship[]) {
  const genderStats = {
    male: persons.filter(p => p.gender === 'male').length,
    female: persons.filter(p => p.gender === 'female').length,
    unknown: persons.filter(p => p.gender === 'unknown').length,
  };

  const livingStats = {
    living: persons.filter(p => !p.deathDate).length,
    deceased: persons.filter(p => !!p.deathDate).length,
  };

  // Count married people
  const marriedPersonIds = new Set<string>();
  const divorcedPersonIds = new Set<string>();
  relationships.filter(r => r.type === 'SPOUSE').forEach(r => {
    // Default to 'married' if status is not set (undefined, null, or empty)
    const status = r.meta?.status || 'married';

    if (status === 'divorced') {
      divorcedPersonIds.add(r.fromPersonId);
      divorcedPersonIds.add(r.toPersonId);
    } else {
      // married, partner, unknown, or undefined all considered as married
      marriedPersonIds.add(r.fromPersonId);
      marriedPersonIds.add(r.toPersonId);
    }
  });

  // Find widowed (spouse deceased)
  const widowedPersonIds = new Set<string>();
  relationships.filter(r => r.type === 'SPOUSE' && (r.meta?.status || 'married') !== 'divorced').forEach(r => {
    const person1 = persons.find(p => p.id === r.fromPersonId);
    const person2 = persons.find(p => p.id === r.toPersonId);
    if (person1 && person2) {
      if (person2.deathDate && !person1.deathDate) widowedPersonIds.add(r.fromPersonId);
      if (person1.deathDate && !person2.deathDate) widowedPersonIds.add(r.toPersonId);
    }
  });

  const relationshipStatus = {
    married: marriedPersonIds.size - widowedPersonIds.size,
    divorced: divorcedPersonIds.size,
    widowed: widowedPersonIds.size,
    single: persons.length - marriedPersonIds.size - divorcedPersonIds.size,
  };

  // Common names
  const firstNamesMale: Record<string, number> = {};
  const firstNamesFemale: Record<string, number> = {};
  const lastNames: Record<string, number> = {};

  persons.forEach(p => {
    const { firstName, lastName } = parseNameParts(p.fullName);
    if (firstName) {
      if (p.gender === 'male') {
        firstNamesMale[firstName] = (firstNamesMale[firstName] || 0) + 1;
      } else if (p.gender === 'female') {
        firstNamesFemale[firstName] = (firstNamesFemale[firstName] || 0) + 1;
      }
    }
    if (lastName && lastName !== firstName) {
      lastNames[lastName] = (lastNames[lastName] || 0) + 1;
    }
  });

  return {
    total: persons.length,
    genderStats,
    livingStats,
    relationshipStatus,
    commonFirstNamesMale: Object.entries(firstNamesMale)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    commonFirstNamesFemale: Object.entries(firstNamesFemale)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    commonLastNames: Object.entries(lastNames)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  };
}

// Age statistics
export function calculateAgeStats(persons: Person[]) {
  const living = persons.filter(p => !p.deathDate);
  const deceased = persons.filter(p => !!p.deathDate);

  const ageDistribution: Record<string, number> = {
    '0-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0,
    '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90+': 0
  };

  living.forEach(p => {
    const age = calculateAge(p.birthDate);
    if (age !== null) {
      if (age >= 90) ageDistribution['90+']++;
      else if (age >= 80) ageDistribution['80-89']++;
      else if (age >= 70) ageDistribution['70-79']++;
      else if (age >= 60) ageDistribution['60-69']++;
      else if (age >= 50) ageDistribution['50-59']++;
      else if (age >= 40) ageDistribution['40-49']++;
      else if (age >= 30) ageDistribution['30-39']++;
      else if (age >= 20) ageDistribution['20-29']++;
      else if (age >= 10) ageDistribution['10-19']++;
      else ageDistribution['0-9']++;
    }
  });

  // Oldest living
  const oldestLiving = living
    .filter(p => p.birthDate)
    .map(p => ({ ...p, age: calculateAge(p.birthDate) }))
    .filter(p => p.age !== null)
    .sort((a, b) => (b.age || 0) - (a.age || 0))
    .slice(0, 5);

  // Youngest living
  const youngestLiving = living
    .filter(p => p.birthDate)
    .map(p => ({ ...p, age: calculateAge(p.birthDate) }))
    .filter(p => p.age !== null)
    .sort((a, b) => (a.age || 0) - (b.age || 0))
    .slice(0, 5);

  // Lived the most (deceased)
  const livedMost = deceased
    .filter(p => p.birthDate && p.deathDate)
    .map(p => ({ ...p, age: calculateAge(p.birthDate, p.deathDate) }))
    .filter(p => p.age !== null)
    .sort((a, b) => (b.age || 0) - (a.age || 0))
    .slice(0, 5);

  // Lived the least (deceased)
  const livedLeast = deceased
    .filter(p => p.birthDate && p.deathDate)
    .map(p => ({ ...p, age: calculateAge(p.birthDate, p.deathDate) }))
    .filter(p => p.age !== null)
    .sort((a, b) => (a.age || 0) - (b.age || 0))
    .slice(0, 5);

  // Average life expectancy
  const maleAges = deceased
    .filter(p => p.gender === 'male' && p.birthDate && p.deathDate)
    .map(p => calculateAge(p.birthDate, p.deathDate))
    .filter((age): age is number => age !== null);

  const femaleAges = deceased
    .filter(p => p.gender === 'female' && p.birthDate && p.deathDate)
    .map(p => calculateAge(p.birthDate, p.deathDate))
    .filter((age): age is number => age !== null);

  const avgMaleLife = maleAges.length ? Math.round(maleAges.reduce((a, b) => a + b, 0) / maleAges.length) : null;
  const avgFemaleLife = femaleAges.length ? Math.round(femaleAges.reduce((a, b) => a + b, 0) / femaleAges.length) : null;

  return {
    ageDistribution,
    oldestLiving,
    youngestLiving,
    livedMost,
    livedLeast,
    avgMaleLife,
    avgFemaleLife,
  };
}

// Birth statistics
export function calculateBirthStats(persons: Person[]) {
  const monthDistribution: Record<number, number> = {};
  const zodiacDistribution: Record<string, number> = {};
  const decadeDistribution: Record<string, number> = {};

  for (let i = 0; i < 12; i++) {
    monthDistribution[i] = 0;
  }

  persons.forEach(p => {
    if (p.birthDate) {
      const date = new Date(p.birthDate);
      monthDistribution[date.getMonth()]++;

      const zodiac = getZodiacSign(p.birthDate);
      if (zodiac) {
        zodiacDistribution[zodiac] = (zodiacDistribution[zodiac] || 0) + 1;
      }

      const decade = getDecade(date.getFullYear());
      decadeDistribution[decade] = (decadeDistribution[decade] || 0) + 1;
    }
  });

  return {
    monthDistribution: Object.entries(monthDistribution)
      .map(([month, count]) => ({ month: getMonthName(parseInt(month)), count })),
    zodiacDistribution: Object.entries(zodiacDistribution)
      .map(([sign, count]) => ({ sign, count }))
      .sort((a, b) => b.count - a.count),
    decadeDistribution: Object.entries(decadeDistribution)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade)),
  };
}

// Place statistics
export function calculatePlaceStats(persons: Person[]) {
  const birthPlaces: Record<string, number> = {};
  const deathPlaces: Record<string, number> = {};
  const residences: Record<string, number> = {};

  persons.forEach(p => {
    if (p.birthPlace) {
      birthPlaces[p.birthPlace] = (birthPlaces[p.birthPlace] || 0) + 1;
    }
    if (p.deathPlace) {
      deathPlaces[p.deathPlace] = (deathPlaces[p.deathPlace] || 0) + 1;
    }
    if (p.residence) {
      residences[p.residence] = (residences[p.residence] || 0) + 1;
    }
  });

  return {
    birthPlaces: Object.entries(birthPlaces)
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    deathPlaces: Object.entries(deathPlaces)
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    residences: Object.entries(residences)
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    totalBirthPlaces: Object.keys(birthPlaces).length,
    totalDeathPlaces: Object.keys(deathPlaces).length,
    totalResidences: Object.keys(residences).length,
  };
}

// Marriage statistics
export function calculateMarriageStats(persons: Person[], relationships: Relationship[]) {
  const marriages = relationships.filter(r => r.type === 'SPOUSE' && r.meta?.status !== 'partner');

  const marriagesByDecade: Record<string, number> = {};
  const marriageDurations: { persons: Person[]; duration: number; startDate: string }[] = [];

  marriages.forEach(r => {
    if (r.meta?.startDate) {
      const date = new Date(r.meta.startDate);
      const decade = getDecade(date.getFullYear());
      marriagesByDecade[decade] = (marriagesByDecade[decade] || 0) + 1;

      // Calculate duration
      const endDate = r.meta?.endDate ? new Date(r.meta.endDate) : new Date();
      const duration = Math.floor((endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365));

      const person1 = persons.find(p => p.id === r.fromPersonId);
      const person2 = persons.find(p => p.id === r.toPersonId);
      if (person1 && person2) {
        marriageDurations.push({
          persons: [person1, person2],
          duration,
          startDate: r.meta.startDate
        });
      }
    }
  });

  const longestMarriages = marriageDurations
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  const avgDuration = marriageDurations.length
    ? Math.round(marriageDurations.reduce((a, b) => a + b.duration, 0) / marriageDurations.length)
    : 0;

  return {
    totalMarriages: marriages.length,
    avgDuration,
    longestMarriages,
    marriagesByDecade: Object.entries(marriagesByDecade)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade)),
  };
}

// Children statistics
export function calculateChildrenStats(persons: Person[], relationships: Relationship[]) {
  const parentChildRels = relationships.filter(r => r.type === 'PARENT_CHILD');

  // Group children by parent pairs
  const familyChildren: Record<string, Set<string>> = {};

  parentChildRels.forEach(r => {
    // Find all parents of this child
    const childId = r.toPersonId;
    const parentId = r.fromPersonId;

    // Get all other parents of the same child
    const otherParents = parentChildRels
      .filter(rel => rel.toPersonId === childId && rel.fromPersonId !== parentId)
      .map(rel => rel.fromPersonId);

    if (otherParents.length > 0) {
      // Create a family key (sorted parent IDs)
      const familyKey = [parentId, ...otherParents].sort().join('-');
      if (!familyChildren[familyKey]) {
        familyChildren[familyKey] = new Set();
      }
      familyChildren[familyKey].add(childId);
    } else {
      // Single parent
      if (!familyChildren[parentId]) {
        familyChildren[parentId] = new Set();
      }
      familyChildren[parentId].add(childId);
    }
  });

  const childrenCounts = Object.values(familyChildren).map(children => children.size);
  const distribution: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };

  childrenCounts.forEach(count => {
    if (count >= 5) distribution['5+']++;
    else distribution[count.toString()]++;
  });

  const totalChildren = parentChildRels.length;
  const avgChildren = childrenCounts.length
    ? (childrenCounts.reduce((a, b) => a + b, 0) / childrenCounts.length).toFixed(1)
    : '0';

  // Families with most children
  const topFamilies = Object.entries(familyChildren)
    .map(([key, children]) => ({
      parentIds: key.split('-'),
      parents: key.split('-').map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[],
      childCount: children.size,
    }))
    .sort((a, b) => b.childCount - a.childCount)
    .slice(0, 5);

  return {
    totalChildren,
    avgChildren,
    distribution: Object.entries(distribution).map(([count, families]) => ({ count, families })),
    topFamilies,
  };
}

// Divorce statistics
export function calculateDivorceStats(persons: Person[], relationships: Relationship[]) {
  const divorces = relationships.filter(r => r.type === 'SPOUSE' && r.meta?.status === 'divorced');
  const marriages = relationships.filter(r => r.type === 'SPOUSE');

  const divorcesByDecade: Record<string, number> = {};
  const durationBeforeDivorce: number[] = [];

  divorces.forEach(r => {
    if (r.meta?.endDate) {
      const date = new Date(r.meta.endDate);
      const decade = getDecade(date.getFullYear());
      divorcesByDecade[decade] = (divorcesByDecade[decade] || 0) + 1;

      if (r.meta?.startDate) {
        const startDate = new Date(r.meta.startDate);
        const duration = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
        durationBeforeDivorce.push(duration);
      }
    }
  });

  const avgDurationBeforeDivorce = durationBeforeDivorce.length
    ? Math.round(durationBeforeDivorce.reduce((a, b) => a + b, 0) / durationBeforeDivorce.length)
    : 0;

  const divorceRate = marriages.length
    ? ((divorces.length / marriages.length) * 100).toFixed(1)
    : '0';

  return {
    totalDivorces: divorces.length,
    divorceRate,
    avgDurationBeforeDivorce,
    divorcesByDecade: Object.entries(divorcesByDecade)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade)),
  };
}

// Relationship steps calculation (BFS)
export function calculateRelationshipSteps(
  persons: Person[],
  relationships: Relationship[],
  focusPersonId: string
): Map<string, number> {
  const steps = new Map<string, number>();
  if (!focusPersonId) return steps;

  steps.set(focusPersonId, 0);
  const queue = [focusPersonId];
  const visited = new Set<string>([focusPersonId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentSteps = steps.get(currentId)!;

    // Find all directly connected persons
    relationships.forEach(r => {
      let connectedId: string | null = null;
      if (r.fromPersonId === currentId) connectedId = r.toPersonId;
      if (r.toPersonId === currentId) connectedId = r.fromPersonId;

      if (connectedId && !visited.has(connectedId)) {
        visited.add(connectedId);
        steps.set(connectedId, currentSteps + 1);
        queue.push(connectedId);
      }
    });
  }

  return steps;
}
