import type { Person, Relationship } from '@/types';

export interface DataIssue {
    id: string;
    personId: string;
    type: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    relatedPersonId?: string;
}

export function checkDataQuality(persons: Person[], relationships: Relationship[]): DataIssue[] {
    const issues: DataIssue[] = [];
    const personMap = new Map(persons.map(p => [p.id, p]));

    // Helper to parse date
    const getDate = (dateStr?: string | null) => dateStr ? new Date(dateStr) : null;

    // 1. Check Individual Person Data
    persons.forEach(person => {
        // Missing Birth Date
        if (!person.birthDate) {
            issues.push({
                id: `missing-birth-${person.id}`,
                personId: person.id,
                type: 'warning',
                title: 'Tanggal Lahir Kosong',
                description: 'Tanggal lahir belum diisi. Informasi ini penting untuk silsilah.'
            });
        }

        // Missing Gender
        if (person.gender === 'unknown') {
            issues.push({
                id: `missing-gender-${person.id}`,
                personId: person.id,
                type: 'info',
                title: 'Gender Belum Diketahui',
                description: 'Jenis kelamin belum ditentukan.'
            });
        }

        // Likely Deceased but marked living (Very old)
        if (person.birthDate && !person.deathDate) {
            const birth = getDate(person.birthDate)!;
            const age = new Date().getFullYear() - birth.getFullYear();
            if (age > 110) {
                issues.push({
                    id: `likely-deceased-${person.id}`,
                    personId: person.id,
                    type: 'warning',
                    title: 'Kemungkinan Sudah Wafat',
                    description: `Umur tercatat ${age} tahun. Mohon verifikasi apakah anggota ini masih hidup.`
                });
            }
        }

        // Death before Birth
        if (person.birthDate && person.deathDate) {
            const birth = getDate(person.birthDate)!;
            const death = getDate(person.deathDate)!;
            if (death < birth) {
                issues.push({
                    id: `death-before-birth-${person.id}`,
                    personId: person.id,
                    type: 'error',
                    title: 'Tanggal Wafat Tidak Valid',
                    description: 'Tanggal wafat tercatat sebelum tanggal lahir.'
                });
            }
        }
    });

    // 2. Check Relationships
    relationships.forEach(rel => {
        if (rel.type === 'PARENT_CHILD') {
            const parent = personMap.get(rel.fromPersonId);
            const child = personMap.get(rel.toPersonId);

            if (parent && child) {
                const parentBirth = getDate(parent.birthDate);
                const childBirth = getDate(child.birthDate);

                if (parentBirth && childBirth) {
                    // Child born before parent
                    if (childBirth <= parentBirth) {
                        issues.push({
                            id: `child-before-parent-${parent.id}-${child.id}`,
                            personId: child.id,
                            relatedPersonId: parent.id,
                            type: 'error',
                            title: 'Lahir Sebelum Orang Tua',
                            description: `Tercatat lahir pada ${childBirth.getFullYear()}, sedangkan orang tua (${parent.fullName}) lahir pada ${parentBirth.getFullYear()}.`
                        });
                    }

                    // Parent too young (< 12 years)
                    const ageAtBirth = childBirth.getFullYear() - parentBirth.getFullYear();
                    if (ageAtBirth > 0 && ageAtBirth < 12) {
                        issues.push({
                            id: `parent-too-young-${parent.id}-${child.id}`,
                            personId: parent.id,
                            relatedPersonId: child.id,
                            type: 'warning',
                            title: 'Orang Tua Terlalu Muda',
                            description: `Menjadi orang tua pada usia ${ageAtBirth} tahun saat ${child.fullName} lahir.`
                        });
                    }

                    // Parent too old differences (> 80 years)
                    if (ageAtBirth > 80) {
                        issues.push({
                            id: `parent-gap-large-${parent.id}-${child.id}`,
                            personId: parent.id,
                            relatedPersonId: child.id,
                            type: 'warning',
                            title: 'Jarak Generasi Jauh',
                            description: `Selisih usia dengan anak adalah ${ageAtBirth} tahun. Mohon verifikasi.`
                        });
                    }
                }
            }
        }
    });

    // 3. Potential Duplicates (Simple Name Check)
    // Group by simplified name
    const nameMap = new Map<string, Person[]>();
    persons.forEach(p => {
        const simpleName = p.fullName.trim().toLowerCase();
        if (!nameMap.has(simpleName)) nameMap.set(simpleName, []);
        nameMap.get(simpleName)!.push(p);
    });

    nameMap.forEach((duplicates, name) => {
        if (duplicates.length > 1) {
            // Check if they are distinct people (e.g. different birth dates?)
            // If birth dates are missing or same, flag it
            const hasDistinctBirthDates = new Set(duplicates.map(p => p.birthDate).filter(Boolean)).size === duplicates.length;

            if (!hasDistinctBirthDates) {
                duplicates.forEach(p => {
                    issues.push({
                        id: `duplicate-name-${p.id}`,
                        personId: p.id,
                        type: 'info',
                        title: 'Potensi Duplikat',
                        description: `Terdapat ${duplicates.length} orang dengan nama "${p.fullName}".`
                    });
                });
            }
        }
    });

    return issues;
}
