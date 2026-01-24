import type { Person, Relationship, NuclearFamily } from '@/types';

/**
 * Calculate all nuclear families from persons and relationships
 * A nuclear family = couple (or single parent) + their children
 */
export function calculateNuclearFamilies(
    persons: Person[],
    relationships: Relationship[]
): NuclearFamily[] {
    const families: NuclearFamily[] = [];
    const processedCouples = new Set<string>();

    // Find all couples (SPOUSE relationships)
    const couples = relationships.filter(r => r.type === 'SPOUSE');

    couples.forEach(coupleRel => {
        const coupleKey = [coupleRel.fromPersonId, coupleRel.toPersonId].sort().join('-');

        if (processedCouples.has(coupleKey)) return;
        processedCouples.add(coupleKey);

        const parent1 = persons.find(p => p.id === coupleRel.fromPersonId);
        const parent2 = persons.find(p => p.id === coupleRel.toPersonId);

        if (!parent1 || !parent2) return;

        // Find children of this couple
        const children = getChildrenOfCouple(
            coupleRel.fromPersonId,
            coupleRel.toPersonId,
            persons,
            relationships
        );

        // Calculate generation (distance from oldest ancestor)
        const generation = Math.max(
            calculateGeneration(coupleRel.fromPersonId, relationships),
            calculateGeneration(coupleRel.toPersonId, relationships)
        );

        // Get earliest date (marriage or first child birth)
        const marriageDate = coupleRel.meta?.startDate
            ? new Date(coupleRel.meta.startDate)
            : null;
        const earliestChildBirth = children.length > 0 && children[0].birthDate
            ? new Date(children[0].birthDate)
            : null;
        const createdAt = marriageDate || earliestChildBirth || new Date();

        families.push({
            id: coupleKey,
            parents: [parent1, parent2],
            children,
            generation,
            createdAt,
            familyName: `Keluarga ${parent1.fullName} & ${parent2.fullName}`,
        });
    });

    // Find single parents (people with children but no spouse)
    const singleParents = findSingleParents(persons, relationships, processedCouples);

    singleParents.forEach(parentId => {
        const parent = persons.find(p => p.id === parentId);
        if (!parent) return;

        const children = relationships
            .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parentId)
            .map(r => persons.find(p => p.id === r.toPersonId))
            .filter((p): p is Person => p !== undefined);

        if (children.length === 0) return;

        const generation = calculateGeneration(parentId, relationships);
        const earliestChildBirth = children[0].birthDate
            ? new Date(children[0].birthDate)
            : new Date();

        families.push({
            id: `single-${parentId}`,
            parents: [parent],
            children,
            generation,
            createdAt: earliestChildBirth,
            familyName: `Keluarga ${parent.fullName}`,
        });
    });

    // Sort by generation (oldest/highest generation first)
    return families.sort((a, b) => b.generation - a.generation);
}

/**
 * Get children of a specific couple
 */
function getChildrenOfCouple(
    parent1Id: string,
    parent2Id: string,
    persons: Person[],
    relationships: Relationship[]
): Person[] {
    const childrenIds = new Set<string>();

    // Get children from parent1
    relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent1Id)
        .forEach(r => childrenIds.add(r.toPersonId));

    // Get children from parent2
    relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent2Id)
        .forEach(r => childrenIds.add(r.toPersonId));

    // Only keep children who have BOTH parents
    const validChildren: Person[] = [];
    childrenIds.forEach(childId => {
        const hasParent1 = relationships.some(
            r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent1Id && r.toPersonId === childId
        );
        const hasParent2 = relationships.some(
            r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent2Id && r.toPersonId === childId
        );

        if (hasParent1 && hasParent2) {
            const child = persons.find(p => p.id === childId);
            if (child) validChildren.push(child);
        }
    });

    // Sort by birth date
    return validChildren.sort((a, b) => {
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
    });
}

/**
 * Find people who have children but no spouse
 */
function findSingleParents(
    persons: Person[],
    relationships: Relationship[],
    processedCouples: Set<string>
): string[] {
    const singleParents: string[] = [];
    const hasSpouse = new Set<string>();

    // Mark everyone who has a spouse
    relationships
        .filter(r => r.type === 'SPOUSE')
        .forEach(r => {
            hasSpouse.add(r.fromPersonId);
            hasSpouse.add(r.toPersonId);
        });

    // Find people with children but no spouse
    const parentChildRels = relationships.filter(r => r.type === 'PARENT_CHILD');

    parentChildRels.forEach(rel => {
        const parentId = rel.fromPersonId;
        if (!hasSpouse.has(parentId) && !singleParents.includes(parentId)) {
            singleParents.push(parentId);
        }
    });

    return singleParents;
}

/**
 * Calculate generation number for a person
 * Generation = distance from oldest ancestor (higher number = older generation)
 * Root ancestor = highest generation
 */
export function calculateGeneration(
    personId: string,
    relationships: Relationship[]
): number {
    // Count how many generations UP from this person to the root
    let generation = 0;
    const visited = new Set<string>();
    let currentLevel = [personId];

    while (currentLevel.length > 0) {
        const nextLevel: string[] = [];

        for (const currentId of currentLevel) {
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // Find parents
            const parents = relationships
                .filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === currentId)
                .map(r => r.fromPersonId);

            nextLevel.push(...parents);
        }

        if (nextLevel.length > 0) {
            generation++;
            currentLevel = nextLevel;
        } else {
            break;
        }
    }

    return generation;
}

/**
 * Get which families a person belongs to
 * Returns: family where person is parent, and family where person is child
 */
export function getPersonFamilies(
    personId: string,
    families: NuclearFamily[]
): { asParent?: NuclearFamily; asChild?: NuclearFamily } {
    let asParent: NuclearFamily | undefined;
    let asChild: NuclearFamily | undefined;

    for (const family of families) {
        // Check if person is a parent in this family
        if (family.parents.some(p => p.id === personId)) {
            asParent = family;
        }

        // Check if person is a child in this family
        if (family.children.some(c => c.id === personId)) {
            asChild = family;
        }
    }

    return { asParent, asChild };
}
