import type { Person, Relationship } from '@/types';

export interface FamilyChartDatum {
    id: string;
    data: {
        gender: 'M' | 'F';
        'first name': string;
        'last name': string;
        birthday?: string;   // yyyy-mm-dd
        deathday?: string;   // yyyy-mm-dd (optional)
        birthYear?: string;
        deathYear?: string;
        avatar?: string;
        label?: string;
    };
    rels: {
        parents: string[];
        spouses: string[];
        children: string[];
    };
}

export function transformToFamilyChartData(
    persons: Person[],
    relationships: Relationship[]
): FamilyChartDatum[] {
    return persons.map(person => {
        // ===== Relasi =====
        const parentRels = relationships.filter(
            r => r.type === 'PARENT_CHILD' && r.toPersonId === person.id
        );

        const childRels = relationships.filter(
            r => r.type === 'PARENT_CHILD' && r.fromPersonId === person.id
        );

        const spouseRels = relationships.filter(
            r =>
                r.type === 'SPOUSE' &&
                (r.fromPersonId === person.id || r.toPersonId === person.id)
        );

        // ===== Nama =====
        const parts = person.fullName.trim().split(/\s+/);
        const firstName = parts[0] || '?';
        const lastName = parts.slice(1).join(' ') || '';

        const birthYear = person.birthDate ? person.birthDate.slice(0, 4) : undefined;
        const deathYear = person.deathDate ? person.deathDate.slice(0, 4) : undefined;

        return {
            id: person.id,
            data: {
                gender: person.gender === 'male' ? 'M' : 'F',
                'first name': firstName,
                'last name': lastName,

                // ⬇️ PENTING: gunakan undefined, bukan string kosong
                birthday: person.birthDate || undefined,
                deathday: person.deathDate || undefined,
                birthYear: birthYear ? `* ${birthYear}` : undefined,
                deathYear: deathYear ? `† ${deathYear}` : undefined,

                avatar: person.photoUrl || undefined,
                label: person.fullName,
            },
            rels: {
                parents: parentRels.map(r => r.fromPersonId),
                children: childRels.map(r => r.toPersonId),
                spouses: spouseRels.map(r =>
                    r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId
                ),
            },
        };
    });
}
