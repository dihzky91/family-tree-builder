import type { Person, Relationship } from '@/types';

interface RelationshipPath {
    person: Person;
    relType: 'self' | 'parent' | 'child' | 'spouse';
}

interface RelationshipResult {
    path: RelationshipPath[];
    term: string;
}

/**
 * Calculates the relationship between two people
 */
export function calculateRelationship(
    sourceId: string,
    targetId: string,
    persons: Person[],
    relationships: Relationship[]
): RelationshipResult | null {
    if (sourceId === targetId) return null;

    // 1. Build Graph
    const adjacency = new Map<string, { id: string; type: 'parent' | 'child' | 'spouse' }[]>();

    const addEdge = (from: string, to: string, type: 'parent' | 'child' | 'spouse') => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from)!.push({ id: to, type });
    };

    relationships.forEach(rel => {
        if (rel.type === 'PARENT_CHILD') {
            // Child -> Parent (type 'parent')
            addEdge(rel.toPersonId, rel.fromPersonId, 'parent');
            // Parent -> Child (type 'child')
            addEdge(rel.fromPersonId, rel.toPersonId, 'child');
        } else if (rel.type === 'SPOUSE') {
            addEdge(rel.fromPersonId, rel.toPersonId, 'spouse');
            addEdge(rel.toPersonId, rel.fromPersonId, 'spouse');
        }
    });

    // 2. BFS for Shortest Path
    const queue: { id: string; path: RelationshipPath[] }[] = [{
        id: sourceId,
        path: [{ person: persons.find(p => p.id === sourceId)!, relType: 'self' }]
    }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.id === targetId) {
            const fullPath = current.path;
            return {
                path: fullPath,
                term: determineRelationshipTerm(fullPath)
            };
        }

        const neighbors = adjacency.get(current.id) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.id)) {
                visited.add(neighbor.id);
                const person = persons.find(p => p.id === neighbor.id);
                if (person) {
                    queue.push({
                        id: neighbor.id,
                        path: [...current.path, { person, relType: neighbor.type }]
                    });
                }
            }
        }
    }

    return null; // No path found
}

/**
 * Interprets the path to generate a human-readable term
 */
function determineRelationshipTerm(path: RelationshipPath[]): string {
    // Remove 'self' from start
    const steps = path.slice(1);
    if (steps.length === 0) return 'Diri Sendiri';

    const types = steps.map(s => s.relType);
    const targetGender = steps[steps.length - 1].person.gender;

    // Direct Relationships
    if (types.length === 1) {
        if (types[0] === 'spouse') return types[0] === 'spouse' ? (targetGender === 'male' ? 'Suami' : 'Istri') : 'Pasangan';
        if (types[0] === 'parent') return targetGender === 'male' ? 'Ayah' : targetGender === 'female' ? 'Ibu' : 'Orang Tua';
        if (types[0] === 'child') return targetGender === 'male' ? 'Anak Laki-laki' : targetGender === 'female' ? 'Anak Perempuan' : 'Anak';
    }

    // Grandparents / Grandchildren
    if (types.every(t => t === 'parent')) {
        if (types.length === 2) return targetGender === 'male' ? 'Kakek' : targetGender === 'female' ? 'Nenek' : 'Eyang';
        if (types.length === 3) return 'Buyut';
        if (types.length === 4) return 'Canggah';
        return `Leluhur (${types.length} generasi)`;
    }
    if (types.every(t => t === 'child')) {
        if (types.length === 2) return 'Cucu';
        if (types.length === 3) return 'Cicit';
        return `Keturunan (${types.length} generasi)`;
    }

    // Siblings chain: Parent -> Child
    if (types.length === 2 && types[0] === 'parent' && types[1] === 'child') {
        return targetGender === 'male' ? 'Saudara Laki-laki' : targetGender === 'female' ? 'Saudara Perempuan' : 'Saudara Kandung';
    }

    // Uncle/Aunt: Parent -> Parent -> Child (Parent's Sibling)
    if (types.length === 3 && types[0] === 'parent' && types[1] === 'parent' && types[2] === 'child') {
        return targetGender === 'male' ? 'Paman / Om' : targetGender === 'female' ? 'Bibi / Tante' : 'Paman/Bibi';
    }

    // Nephew/Niece: Parent -> Child -> Child (Sibling's Child)
    if (types.length === 3 && types[0] === 'parent' && types[1] === 'child' && types[2] === 'child') {
        return 'Keponakan';
    }

    // Cousins: Parent -> Parent -> Child -> Child (1st Cousin)
    if (types.length === 4 && types[0] === 'parent' && types[1] === 'parent' && types[2] === 'child' && types[3] === 'child') {
        return 'Sepupu';
    }

    // In-laws & Step-family

    // Mertua: Spouse -> Parent
    if (types.length === 2 && types[0] === 'spouse' && types[1] === 'parent') {
        return targetGender === 'male' ? 'Ayah Mertua' : targetGender === 'female' ? 'Ibu Mertua' : 'Mertua';
    }

    // Menantu: Child -> Spouse
    if (types.length === 2 && types[0] === 'child' && types[1] === 'spouse') {
        return targetGender === 'male' ? 'Menantu Laki-laki' : targetGender === 'female' ? 'Menantu Perempuan' : 'Menantu';
    }

    // Orang Tua Tiri: Parent -> Spouse
    if (types.length === 2 && types[0] === 'parent' && types[1] === 'spouse') {
        return targetGender === 'male' ? 'Ayah Sambung (Tiri)' : targetGender === 'female' ? 'Ibu Sambung (Tiri)' : 'Orang Tua Sambung';
    }

    // Anak Tiri: Spouse -> Child
    if (types.length === 2 && types[0] === 'spouse' && types[1] === 'child') {
        return targetGender === 'male' ? 'Anak Tiri Laki-laki' : targetGender === 'female' ? 'Anak Tiri Perempuan' : 'Anak Tiri';
    }

    // Ipar (Sibling-in-law)
    // Case 1: Spouse -> Parent -> Child (Spouse's Sibling)
    if (types.length === 3 && types[0] === 'spouse' && types[1] === 'parent' && types[2] === 'child') {
        return targetGender === 'male' ? 'Kakak/Adik Ipar Laki-laki' : targetGender === 'female' ? 'Kakak/Adik Ipar Perempuan' : 'Ipar';
    }
    // Case 2: Parent -> Child -> Spouse (Sibling's Spouse)
    if (types.length === 3 && types[0] === 'parent' && types[1] === 'child' && types[2] === 'spouse') {
        return targetGender === 'male' ? 'Kakak/Adik Ipar Laki-laki' : targetGender === 'female' ? 'Kakak/Adik Ipar Perempuan' : 'Ipar';
    }

    // Besan: Child -> Spouse -> Parent
    if (types.length === 3 && types[0] === 'child' && types[1] === 'spouse' && types[2] === 'parent') {
        return 'Besan';
    }

    // Generic In-law fallback (if not caught above)
    if (types[types.length - 1] === 'spouse' || types[0] === 'spouse') {
        return 'Kerabat Jauh (Melalui Pernikahan)';
    }

    // Generic fallback based on up/down moves
    const up = types.filter(t => t === 'parent').length;
    const down = types.filter(t => t === 'child').length;

    if (up > 0 && down > 0) return 'Kerabat Jauh';

    return 'Kerabat';
}
