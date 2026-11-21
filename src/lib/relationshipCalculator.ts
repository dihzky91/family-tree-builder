import type { Person, Relationship } from '@/types';

export interface RelationshipPath {
    person: Person;
    relType: 'self' | 'parent' | 'child' | 'spouse';
    /** Generation offset relative to source person (negative = older gen, positive = younger gen) */
    generationDelta: number;
}

export interface RelationshipResult {
    path: RelationshipPath[];
    /** Term describing target (B) from source (A)'s perspective */
    term: string;
    /** Term describing source (A) from target (B)'s perspective */
    reverseTerm: string;
    /** Index in `path` of the highest common ancestor when path goes up then down, otherwise null */
    commonAncestorIndex: number | null;
    /** Number of edges between A and B */
    stepsCount: number;
    /** Generation difference of B relative to A (negative = B is older, positive = B is younger) */
    generationDiff: number;
}

/**
 * Calculates the shortest relationship path between two people using BFS
 */
export function calculateRelationship(
    sourceId: string,
    targetId: string,
    persons: Person[],
    relationships: Relationship[]
): RelationshipResult | null {
    if (sourceId === targetId) return null;

    const personMap = new Map<string, Person>();
    persons.forEach((p) => personMap.set(p.id, p));

    const sourcePerson = personMap.get(sourceId);
    if (!sourcePerson || !personMap.has(targetId)) return null;

    // 1. Build Graph
    const adjacency = new Map<string, { id: string; type: 'parent' | 'child' | 'spouse' }[]>();

    const addEdge = (from: string, to: string, type: 'parent' | 'child' | 'spouse') => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from)!.push({ id: to, type });
    };

    relationships.forEach((rel) => {
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
    const queue: { id: string; path: RelationshipPath[] }[] = [
        {
            id: sourceId,
            path: [{ person: sourcePerson, relType: 'self', generationDelta: 0 }],
        },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.id === targetId) {
            const fullPath = current.path;
            const reversePath = buildReversePath(fullPath);
            const commonAncestorIndex = findCommonAncestorIndex(fullPath);
            const generationDiff = fullPath[fullPath.length - 1].generationDelta;

            return {
                path: fullPath,
                term: determineRelationshipTerm(fullPath),
                reverseTerm: determineRelationshipTerm(reversePath),
                commonAncestorIndex,
                stepsCount: fullPath.length - 1,
                generationDiff,
            };
        }

        const neighbors = adjacency.get(current.id) || [];
        const currentGen = current.path[current.path.length - 1].generationDelta;

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.id)) {
                visited.add(neighbor.id);
                const person = personMap.get(neighbor.id);
                if (person) {
                    const delta =
                        neighbor.type === 'parent'
                            ? -1
                            : neighbor.type === 'child'
                                ? 1
                                : 0;
                    queue.push({
                        id: neighbor.id,
                        path: [
                            ...current.path,
                            {
                                person,
                                relType: neighbor.type,
                                generationDelta: currentGen + delta,
                            },
                        ],
                    });
                }
            }
        }
    }

    return null; // No path found
}

function buildReversePath(path: RelationshipPath[]): RelationshipPath[] {
    if (path.length === 0) return [];
    const reversed: RelationshipPath[] = [];
    let genDelta = 0;

    for (let i = path.length - 1; i >= 0; i--) {
        if (i === path.length - 1) {
            reversed.push({
                person: path[i].person,
                relType: 'self',
                generationDelta: 0,
            });
        } else {
            const forwardType = path[i + 1].relType;
            const invertedType: 'parent' | 'child' | 'spouse' =
                forwardType === 'parent'
                    ? 'child'
                    : forwardType === 'child'
                        ? 'parent'
                        : 'spouse';
            genDelta += invertedType === 'parent' ? -1 : invertedType === 'child' ? 1 : 0;
            reversed.push({
                person: path[i].person,
                relType: invertedType,
                generationDelta: genDelta,
            });
        }
    }

    return reversed;
}

/**
 * Finds the peak common ancestor index in a path that goes up ('parent') and then down ('child')
 */
function findCommonAncestorIndex(path: RelationshipPath[]): number | null {
    if (path.length < 3) return null;

    let minGen = 0;
    let peakIdx = -1;
    let hasUp = false;
    let hasDown = false;

    for (let i = 1; i < path.length; i++) {
        if (path[i].relType === 'parent') hasUp = true;
        if (path[i].relType === 'child') hasDown = true;
        if (path[i].generationDelta < minGen) {
            minGen = path[i].generationDelta;
            peakIdx = i;
        }
    }

    if (hasUp && hasDown && peakIdx > 0 && peakIdx < path.length - 1) {
        return peakIdx;
    }

    return null;
}

/**
 * Interprets the path to generate a human-readable Indonesian kinship term
 */
function determineRelationshipTerm(path: RelationshipPath[]): string {
    const steps = path.slice(1);
    if (steps.length === 0) return 'Diri Sendiri';

    const types = steps.map((s) => s.relType);
    const key = types.join('>');
    const targetGender = steps[steps.length - 1].person.gender;

    const gendered = (male: string, female: string, neutral: string) =>
        targetGender === 'male' ? male : targetGender === 'female' ? female : neutral;

    // 1. Direct Relationships (1 step)
    if (key === 'spouse') return gendered('Suami', 'Istri', 'Pasangan');
    if (key === 'parent') return gendered('Ayah', 'Ibu', 'Orang Tua');
    if (key === 'child') return gendered('Anak Laki-laki', 'Anak Perempuan', 'Anak');

    // 2. Direct Ancestors (all 'parent')
    if (types.every((t) => t === 'parent')) {
        if (types.length === 2) return gendered('Kakek', 'Nenek', 'Eyang');
        if (types.length === 3) return gendered('Kakek Buyut', 'Nenek Buyut', 'Buyut');
        if (types.length === 4) return 'Canggah';
        if (types.length === 5) return 'Wareng';
        return `Leluhur (${types.length} generasi)`;
    }

    // 3. Direct Descendants (all 'child')
    if (types.every((t) => t === 'child')) {
        if (types.length === 2) return 'Cucu';
        if (types.length === 3) return 'Cicit';
        if (types.length === 4) return 'Piut';
        return `Keturunan (${types.length} generasi)`;
    }

    // 4. Pure Bloodline Collateral (only 'parent' followed by 'child')
    const firstChildIdx = types.indexOf('child');
    const isPureBloodCollateral =
        !types.includes('spouse') &&
        firstChildIdx > 0 &&
        types.slice(0, firstChildIdx).every((t) => t === 'parent') &&
        types.slice(firstChildIdx).every((t) => t === 'child');

    if (isPureBloodCollateral) {
        const up = firstChildIdx;
        const down = types.length - firstChildIdx;

        // Siblings
        if (up === 1 && down === 1) {
            return gendered('Saudara Laki-laki', 'Saudara Perempuan', 'Saudara Kandung');
        }
        // Uncles / Aunts & Great-Uncles / Great-Aunts
        if (down === 1) {
            if (up === 2) return gendered('Paman / Om', 'Bibi / Tante', 'Paman/Bibi');
            if (up === 3) return gendered('Paman Buyut', 'Bibi Buyut', 'Paman/Bibi Buyut');
            if (up === 4) return gendered('Paman Canggah', 'Bibi Canggah', 'Paman/Bibi Canggah');
            return `Paman/Bibi (${up - 1} gen di atas)`;
        }
        // Nephews / Nieces & Grand-Nephews / Nieces
        if (up === 1) {
            if (down === 2) return 'Keponakan';
            if (down === 3) return 'Cucu Keponakan';
            if (down === 4) return 'Cicit Keponakan';
            return `Keturunan Saudara (${down - 1} gen)`;
        }
        // Cousins (same generation)
        if (up === down) {
            if (up === 2) return 'Sepupu';
            if (up === 3) return 'Sepupu Kedua';
            if (up === 4) return 'Sepupu Ketiga';
            return `Sepupu ke-${up - 1}`;
        }
        // Cousins removed (different generation)
        if (up === 2 && down === 3) return 'Anak Sepupu';
        if (up === 3 && down === 2) return gendered('Paman Sepupu', 'Bibi Sepupu', 'Sepupu Orang Tua');
        if (up === 2 && down === 4) return 'Cucu Sepupu';
        if (up === 4 && down === 2) return gendered('Kakek Sepupu', 'Nenek Sepupu', 'Sepupu Kakek/Nenek');

        const degree = Math.min(up, down) - 1;
        const removed = Math.abs(up - down);
        return `Sepupu ke-${degree} (${removed} gen ${up > down ? 'di atas' : 'di bawah'})`;
    }

    // 5. Marriage, In-laws & Step-family
    switch (key) {
        // Mertua
        case 'spouse>parent':
            return gendered('Ayah Mertua', 'Ibu Mertua', 'Mertua');
        case 'spouse>parent>parent':
            return gendered('Kakek Mertua', 'Nenek Mertua', 'Eyang Mertua');
        case 'spouse>parent>parent>parent':
            return 'Buyut Mertua';

        // Menantu
        case 'child>spouse':
            return gendered('Menantu Laki-laki', 'Menantu Perempuan', 'Menantu');
        case 'child>child>spouse':
            return 'Cucu Menantu';
        case 'child>child>child>spouse':
            return 'Cicit Menantu';

        // Step-family
        case 'parent>spouse':
            return gendered('Ayah Sambung (Tiri)', 'Ibu Sambung (Tiri)', 'Orang Tua Sambung');
        case 'spouse>child':
            return gendered('Anak Tiri Laki-laki', 'Anak Tiri Perempuan', 'Anak Tiri');

        // Ipar & Biras
        case 'spouse>parent>child':
        case 'parent>child>spouse':
            return gendered('Kakak/Adik Ipar Laki-laki', 'Kakak/Adik Ipar Perempuan', 'Ipar');
        case 'spouse>parent>child>spouse':
            return 'Biras (Pasangan Ipar)';

        // Besan
        case 'child>spouse>parent':
            return 'Besan';

        // Extended In-laws
        case 'parent>parent>child>spouse':
            return gendered('Paman / Om (Ipar)', 'Bibi / Tante (Ipar)', 'Pasangan Paman/Bibi');
        case 'spouse>parent>parent>child':
            return gendered('Paman / Om Pasangan', 'Bibi / Tante Pasangan', 'Paman/Bibi Pasangan');
        case 'parent>child>child>spouse':
            return 'Pasangan Keponakan';
        case 'spouse>parent>child>child':
            return 'Keponakan Pasangan (Ipar)';
        case 'parent>parent>child>child>spouse':
            return 'Pasangan Sepupu';
        case 'spouse>parent>parent>child>child':
            return 'Sepupu Pasangan';
    }

    // 6. Fallback
    if (types.includes('spouse')) {
        return `Kerabat via Pernikahan (${steps.length} langkah)`;
    }

    return `Kerabat Jauh (${steps.length} langkah)`;
}
