import type { Person, Relationship } from '@/types';

interface SearchResult {
    person: Person;
    matchReason?: string;
    score: number;
}

/**
 * Parses a natural language query and filters the person list.
 * Supported patterns:
 * - "Anak dari [Nama]"
 * - "Pasangan dari [Nama]"
 * - "Lahir di [Tempat]"
 * - "Lahir tahun [Tahun]"
 * - "Laki-laki" / "Perempuan"
 */
export function smartSearch(
    query: string,
    persons: Person[],
    relationships: Relationship[]
): SearchResult[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    // 1. Direct Name Match (Standard Fuse.js style usually does this, but we implement basic here)
    const directMatches = persons
        .filter(p => p.fullName.toLowerCase().includes(lowerQuery))
        .map(p => ({ person: p, matchReason: 'Nama', score: 10 }));

    if (directMatches.length > 0 && directMatches.length < 5) return directMatches;

    const results: Map<string, SearchResult> = new Map();

    // Helper to add result
    const addResult = (p: Person, reason: string, score: number) => {
        if (results.has(p.id)) {
            const existing = results.get(p.id)!;
            if (score > existing.score) {
                results.set(p.id, { person: p, matchReason: reason, score });
            }
        } else {
            results.set(p.id, { person: p, matchReason: reason, score });
        }
    };

    // 2. Parse Logic

    // "Lahir di [Place]"
    if (lowerQuery.includes('lahir di')) {
        const place = lowerQuery.split('lahir di')[1].trim();
        if (place) {
            persons.filter(p => p.birthPlace?.toLowerCase().includes(place)).forEach(p => {
                addResult(p, `Lahir di ${p.birthPlace}`, 5);
            });
        }
    }

    // "Lahir tahun [Year]"
    if (lowerQuery.includes('lahir tahun') || lowerQuery.match(/lahir \d{4}/)) {
        const yearMatch = lowerQuery.match(/\d{4}/);
        if (yearMatch) {
            const year = yearMatch[0];
            persons.filter(p => p.birthDate?.startsWith(year) || p.birthDate?.includes(year)).forEach(p => {
                addResult(p, `Lahir tahun ${year}`, 5);
            });
        }
    }

    // "Anak dari [Parent Name]"
    if (lowerQuery.includes('anak dari') || lowerQuery.includes('anak ')) {
        const parentName = lowerQuery.replace('anak dari', '').replace('anak', '').trim();
        if (parentName.length > 2) { // avoid short noise
            const potentialParents = persons.filter(p => p.fullName.toLowerCase().includes(parentName));

            potentialParents.forEach(parent => {
                // Find children of this parent
                const childRels = relationships.filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent.id);
                childRels.forEach(rel => {
                    const child = persons.find(p => p.id === rel.toPersonId);
                    if (child) addResult(child, `Anak dari ${parent.fullName}`, 8);
                });
            });
        }
    }

    // "Pasangan dari [Name]" or "Istri/Suami dari [Name]"
    if (lowerQuery.includes('pasangan') || lowerQuery.includes('istri') || lowerQuery.includes('suami')) {
        const targetName = lowerQuery
            .replace('pasangan dari', '')
            .replace('pasangan', '')
            .replace('istri dari', '')
            .replace('istri', '')
            .replace('suami dari', '')
            .replace('suami', '')
            .trim();

        if (targetName.length > 2) {
            const targets = persons.filter(p => p.fullName.toLowerCase().includes(targetName));
            targets.forEach(target => {
                const spouseRels = relationships.filter(r => r.type === 'SPOUSE' && (r.fromPersonId === target.id || r.toPersonId === target.id));
                spouseRels.forEach(rel => {
                    const spouseId = rel.fromPersonId === target.id ? rel.toPersonId : rel.fromPersonId;
                    const spouse = persons.find(p => p.id === spouseId);
                    if (spouse) addResult(spouse, `Pasangan dari ${target.fullName}`, 8);
                });
            });
        }
    }

    // Gender Filter
    if (lowerQuery === 'laki-laki' || lowerQuery === 'pria') {
        persons.filter(p => p.gender === 'male').forEach(p => addResult(p, 'Laki-laki', 1));
    }
    if (lowerQuery === 'perempuan' || lowerQuery === 'wanita') {
        persons.filter(p => p.gender === 'female').forEach(p => addResult(p, 'Perempuan', 1));
    }

    // Search by Tags
    persons.filter(p => p.tags.some(t => t.toLowerCase().includes(lowerQuery))).forEach(p => {
        addResult(p, `Tag: ${lowerQuery}`, 6);
    });

    // Fallback to name search if complex logic yielded nothing, but simpler
    if (results.size === 0) {
        persons.filter(p => p.fullName.toLowerCase().includes(lowerQuery)).forEach(p => {
            addResult(p, 'Nama', 10);
        });
    }

    return Array.from(results.values()).sort((a, b) => b.score - a.score);
}
