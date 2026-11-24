import type { Person, Relationship, FilterConfig, GenerationLevel } from '@/types';
import { getEstimatedYear } from '@/lib/flexibleDateUtils';

/**
 * Calculate the generation level of a person based on parent-child relationships
 * Generation 0 is the "root" generation (persons with no parents in the tree)
 * Positive numbers are descendants, negative numbers are ancestors
 */
export function calculateGeneration(
    person: Person,
    allPersons: Person[],
    relationships: Relationship[],
    visited = new Set<string>()
): GenerationLevel {
    // Prevent infinite loops
    if (visited.has(person.id)) return 0;
    visited.add(person.id);

    // Find parent relationships
    const parentRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === person.id
    );

    // If no parents found, this is a root person (generation 0)
    if (parentRels.length === 0) return 0;

    // Find the deepest parent generation
    let maxParentGen = -1;
    for (const rel of parentRels) {
        const parent = allPersons.find(p => p.id === rel.fromPersonId);
        if (parent) {
            const parentGen = calculateGeneration(parent, allPersons, relationships, visited);
            maxParentGen = Math.max(maxParentGen, parentGen);
        }
    }

    // This person is one generation below their deepest parent
    const generation = (maxParentGen + 1) as GenerationLevel;
    return Math.min(3, Math.max(-3, generation)) as GenerationLevel;
}

/**
 * Filter persons by generation levels
 */
export function filterByGeneration(
    persons: Person[],
    selectedGenerations: number[],
    relationships: Relationship[]
): Person[] {
    if (selectedGenerations.length === 0) return persons;

    return persons.filter(person => {
        const gen = calculateGeneration(person, persons, relationships);
        return selectedGenerations.includes(gen);
    });
}

/**
 * Filter persons by verification status (based on tags)
 */
export function filterByVerification(
    persons: Person[],
    verificationStatuses: string[]
): Person[] {
    if (verificationStatuses.length === 0) return persons;

    return persons.filter(person =>
        person.tags.some(tag => verificationStatuses.includes(tag))
    );
}

/**
 * Filter persons by birth year range
 */
export function filterByAgeRange(
    persons: Person[],
    minYear: number | null,
    maxYear: number | null
): Person[] {
    if (minYear === null && maxYear === null) return persons;

    return persons.filter(person => {
        if (!person.birthDate) return false;

        const birthYear = getEstimatedYear(person.birthDate);
        if (birthYear === null) return false;

        if (minYear !== null && birthYear < minYear) return false;
        if (maxYear !== null && birthYear > maxYear) return false;

        return true;
    });
}

/**
 * Calculate data completeness level of a person
 */
export function getCompletenessLevel(person: Person, relationships: Relationship[]): 'complete' | 'partial' | 'minimal' {
    const hasBasicInfo = !!(person.fullName && person.gender);
    const hasBirthDate = !!person.birthDate;
    const hasBirthPlace = !!person.birthPlace;
    const hasPhoto = !!person.photoUrl;
    const hasRelationships = relationships.some(
        r => r.fromPersonId === person.id || r.toPersonId === person.id
    );

    // Complete: has all basic info + birth date + at least one relationship
    if (hasBasicInfo && hasBirthDate && hasRelationships) {
        return 'complete';
    }

    // Partial: has basic info and some additional data
    if (hasBasicInfo && (hasBirthDate || hasBirthPlace || hasPhoto || hasRelationships)) {
        return 'partial';
    }

    // Minimal: only has name/gender
    return 'minimal';
}

/**
 * Filter persons by data completeness
 */
export function filterByCompleteness(
    persons: Person[],
    completenessLevel: FilterConfig['completeness'],
    relationships: Relationship[]
): Person[] {
    if (completenessLevel === 'all') return persons;

    return persons.filter(person => {
        const level = getCompletenessLevel(person, relationships);
        return level === completenessLevel;
    });
}

/**
 * Apply all filters to a list of persons
 */
export function applyAllFilters(
    persons: Person[],
    filterConfig: FilterConfig,
    relationships: Relationship[]
): Person[] {
    let filtered = persons;

    // Apply generation filter
    if (filterConfig.generations.length > 0) {
        filtered = filterByGeneration(filtered, filterConfig.generations, relationships);
    }

    // Apply verification status filter
    if (filterConfig.verificationStatuses.length > 0) {
        filtered = filterByVerification(filtered, filterConfig.verificationStatuses);
    }

    // Apply age range filter
    if (filterConfig.ageRange) {
        filtered = filterByAgeRange(filtered, filterConfig.ageRange.min, filterConfig.ageRange.max);
    }

    // Apply completeness filter
    filtered = filterByCompleteness(filtered, filterConfig.completeness, relationships);

    return filtered;
}

/**
 * Get unique generation levels present in the dataset
 */
export function getAvailableGenerations(
    persons: Person[],
    relationships: Relationship[]
): number[] {
    const generations = new Set<number>();

    persons.forEach(person => {
        const gen = calculateGeneration(person, persons, relationships);
        generations.add(gen);
    });

    return Array.from(generations).sort((a, b) => a - b);
}

/**
 * Get generation label for display
 */
export function getGenerationLabel(generation: number): string {
    const labels: Record<number, string> = {
        '-3': 'Buyut ↑↑↑',
        '-2': 'Kakek/Nenek ↑↑',
        '-1': 'Orang Tua ↑',
        '0': 'Generasi Awal',
        '1': 'Anak ↓',
        '2': 'Cucu ↓↓',
        '3': 'Cicit ↓↓↓',
    };

    return labels[generation] || `Generasi ${generation}`;
}
