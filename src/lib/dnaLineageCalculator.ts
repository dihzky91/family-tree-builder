import type { Person, Relationship } from '@/types';

// 4 warna dasar untuk kakek/nenek
export const ANCESTOR_COLORS = {
    PATERNAL_GRANDFATHER: '#3B82F6', // Blue
    PATERNAL_GRANDMOTHER: '#8B5CF6', // Purple
    MATERNAL_GRANDFATHER: '#10B981', // Green
    MATERNAL_GRANDMOTHER: '#EC4899', // Pink
};

export type AncestorLineage = {
    paternalGrandfather: number;
    paternalGrandmother: number;
    maternalGrandfather: number;
    maternalGrandmother: number;
};

// Helper function untuk blend 2 warna (rata-rata RGB)
function blendColors(color1: string, color2: string, ratio: number = 0.5): string {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');

    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);

    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Blend multiple colors based on percentages
export function blendMultipleColors(lineage: AncestorLineage): string {
    const total = lineage.paternalGrandfather + lineage.paternalGrandmother +
        lineage.maternalGrandfather + lineage.maternalGrandmother;

    if (total === 0) return '#9CA3AF'; // Gray untuk unknown

    // Normalize percentages
    const weights = {
        pg: lineage.paternalGrandfather / total,
        pgm: lineage.paternalGrandmother / total,
        mg: lineage.maternalGrandfather / total,
        mgm: lineage.maternalGrandmother / total,
    };

    // Blend all colors weighted
    let r = 0, g = 0, b = 0;

    const colors = [
        { color: ANCESTOR_COLORS.PATERNAL_GRANDFATHER, weight: weights.pg },
        { color: ANCESTOR_COLORS.PATERNAL_GRANDMOTHER, weight: weights.pgm },
        { color: ANCESTOR_COLORS.MATERNAL_GRANDFATHER, weight: weights.mg },
        { color: ANCESTOR_COLORS.MATERNAL_GRANDMOTHER, weight: weights.mgm },
    ];

    colors.forEach(({ color, weight }) => {
        const hex = color.replace('#', '');
        r += parseInt(hex.substring(0, 2), 16) * weight;
        g += parseInt(hex.substring(2, 4), 16) * weight;
        b += parseInt(hex.substring(4, 6), 16) * weight;
    });

    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

// Calculate lineage untuk setiap person
export function calculatePersonLineage(
    personId: string,
    persons: Person[],
    relationships: Relationship[],
    cache: Map<string, AncestorLineage> = new Map()
): AncestorLineage {
    // Check cache
    if (cache.has(personId)) {
        return cache.get(personId)!;
    }

    const person = persons.find(p => p.id === personId);
    if (!person) {
        return { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
    }

    // Find parents
    const parentRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === personId);
    const parents = parentRels.map(r => persons.find(p => p.id === r.fromPersonId)).filter(Boolean) as Person[];

    if (parents.length === 0) {
        // This is a root ancestor - assign 100% to appropriate lineage based on gender and position
        // We'll handle this in the tree building logic
        return { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
    }

    // If we have parents, blend their lineages (50% from each)
    let father = parents.find(p => p.gender === 'male');
    let mother = parents.find(p => p.gender === 'female');

    // Fallback if gender not specified
    if (!father && !mother && parents.length >= 1) father = parents[0];
    if (!mother && parents.length >= 2) mother = parents[1];

    const fatherLineage = father ? calculatePersonLineage(father.id, persons, relationships, cache) : { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
    const motherLineage = mother ? calculatePersonLineage(mother.id, persons, relationships, cache) : { paternalGrandfather: 0, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };

    const result: AncestorLineage = {
        paternalGrandfather: (fatherLineage.paternalGrandfather * 0.5) + (motherLineage.paternalGrandfather * 0.5),
        paternalGrandmother: (fatherLineage.paternalGrandmother * 0.5) + (motherLineage.paternalGrandmother * 0.5),
        maternalGrandfather: (fatherLineage.maternalGrandfather * 0.5) + (motherLineage.maternalGrandfather * 0.5),
        maternalGrandmother: (fatherLineage.maternalGrandmother * 0.5) + (motherLineage.maternalGrandmother * 0.5),
    };

    cache.set(personId, result);
    return result;
}

// Build tree dari selected person ke ancestors
export function buildAncestryTree(
    personId: string,
    persons: Person[],
    relationships: Relationship[],
    maxDepth: number = 4
): { person: Person; lineage: AncestorLineage; depth: number }[] {
    const result: { person: Person; lineage: AncestorLineage; depth: number }[] = [];
    const visited = new Set<string>();
    const cache = new Map<string, AncestorLineage>();

    // Identify root ancestors (grandparents)
    function findRootAncestors(pid: string, depth: number): void {
        if (depth > maxDepth || visited.has(pid)) return;
        visited.add(pid);

        const person = persons.find(p => p.id === pid);
        if (!person) return;

        const parentRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === pid);
        const parents = parentRels.map(r => persons.find(p => p.id === r.fromPersonId)).filter(Boolean) as Person[];

        // Assign lineage based on depth and position
        let lineage: AncestorLineage;
        if (depth === 2 && parents.length === 0) {
            // This is a grandparent - assign 100% to appropriate quadrant
            // We'll determine which quadrant based on the path taken
            lineage = { paternalGrandfather: 1, paternalGrandmother: 0, maternalGrandfather: 0, maternalGrandmother: 0 };
        } else {
            lineage = calculatePersonLineage(person.id, persons, relationships, cache);
        }

        result.push({ person, lineage, depth });

        parents.forEach(parent => findRootAncestors(parent.id, depth + 1));
    }

    findRootAncestors(personId, 0);
    return result;
}
